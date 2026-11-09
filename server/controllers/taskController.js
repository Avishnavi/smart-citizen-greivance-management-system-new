'use strict';

const mongoose = require('mongoose');
const ComplaintTask = require('../models/ComplaintTask');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const User = require('../models/User');
const Resolution = require('../models/Resolution');
const WorkflowEvent = require('../models/WorkflowEvent');
const { verifyResolution } = require('../services/resolutionVerificationService');
const { logEvent, notifyCitizen } = require('../services/workflowOrchestrator');
const { calculateTaskSLA, pauseTaskSLA, resumeTaskSLA } = require('../services/slaMonitoringService');
const { predictTaskDelay } = require('../services/predictiveDelayService');
const { triggerTaskEscalation, acknowledgeTaskEscalation } = require('../services/escalationService');
const Escalation = require('../models/Escalation');

const SLA_HOURS_MAP = {
  CRITICAL: 6,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 120,
};

/**
 * GET /api/tasks
 * Retrieve department tasks scoped by user role.
 */
async function getAllTasks(req, res, next) {
  try {
    const { complaintId, status, taskType, priority, departmentName } = req.query;
    const filter = {};

    if (complaintId) filter.complaintId = complaintId.trim();
    if (status && status !== 'all') filter.status = status;
    if (taskType && taskType !== 'all') filter.taskType = taskType;
    if (priority && priority !== 'all') filter.priority = priority;

    // RBAC: Role-based filtering
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Citizens cannot access internal department task queues.',
        });
      }

      if (req.user.role === 'department_supervisor') {
        // Supervisor views only tasks for their assigned department
        if (req.user.departmentName) {
          filter.departmentName = req.user.departmentName;
        }
      } else if (req.user.role === 'department_employee') {
        // Employee views only tasks explicitly assigned to them
        const assignedConditions = [];
        if (req.user._id) assignedConditions.push({ assignedEmployeeId: req.user._id });
        if (req.user.name) assignedConditions.push({ assignedEmployeeName: req.user.name });
        if (req.user.employeeId) {
          assignedConditions.push({ assignedEmployeeName: { $regex: req.user.employeeId, $options: 'i' } });
        }
        filter.$or = assignedConditions;
      }
      // central_admin has municipality-wide access (no role filter injected)
    }

    if (departmentName && req.user?.role === 'central_admin') {
      filter.departmentName = departmentName;
    }

    const tasks = await ComplaintTask.find(filter).sort({ createdAt: -1 });

    const enrichedTasks = await Promise.all(
      tasks.map(async (t) => {
        const taskObj = t.toObject();
        const sla = calculateTaskSLA(t);
        const delayRisk = await predictTaskDelay(t);
        return {
          ...taskObj,
          slaStatus: sla.slaStatus,
          slaHours: sla.slaHours,
          slaDeadline: sla.slaDeadline,
          elapsedHours: sla.elapsedHours,
          remainingHours: sla.remainingHours,
          elapsedPercentage: sla.elapsedPercentage,
          isBreached: sla.isBreached,
          isPaused: sla.isPaused,
          delayRisk,
        };
      })
    );

    res.json({
      success: true,
      count: enrichedTasks.length,
      data: enrichedTasks,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/:taskId
 * Retrieve a single task by taskId.
 */
async function getTaskById(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Department task not found.' });
    }

    // RBAC: Verify task access boundaries
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      if (req.user.role === 'department_supervisor') {
        if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Task belongs to "${task.departmentName}", but your department is "${req.user.departmentName}".`,
          });
        }
      } else if (req.user.role === 'department_employee') {
        const isAssigned =
          (task.assignedEmployeeId && task.assignedEmployeeId.toString() === req.user._id.toString()) ||
          task.assignedEmployeeName === req.user.name ||
          (req.user.employeeId && task.assignedEmployeeName.includes(req.user.employeeId));
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view tasks assigned to you.',
          });
        }
      }
    }

    // Enrich task with SLA & delay risk
    const taskObj = task.toObject();
    const sla = calculateTaskSLA(task);
    const delayRisk = await predictTaskDelay(task);
    const enrichedTask = {
      ...taskObj,
      slaStatus: sla.slaStatus,
      slaHours: sla.slaHours,
      slaDeadline: sla.slaDeadline,
      elapsedHours: sla.elapsedHours,
      remainingHours: sla.remainingHours,
      elapsedPercentage: sla.elapsedPercentage,
      isBreached: sla.isBreached,
      isPaused: sla.isPaused,
      delayRisk,
    };

    // Attach parent complaint details for context
    const complaint = await Complaint.findOne({ complaintId: task.complaintId });

    res.json({
      success: true,
      data: {
        task: enrichedTask,
        complaint: complaint
          ? {
              complaintId: complaint.complaintId,
              category: complaint.category,
              description: complaint.description,
              location: complaint.location,
              status: complaint.status,
              priority: complaint.priority,
              createdAt: complaint.createdAt,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tasks/:taskId/assign
 * Department Supervisor or Central Admin assigns task to a Department Employee.
 */
async function assignTask(req, res, next) {
  try {
    const { taskId } = req.params;
    let employeeId = req.body.employeeId || req.body.assignedEmployeeId;
    let employeeName = req.body.employeeName;

    if (!employeeName && employeeId) {
      const foundEmp = await User.findOne({
        $or: [
          { employeeId },
          ...(mongoose.Types.ObjectId.isValid(employeeId) ? [{ _id: employeeId }] : []),
        ],
      });
      if (foundEmp) {
        employeeName = foundEmp.name;
      }
    }

    if (!employeeName) {
      return res.status(400).json({ success: false, message: 'Employee name is required for assignment.' });
    }

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Department task not found.' });
    }

    // RBAC: Supervisor boundary check
    if (req.user && req.user.role === 'department_supervisor') {
      if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You cannot assign tasks outside your department (${req.user.departmentName}).`,
        });
      }
    }

    // Find employee user record if id provided
    let empUser = null;
    if (employeeId) {
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        empUser = await User.findById(employeeId);
      }
      if (!empUser) {
        empUser = await User.findOne({ employeeId });
      }
    }
    if (!empUser && employeeName) {
      empUser = await User.findOne({ name: employeeName, role: 'department_employee' });
    }

    const isReassignment =
      (task.assignmentHistory && task.assignmentHistory.length > 0) ||
      Boolean(task.assignedEmployeeName && task.assignedEmployeeName !== employeeName);

    task.assignmentHistory = task.assignmentHistory || [];
    task.assignmentHistory.push({
      employeeId: empUser?._id || null,
      employeeName,
      supervisorId: req.user?._id || null,
      supervisorName: req.user?.name || 'Department Supervisor',
      assignedAt: new Date(),
      notes: req.body.notes || '',
      action: isReassignment ? 'reassignment' : 'initial_assignment',
    });

    task.assignedEmployeeId = empUser?._id || null;
    task.assignedEmployeeName = employeeName;
    task.assignedAt = new Date();
    task.status = 'ASSIGNED';
    await task.save();

    // If parent complaint is in DEPARTMENT_ASSIGNMENT, advance it to IN_PROGRESS
    const parentComplaint = await Complaint.findOne({ complaintId: task.complaintId });
    if (parentComplaint && ['DEPARTMENT_ASSIGNMENT', 'APPROVED'].includes(parentComplaint.status)) {
      parentComplaint.status = 'IN_PROGRESS';
      parentComplaint.workflowStage = 'IN_PROGRESS';
      await parentComplaint.save();
    }

    // Log workflow event
    await logEvent(
      task.complaintId,
      'TASK_ASSIGNED',
      `Task "${task.title}" (${task.departmentName}) assigned to ${employeeName}.`,
      { taskId: task.taskId, departmentName: task.departmentName, assignedEmployee: employeeName },
      { type: 'supervisor', id: req.user?._id, name: req.user?.name || 'Department Supervisor' }
    );

    res.json({
      success: true,
      message: `Task successfully assigned to ${employeeName}.`,
      data: task,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Allowed status transitions for ComplaintTask progress updates
 * Using strictly existing schema status values
 */
const ALLOWED_TASK_TRANSITIONS = {
  PENDING_ASSIGNMENT: ['ASSIGNED'],
  ASSIGNED: ['ACCEPTED', 'IN_PROGRESS'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['IN_PROGRESS', 'ESCALATED'],
  REQUIRES_ADDITIONAL_WORK: ['IN_PROGRESS', 'ACCEPTED'],
  ESCALATED: ['IN_PROGRESS', 'ASSIGNED'],
  AWAITING_REVIEW: [], // Transitions handled strictly by /verify
  SUBMITTED_FOR_VERIFICATION: [],
  VERIFIED: [], // Terminal via status update; reopened via complaint reopening
  COMPLETED: [],
  REJECTED: [],
};

/**
 * PATCH /api/tasks/:taskId/status
 * Employee or Supervisor updates task progress (ACCEPT, IN_PROGRESS, etc.)
 */
async function updateTaskStatus(req, res, next) {
  try {
    const { taskId } = req.params;
    const { status, note } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid status is required.' });
    }

    const targetStatus = status.trim();

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Department task not found.' });
    }

    // 1. Guard against modifying already verified / completed tasks directly
    if (['VERIFIED', 'COMPLETED'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update task status. Task is already ${task.status}. Reopening must be performed through grievance reopening.`,
      });
    }

    // 2. Guard against bypassing dedicated workflow endpoints
    if (['VERIFIED', 'COMPLETED'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Task cannot be marked VERIFIED via status update. Department Supervisor must verify resolution evidence via POST /api/tasks/:taskId/verify.',
      });
    }

    if (['AWAITING_REVIEW', 'SUBMITTED_FOR_VERIFICATION'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Resolution submission must be performed via POST /api/tasks/:taskId/resolve with evidence and completion notes.',
      });
    }

    if (['ASSIGNED', 'PENDING_ASSIGNMENT'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Task assignment must be performed via POST /api/tasks/:taskId/assign by a Department Supervisor or Central Admin.',
      });
    }

    // 3. Role-based restrictions
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Citizens cannot modify internal departmental task progress.',
        });
      }

      if (req.user.role === 'department_employee') {
        const isAssigned =
          (task.assignedEmployeeId && task.assignedEmployeeId.toString() === req.user._id.toString()) ||
          task.assignedEmployeeName === req.user.name ||
          (req.user.employeeId && task.assignedEmployeeName.includes(req.user.employeeId));
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only update tasks assigned to you.',
          });
        }

        const employeeAllowed = ['ACCEPTED', 'IN_PROGRESS', 'ESCALATED'];
        if (!employeeAllowed.includes(targetStatus)) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Field employees can only set status to: ${employeeAllowed.join(', ')}.`,
          });
        }
      }

      if (req.user.role === 'department_supervisor') {
        if (req.user.departmentName && task.departmentName && req.user.departmentName.toLowerCase() !== task.departmentName.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You cannot update tasks outside your department (${req.user.departmentName}).`,
          });
        }
      }
    }

    // 4. Validate transition against allowable transition state machine
    const allowedTransitions = ALLOWED_TASK_TRANSITIONS[task.status] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid task status transition from '${task.status}' to '${targetStatus}'. Allowed next statuses: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (use appropriate workflow endpoint)'}.`,
      });
    }

    // 5. If escalating, note explaining reason is mandatory
    if (targetStatus === 'ESCALATED' && (!note || typeof note !== 'string' || note.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'A note explaining the reason is mandatory when escalating a task.',
      });
    }

    const previousStatus = task.status;
    task.status = targetStatus;

    if (note) {
      task.progressNotes = task.progressNotes || [];
      task.progressNotes.push({
        note: note.trim(),
        authorId: req.user?._id,
        authorName: req.user?.name || 'Staff Officer',
        authorRole: req.user?.role || 'department_employee',
        createdAt: new Date(),
      });
    }

    await task.save();

    // Advance parent complaint to IN_PROGRESS if task is accepted or in progress
    if (['ACCEPTED', 'IN_PROGRESS'].includes(targetStatus)) {
      const parentComplaint = await Complaint.findOne({ complaintId: task.complaintId });
      if (parentComplaint && ['DEPARTMENT_ASSIGNMENT', 'APPROVED', 'REOPENED'].includes(parentComplaint.status)) {
        parentComplaint.status = 'IN_PROGRESS';
        parentComplaint.workflowStage = 'IN_PROGRESS';
        await parentComplaint.save();
      }
    }

    await logEvent(
      task.complaintId,
      'PROGRESS_NOTE_ADDED',
      `Task "${task.title}" status changed to ${targetStatus}${note ? `: "${note}"` : ''}`,
      { taskId: task.taskId, previousStatus, newStatus: targetStatus, note },
      { type: 'officer', id: req.user?._id, name: req.user?.name || 'Field Officer' }
    );

    res.json({
      success: true,
      message: `Task status updated to ${status}.`,
      data: task,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:taskId/resolution
 * Employee submits work completion details and evidence for verification.
 * Runs AI resolution verification. Does NOT automatically close the main complaint.
 */
async function submitTaskResolution(req, res, next) {
  try {
    const { taskId } = req.params;
    const rawNotes = req.body.resolutionNotes || req.body.notes || '';
    const resolutionNotes = typeof rawNotes === 'string' ? rawNotes.trim() : '';
    const evidenceUrls = req.body.evidenceUrls || req.body.evidence || [];
    const actionsTaken = req.body.actionsTaken || req.body.actions || [];

    if (!resolutionNotes || resolutionNotes.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required (at least 10 characters).',
      });
    }

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Department task not found.' });
    }

    // RBAC: Employee assignment check
    if (req.user && req.user.role === 'department_employee') {
      const isAssigned =
        (task.assignedEmployeeId && task.assignedEmployeeId.toString() === req.user._id.toString()) ||
        task.assignedEmployeeName === req.user.name ||
        (req.user.employeeId && task.assignedEmployeeName.includes(req.user.employeeId));
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only submit resolutions for tasks assigned to you.',
        });
      }
    }

    const parentComplaint = await Complaint.findOne({ complaintId: task.complaintId });
    const DEPT_CATEGORY_MAP = {
      'Road Maintenance Department': 'Pothole',
      'Water & Sewerage Board': 'Water Supply',
      'Electricity & Lighting Department': 'Streetlight',
      'Solid Waste Management': 'Garbage',
      'Traffic & Transport Department': 'Traffic',
      'Horticulture & Parks': 'Tree Fall',
      'Town Planning & Enforcement': 'Illegal Construction',
      'Public Health & Sanitation': 'Drainage',
    };
    const effectiveCategory = DEPT_CATEGORY_MAP[task.departmentName] || parentComplaint?.category || 'Other';
    const complaintDescription = parentComplaint?.description || task.description;

    // Run multi-factor resolution verification using department-tailored standards
    const verification = await verifyResolution(
      complaintDescription,
      resolutionNotes,
      effectiveCategory,
      evidenceUrls,
      {
        departmentName: task.departmentName,
        taskTitle: task.title,
        actionsTaken,
      }
    );

    // Preserve previous submission in resolutionHistory before updating
    if (task.resolution && task.resolution.resolutionNotes) {
      task.resolutionHistory = task.resolutionHistory || [];
      task.resolutionHistory.push(task.resolution);
    }

    // Update Task Resolution Block
    // Invariant: Resolution submission places task in pending-review ('AWAITING_REVIEW').
    // An automated assessment score of >= 70 or recommendation of APPROVE_RECOMMENDED
    // NEVER automatically verifies a task or marks it completed.
    // The actual verification decision rests strictly with the department supervisor.
    task.resolution = {
      resolutionNotes: resolutionNotes.trim(),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [evidenceUrls].filter(Boolean),
      actionsTaken: Array.isArray(actionsTaken) ? actionsTaken : [actionsTaken].filter(Boolean),
      submittedAt: new Date(),
      submittedBy: req.user?.name || task.assignedEmployeeName || 'Field Employee',
      submittedById: req.user?._id,
      verificationStatus: 'requires_review',
      verificationScore: verification.verificationScore,
      verificationReason: verification.reason,
      verifiedAt: null,
      verifierType: 'pending',
      automatedAssessment: verification,
      supervisorReview: task.resolution?.supervisorReview || { decision: 'pending' },
    };

    // Also persist in standalone Resolution model for audit preservation
    try {
      const resDoc = await Resolution.create({
        complaintId: task.complaintId,
        taskId: task.taskId,
        taskRef: task._id,
        employeeId: req.user?._id,
        employeeName: req.user?.name || task.assignedEmployeeName,
        departmentName: task.departmentName,
        resolutionNotes: resolutionNotes.trim(),
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [evidenceUrls].filter(Boolean),
        actionsTaken: Array.isArray(actionsTaken) ? actionsTaken : [actionsTaken].filter(Boolean),
        verificationStatus: 'requires_review',
        verificationScore: verification.verificationScore,
        verificationReason: verification.reason,
        verifierType: 'pending',
        verifiedAt: null,
        automatedAssessment: verification,
      });
      task.resolutionId = resDoc._id;
    } catch (resErr) {
      console.warn('Failed to save standalone Resolution record:', resErr.message);
    }

    // Task enters pending-review state ('AWAITING_REVIEW') regardless of automated score
    task.status = 'AWAITING_REVIEW';
    task.completedAt = null;

    await task.save();

    // Log Verification Event
    await logEvent(
      task.complaintId,
      'RESOLUTION_SUBMITTED',
      `Resolution submitted for task "${task.title}" by ${task.assignedEmployeeName}: "${resolutionNotes}"`,
      {
        taskId: task.taskId,
        verificationStatus: verification.verificationStatus,
        score: verification.verificationScore,
      },
      { type: 'officer', id: req.user?._id, name: req.user?.name || 'Field Employee' }
    );

    // ── Evaluate Parent Complaint Status Across All Department Tasks ───────────
    const allComplaintTasks = await ComplaintTask.find({ complaintId: task.complaintId });
    const totalTasks = allComplaintTasks.length;
    const completedTasks = allComplaintTasks.filter((t) => ['VERIFIED', 'COMPLETED'].includes(t.status)).length;

    let parentNewStatus = parentComplaint ? parentComplaint.status : null;

    if (totalTasks > 0) {
      if (completedTasks === totalTasks) {
        // ALL tasks completed & verified
        parentNewStatus = 'RESOLVED';
        if (parentComplaint) parentComplaint.actualResolutionTime = new Date();
      } else if (completedTasks > 0) {
        // Supporting tasks still pending
        parentNewStatus = 'PARTIALLY_RESOLVED';
      } else if (!verification.verified) {
        parentNewStatus = 'REQUIRES_REVIEW';
      }
    }

    if (parentComplaint) {
      parentComplaint.status = parentNewStatus;
      parentComplaint.workflowStage = parentNewStatus;
      parentComplaint.tasksCompleted = completedTasks;
      await parentComplaint.save();
    }

    res.json({
      success: true,
      message: `Task resolution processed. Verification status: ${verification.verificationStatus}`,
      data: {
        task,
        verification,
        parentComplaintStatus: parentNewStatus,
        totalTasks,
        completedTasks,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper: Create tasks when Central Admin approves complaint routing
 */
async function createTasksForComplaint(complaint, primaryDept, supportingDepts = [], priority = 'MEDIUM', adminUser = null) {
  const tasksCreated = [];
  const existingCount = await ComplaintTask.countDocuments({ complaintId: complaint.complaintId });
  let seq = existingCount + 1;

  // 1. Primary Task
  const primaryDeptDoc = await Department.findOne({
    $or: [{ _id: primaryDept.departmentId }, { name: primaryDept.departmentName }],
  });

  const priorityKey = (priority || '').toUpperCase();
  const pSla = SLA_HOURS_MAP[priorityKey] || primaryDeptDoc?.slaHours || 48;
  const pSupervisor = await User.findOne({
    role: 'department_supervisor',
    $or: [{ departmentName: primaryDept.departmentName }, { departmentId: primaryDeptDoc?._id }],
  });

  const primaryTaskId = await ComplaintTask.generateTaskId(complaint.complaintId, seq++);
  const primaryTask = new ComplaintTask({
    taskId: primaryTaskId,
    complaintId: complaint.complaintId,
    complaintRef: complaint._id,
    taskType: 'primary',
    departmentId: primaryDeptDoc?._id || primaryDept.departmentId,
    departmentName: primaryDept.departmentName,
    title: `Primary Task: ${complaint.category} Resolution & Coordination`,
    description: primaryDept.description || complaint.description,
    priority,
    status: 'PENDING_ASSIGNMENT',
    assignedSupervisorId: pSupervisor?._id || null,
    assignedSupervisorName: pSupervisor?.name || 'Department Supervisor',
    slaHours: pSla,
    slaDeadline: new Date(Date.now() + pSla * 60 * 60 * 1000),
  });
  await primaryTask.save();
  tasksCreated.push(primaryTask);

  // 2. Supporting Tasks
  if (Array.isArray(supportingDepts)) {
    for (const supDept of supportingDepts) {
      if (!supDept || !supDept.departmentName) continue;

      const supDeptDoc = await Department.findOne({
        $or: [{ _id: supDept.departmentId }, { name: supDept.departmentName }],
      });

      const sSla = SLA_HOURS_MAP[priorityKey] || supDeptDoc?.slaHours || 72;
      const sSupervisor = await User.findOne({
        role: 'department_supervisor',
        $or: [{ departmentName: supDept.departmentName }, { departmentId: supDeptDoc?._id }],
      });

      const supTaskId = await ComplaintTask.generateTaskId(complaint.complaintId, seq++);
      const supTask = new ComplaintTask({
        taskId: supTaskId,
        complaintId: complaint.complaintId,
        complaintRef: complaint._id,
        taskType: 'supporting',
        departmentId: supDeptDoc?._id || supDept.departmentId,
        departmentName: supDept.departmentName,
        title: `Supporting Task: ${supDept.departmentName} Inter-Department Assistance`,
        description: supDept.reason || `Supporting work for ${complaint.complaintId}`,
        priority,
        status: 'PENDING_ASSIGNMENT',
        assignedSupervisorId: sSupervisor?._id || null,
        assignedSupervisorName: sSupervisor?.name || 'Department Supervisor',
        slaHours: sSla,
        slaDeadline: new Date(Date.now() + sSla * 60 * 60 * 1000),
      });
      await supTask.save();
      tasksCreated.push(supTask);
    }
  }

  return tasksCreated;
}

/**
 * GET /api/tasks/:taskId/knowledge
 * Retrieve grounded municipal knowledge & SOP guidance for this task.
 */
async function getTaskKnowledge(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const { retrieveRelevantKnowledge } = require('../services/ragService');
    const userRole = req.user?.role || 'citizen';
    const userDept = req.user?.departmentName || '';

    const guidance = await retrieveRelevantKnowledge({
      category: task.title,
      description: task.description,
      issue: task.title,
      department: task.departmentName,
      userRole,
      userDepartment: userDept,
    });

    if (guidance.accessDenied) {
      return res.status(403).json({
        success: false,
        message: guidance.summary,
        data: guidance,
      });
    }

    res.json({
      success: true,
      data: guidance,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/:taskId/sla
 * Retrieve comprehensive SLA status and predictive delay evaluation.
 */
async function getTaskSLA(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Role check
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (req.user.role === 'department_supervisor') {
        if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
          return res.status(403).json({ success: false, message: 'Access denied for foreign department task.' });
        }
      } else if (req.user.role === 'department_employee') {
        const isAssigned =
          (task.assignedEmployeeId && task.assignedEmployeeId.toString() === req.user._id.toString()) ||
          task.assignedEmployeeName === req.user.name ||
          (req.user.employeeId && task.assignedEmployeeName.includes(req.user.employeeId));
        if (!isAssigned) {
          return res.status(403).json({ success: false, message: 'Access denied. You can only view your own tasks.' });
        }
      }
    }

    const sla = calculateTaskSLA(task);
    const delayRisk = await predictTaskDelay(task);
    const escalations = await Escalation.find({ taskId: task.taskId }).sort({ assessedAt: -1 });

    res.json({
      success: true,
      data: {
        taskId: task.taskId,
        complaintId: task.complaintId,
        departmentName: task.departmentName,
        priority: task.priority,
        status: task.status,
        sla,
        delayRisk,
        escalations,
        pauseHistory: task.pauseHistory || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:taskId/pause-sla
 * Supervisor or Central Admin pauses SLA clock with reason.
 */
async function pauseTaskSLAController(req, res, next) {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user && req.user.role === 'department_supervisor') {
      if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access denied. Cannot pause task outside your department.' });
      }
    } else if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only supervisors or central admin can pause SLA.' });
    }

    const updatedTask = await pauseTaskSLA(task.taskId, reason, req.user);
    res.json({
      success: true,
      message: `SLA timer for task ${taskId} successfully paused.`,
      data: updatedTask,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:taskId/resume-sla
 * Supervisor or Central Admin resumes SLA clock, extending deadline.
 */
async function resumeTaskSLAController(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user && req.user.role === 'department_supervisor') {
      if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access denied. Cannot resume task outside your department.' });
      }
    } else if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only supervisors or central admin can resume SLA.' });
    }

    const updatedTask = await resumeTaskSLA(task.taskId, req.user);
    res.json({
      success: true,
      message: `SLA timer for task ${taskId} successfully resumed.`,
      data: updatedTask,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:taskId/escalate
 * Trigger an escalation for a task with deduplication.
 */
async function escalateTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { escalationLevel = 1, triggerCondition = 'ADMIN_MANUAL', reason } = req.body;

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user && req.user.role === 'department_supervisor') {
      if (req.user.departmentName && task.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Access denied. Cannot escalate task outside your department.' });
      }
    } else if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only supervisors or central admin can escalate tasks.' });
    }

    const reasons = reason ? [reason] : [`Task escalated by ${req.user?.name || 'Administrator'}`];
    const result = await triggerTaskEscalation(task, {
      escalationLevel: Number(escalationLevel),
      triggerCondition,
      reasons,
      recipientRole: Number(escalationLevel) >= 3 ? 'central_admin' : 'department_supervisor',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tasks/escalations/:escalationId/acknowledge
 * Supervisor or Central Admin acknowledges an escalation.
 */
async function acknowledgeEscalation(req, res, next) {
  try {
    const { escalationId } = req.params;
    const escalation = await Escalation.findById(escalationId);
    if (!escalation) {
      return res.status(404).json({ success: false, message: 'Escalation record not found.' });
    }

    if (req.user && req.user.role === 'department_supervisor') {
      if (
        escalation.departmentName &&
        req.user.departmentName &&
        escalation.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()
      ) {
        return res.status(403).json({ success: false, message: 'Access denied for other department escalation.' });
      }
    } else if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const updated = await acknowledgeTaskEscalation(escalationId, req.user);
    res.json({
      success: true,
      message: 'Escalation successfully acknowledged.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:taskId/verify
 * Department Supervisor or Central Admin human verification of submitted resolution.
 * Supports: 'approve', 'request_rework', 'reject'
 */
async function verifyTaskResolutionController(req, res, next) {
  try {
    const { taskId } = req.params;
    const action = req.body.action || (req.body.decision === 'approved' ? 'approve' : req.body.decision);
    const comments = req.body.comments || req.body.notes || '';
    const reworkRequirements = req.body.reworkRequirements || [];

    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Supervisor review comment is mandatory.',
      });
    }

    const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Department task not found.' });
    }

    // RBAC: Employees cannot verify resolutions (self-verification prevention)
    if (req.user && req.user.role === 'department_employee') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Employees cannot verify resolutions.',
      });
    }

    // RBAC: Supervisor cannot verify tasks outside their department
    if (req.user && req.user.role === 'department_supervisor') {
      const userDept = req.user.departmentName;
      if (userDept && task.departmentName && task.departmentName.toLowerCase() !== userDept.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You cannot verify tasks outside your department (${userDept}).`,
        });
      }
    }

    const previousStatus = task.status;
    const reviewRecord = {
      decision: action === 'approve' ? 'approved' : action === 'request_rework' ? 'requires_additional_work' : 'rejected',
      reviewedBy: req.user?._id,
      reviewedByName: req.user?.name || 'Department Supervisor',
      reviewedAt: new Date(),
      comments: comments.trim(),
      reworkRequirements: Array.isArray(reworkRequirements) ? reworkRequirements : [reworkRequirements].filter(Boolean),
    };

    task.resolution = task.resolution || {};
    task.resolution.supervisorReview = reviewRecord;

    if (action === 'approve') {
      task.status = 'VERIFIED';
      task.completedAt = new Date();
      task.resolution.verificationStatus = 'verified';
      task.resolution.verifierType = 'supervisor';
      task.resolution.verifiedAt = new Date();
    } else if (action === 'request_rework') {
      task.status = 'REQUIRES_ADDITIONAL_WORK';
      task.resolution.verificationStatus = 'requires_review';
    } else if (action === 'reject') {
      task.status = 'REJECTED';
      task.resolution.verificationStatus = 'rejected';
    }

    // Update standalone Resolution record if exists
    if (task.resolutionId) {
      try {
        await Resolution.findByIdAndUpdate(task.resolutionId, {
          supervisorReview: reviewRecord,
          verificationStatus: task.resolution.verificationStatus,
          verifiedAt: new Date(),
          verifierType: 'supervisor',
        });
      } catch (err) {
        console.warn('Could not update standalone Resolution:', err.message);
      }
    }

    await task.save();

    // Log Workflow Event
    const eventType = action === 'approve' ? 'TASK_VERIFIED' : action === 'request_rework' ? 'TASK_REWORK_REQUESTED' : 'TASK_REJECTED';
    await logEvent(
      task.complaintId,
      eventType,
      `Task "${task.title}" (${task.departmentName}) ${action === 'approve' ? 'approved' : action === 'request_rework' ? 'sent for rework' : 'rejected'} by ${req.user?.name || 'Supervisor'}: "${comments.trim()}"`,
      { taskId: task.taskId, action, comments, previousStatus, newStatus: task.status },
      { type: 'supervisor', id: req.user?._id, name: req.user?.name || 'Department Supervisor' }
    );

    // Evaluate parent complaint status
    const allComplaintTasks = await ComplaintTask.find({ complaintId: task.complaintId });
    const totalTasks = allComplaintTasks.length;
    const completedTasks = allComplaintTasks.filter((t) => ['VERIFIED', 'COMPLETED'].includes(t.status)).length;
    const reworkTasks = allComplaintTasks.filter((t) => ['REQUIRES_ADDITIONAL_WORK', 'REJECTED'].includes(t.status)).length;

    const parentComplaint = await Complaint.findOne({ complaintId: task.complaintId });
    let parentNewStatus = parentComplaint ? parentComplaint.status : null;

    if (parentComplaint && totalTasks > 0) {
      if (completedTasks === totalTasks) {
        // ALL tasks verified! Parent is now RESOLVED (ready for Central Admin closure)
        parentNewStatus = 'RESOLVED';
        parentComplaint.actualResolutionTime = new Date();
      } else if (reworkTasks > 0) {
        // At least one task requires rework - complaint must remain open
        parentNewStatus = completedTasks > 0 ? 'PARTIALLY_RESOLVED' : 'REQUIRES_REVIEW';
      } else if (completedTasks > 0) {
        parentNewStatus = 'PARTIALLY_RESOLVED';
      }

      parentComplaint.status = parentNewStatus;
      parentComplaint.workflowStage = parentNewStatus;
      parentComplaint.tasksCompleted = completedTasks;
      await parentComplaint.save();
    }

    res.json({
      success: true,
      message: `Task resolution ${action === 'approve' ? 'verified & approved' : action === 'request_rework' ? 'returned for rework' : 'rejected'}.`,
      data: {
        task,
        supervisorReview: reviewRecord,
        parentComplaintStatus: parentNewStatus,
        completedTasks,
        totalTasks,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTasks,
  getTaskById,
  assignTask,
  updateTaskStatus,
  submitTaskResolution,
  verifyTaskResolutionController,
  createTasksForComplaint,
  getTaskKnowledge,
  getTaskSLA,
  pauseTaskSLAController,
  resumeTaskSLAController,
  escalateTask,
  acknowledgeEscalation,
};

