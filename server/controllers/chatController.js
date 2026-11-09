'use strict';

/**
 * chatController.js
 * Official Department-Wise Citizen–Department Chat Controller.
 * Provides authenticated, department-scoped messaging with role-based access control,
 * task association, internal staff notes, and non-blocking notifications.
 */

const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const ComplaintMessage = require('../models/ComplaintMessage');
const Department = require('../models/Department');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ─── Helper: Find Complaint by ID or Ticket Reference ──────────────────────────

async function findComplaint(id) {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();

  let complaint = await Complaint.findOne({ complaintId: cleanId });
  if (!complaint && mongoose.Types.ObjectId.isValid(cleanId)) {
    complaint = await Complaint.findById(cleanId);
  }
  return complaint;
}

// ─── Helper: Find Department by ObjectId, Code, or Name ────────────────────────

async function findDepartment(deptId) {
  if (!deptId || typeof deptId !== 'string') return null;
  const cleanId = deptId.trim();

  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const dept = await Department.findById(cleanId);
    if (dept) return dept;
  }

  return Department.findOne({
    $or: [{ code: cleanId }, { name: cleanId }],
  });
}

// ─── Helper: Verify Complaint-Department Association ─────────────────────────

async function verifyDepartmentAssociation(complaint, department) {
  const deptObjectIdStr = department._id.toString();

  // 1. Primary department check
  if (
    complaint.departments?.primary?.departmentId &&
    complaint.departments.primary.departmentId.toString() === deptObjectIdStr
  ) {
    return true;
  }

  // 2. Supporting departments check
  if (
    Array.isArray(complaint.departments?.supporting) &&
    complaint.departments.supporting.some(
      (d) => d.departmentId && d.departmentId.toString() === deptObjectIdStr
    )
  ) {
    return true;
  }

  // 3. Routing department check (compatibility)
  if (
    complaint.routing?.departmentId &&
    complaint.routing.departmentId.toString() === deptObjectIdStr
  ) {
    return true;
  }

  // 4. ComplaintTask department check
  const taskExists = await ComplaintTask.exists({
    complaintId: complaint.complaintId,
    departmentId: department._id,
  });

  return Boolean(taskExists);
}

// ─── Helper: Role-Based Authorization Check ──────────────────────────────────

async function authorizeChatAccess(user, complaint, department) {
  if (!user) {
    return { authorized: false, status: 401, message: 'Authentication required.' };
  }

  const role = user.role;
  const deptObjectIdStr = department._id.toString();

  // 1. Citizen authorization
  if (role === 'citizen') {
    const isOwner =
      (user.citizenId && user.citizenId === complaint.citizenId) ||
      (complaint.citizenRef && complaint.citizenRef.toString() === user._id.toString()) ||
      (complaint.citizenId === user._id.toString());

    if (!isOwner) {
      return {
        authorized: false,
        status: 403,
        message: 'Access denied. You may only access conversations for your own complaints.',
      };
    }
    return { authorized: true, role, isCitizen: true, canSendInternal: false };
  }

  // 2. Central Admin authorization (Municipality-wide oversight)
  if (role === 'central_admin') {
    return { authorized: true, role, isAdmin: true, canSendInternal: true };
  }

  // 3. Department Supervisor authorization
  if (role === 'department_supervisor') {
    const userDeptId = user.departmentId ? user.departmentId.toString() : null;
    if (!userDeptId || userDeptId !== deptObjectIdStr) {
      return {
        authorized: false,
        status: 403,
        message:
          'Access denied. Department supervisors can only access conversations for their assigned department.',
      };
    }
    return { authorized: true, role, isSupervisor: true, canSendInternal: true };
  }

  // 4. Department Employee authorization
  if (role === 'department_employee') {
    const userDeptId = user.departmentId ? user.departmentId.toString() : null;
    if (!userDeptId || userDeptId !== deptObjectIdStr) {
      return {
        authorized: false,
        status: 403,
        message: 'Access denied. You do not belong to this department.',
      };
    }

    // Verify assigned employee ID on task (strictly by ID, not by name fallback)
    const assignedTask = await ComplaintTask.findOne({
      complaintId: complaint.complaintId,
      departmentId: department._id,
      assignedEmployeeId: user._id,
    });

    if (!assignedTask) {
      return {
        authorized: false,
        status: 403,
        message:
          'Access denied. Field employees can only access conversations for tasks explicitly assigned to them.',
      };
    }

    return {
      authorized: true,
      role,
      isEmployee: true,
      canSendInternal: true,
      assignedTask,
    };
  }

  return {
    authorized: false,
    status: 403,
    message: `Access denied. Role "${role}" is not authorized for department chat.`,
  };
}

// ─── Helper: Non-Blocking Notification Dispatcher ─────────────────────────────

async function dispatchChatNotification({ complaint, department, message, sender, taskId }) {
  try {
    const isCitizenSender = sender.role === 'citizen';
    const cleanSnippet =
      message.message.length > 80
        ? message.message.substring(0, 77) + '...'
        : message.message;

    if (isCitizenSender) {
      // Citizen sent message: Notify department supervisor(s) & assigned employee
      const notificationsToInsert = [];

      // Find active supervisor(s) for this department
      const supervisors = await User.find({
        departmentId: department._id,
        role: 'department_supervisor',
        active: true,
      }).select('_id name');

      for (const sup of supervisors) {
        notificationsToInsert.push({
          citizenId: complaint.citizenId,
          userId: sup._id,
          recipientRole: 'department_supervisor',
          complaintId: complaint.complaintId,
          taskId: taskId || null,
          title: `Citizen Message - ${complaint.complaintId}`,
          message: `${sender.name} (${department.name}): "${cleanSnippet}"`,
          type: 'reminder',
        });
      }

      // If a specific task is linked and has an assigned employee, notify them too
      if (taskId) {
        const task = await ComplaintTask.findOne({
          taskId,
          departmentId: department._id,
        }).select('assignedEmployeeId taskId');

        if (task && task.assignedEmployeeId) {
          notificationsToInsert.push({
            citizenId: complaint.citizenId,
            userId: task.assignedEmployeeId,
            recipientRole: 'department_employee',
            complaintId: complaint.complaintId,
            taskId: task.taskId,
            title: `Citizen Message on Task ${task.taskId}`,
            message: `${sender.name}: "${cleanSnippet}"`,
            type: 'reminder',
          });
        }
      }

      if (notificationsToInsert.length > 0) {
        await Notification.insertMany(notificationsToInsert);
      }
    } else {
      // Municipal Staff or Admin sent a message
      // If external (citizen-facing), notify the citizen
      if (!message.isInternal) {
        await Notification.create({
          citizenId: complaint.citizenId,
          userId: complaint.citizenRef || null,
          recipientRole: 'citizen',
          complaintId: complaint.complaintId,
          taskId: taskId || null,
          title: `Official Message from ${department.name}`,
          message: `${sender.name} (${department.name}): "${cleanSnippet}"`,
          type: 'reminder',
        });
      } else if (sender.role === 'department_employee') {
        // Internal note added by employee: notify supervisor only (citizens NEVER notified)
        const supervisors = await User.find({
          departmentId: department._id,
          role: 'department_supervisor',
          active: true,
        }).select('_id');

        for (const sup of supervisors) {
          await Notification.create({
            citizenId: complaint.citizenId,
            userId: sup._id,
            recipientRole: 'department_supervisor',
            complaintId: complaint.complaintId,
            taskId: taskId || null,
            title: `Internal Note - ${complaint.complaintId}`,
            message: `${sender.name} added internal note: "${cleanSnippet}"`,
            type: 'reminder',
          });
        }
      } else if (sender.role === 'central_admin') {
        // Internal directive added by Central Admin: notify department supervisor(s)
        const supervisors = await User.find({
          departmentId: department._id,
          role: 'department_supervisor',
          active: true,
        }).select('_id');

        for (const sup of supervisors) {
          await Notification.create({
            citizenId: complaint.citizenId,
            userId: sup._id,
            recipientRole: 'department_supervisor',
            complaintId: complaint.complaintId,
            taskId: taskId || null,
            title: `Admin Directive - ${complaint.complaintId}`,
            message: `${sender.name} issued directive: "${cleanSnippet}"`,
            type: 'reminder',
          });
        }
      }
    }
  } catch (err) {
    // Non-blocking: log error without interrupting the message response
    console.error('Non-blocking chat notification error:', err.message);
  }
}

// ─── Helper: Sanitize Message Output ─────────────────────────────────────────

function sanitizeMessage(msg) {
  return {
    _id: msg._id,
    complaintId: msg.complaintId,
    taskId: msg.taskId || null,
    departmentId: msg.departmentId || null,
    departmentName: msg.departmentName || '',
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderRole: msg.senderRole,
    messageType: msg.messageType,
    message: msg.message,
    attachments: msg.attachments || [],
    isInternal: Boolean(msg.isInternal),
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

// ─── Controller: GET /api/complaints/:id/departments/:deptId/messages ────────

/**
 * Retrieve messages for a specific department under a complaint.
 * Enforces role-based visibility, pagination, and chronological sorting.
 */
async function getDepartmentMessages(req, res, next) {
  try {
    const { id, deptId } = req.params;

    // 1. Locate Complaint
    const complaint = await findComplaint(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // 2. Locate Department
    const department = await findDepartment(deptId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    // 3. Verify Complaint-Department Association
    const isAssociated = await verifyDepartmentAssociation(complaint, department);
    if (!isAssociated) {
      return res.status(400).json({
        success: false,
        message: 'Department is not associated with or assigned to this complaint.',
      });
    }

    // 4. Authorize User
    const authResult = await authorizeChatAccess(req.user, complaint, department);
    if (!authResult.authorized) {
      return res.status(authResult.status).json({ success: false, message: authResult.message });
    }

    // 5. Build Query
    const query = {
      complaintId: complaint.complaintId,
      departmentId: department._id,
    };

    // Filter by internal visibility: Citizens can NEVER see internal messages
    if (req.user.role === 'citizen') {
      query.isInternal = false;
    } else if (req.query.internalOnly === 'true') {
      query.isInternal = true;
    }

    // Optional taskId filter
    if (req.query.taskId && typeof req.query.taskId === 'string') {
      query.taskId = req.query.taskId.trim();
    }

    // 6. Pagination & Chronological Ordering
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, rawMessages] = await Promise.all([
      ComplaintMessage.countDocuments(query),
      ComplaintMessage.find(query)
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      complaintId: complaint.complaintId,
      department: {
        id: department._id,
        name: department.name,
        code: department.code,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      data: rawMessages.map(sanitizeMessage),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: POST /api/complaints/:id/departments/:deptId/messages ───────

/**
 * Send an official message or internal note for a specific department under a complaint.
 * Enforces role-based permissions, derives identity from req.user (anti-spoofing),
 * associates task when applicable, and triggers notifications without mutating workflow.
 */
async function postDepartmentMessage(req, res, next) {
  try {
    const { id, deptId } = req.params;

    // 1. Locate Complaint
    const complaint = await findComplaint(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // 2. Locate Department
    const department = await findDepartment(deptId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    // 3. Verify Complaint-Department Association
    const isAssociated = await verifyDepartmentAssociation(complaint, department);
    if (!isAssociated) {
      return res.status(400).json({
        success: false,
        message: 'Department is not associated with or assigned to this complaint.',
      });
    }

    // 4. Authorize User
    const authResult = await authorizeChatAccess(req.user, complaint, department);
    if (!authResult.authorized) {
      return res.status(authResult.status).json({ success: false, message: authResult.message });
    }

    // 5. Message Content Validation
    const rawMessage = req.body.message;
    if (!rawMessage || typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }
    const cleanMessage = rawMessage.trim();
    if (cleanMessage.length > 3000) {
      return res.status(400).json({
        success: false,
        message: 'Message text exceeds the 3000 character limit.',
      });
    }

    // 6. Attachments Validation
    let cleanAttachments = [];
    if (Array.isArray(req.body.attachments)) {
      cleanAttachments = req.body.attachments
        .filter((att) => typeof att === 'string' && att.trim().length > 0)
        .map((att) => att.trim());
    }

    // 7. Derive Sender Identity Strictly from req.user (Anti-Spoofing)
    const senderId = req.user._id;
    const senderName = req.user.name || 'Municipal Officer';
    const senderRole = req.user.role;

    // 8. Internal Message Rules
    // Citizens can NEVER create internal messages.
    // Only authorized staff/admin can set isInternal: true.
    let effectiveIsInternal = false;
    if (authResult.canSendInternal && req.body.isInternal === true) {
      effectiveIsInternal = true;
    }

    // 9. Derive Message Type
    let effectiveMessageType = 'citizen_inquiry';
    if (effectiveIsInternal) {
      effectiveMessageType = 'internal_staff_note';
    } else if (senderRole === 'citizen') {
      effectiveMessageType = 'citizen_inquiry';
    } else {
      effectiveMessageType = req.body.messageType && [
        'admin_clarification_request',
        'status_update',
        'citizen_inquiry',
      ].includes(req.body.messageType)
        ? req.body.messageType
        : 'status_update';
    }

    // 10. Task Association
    let associatedTaskId = null;
    if (req.body.taskId && typeof req.body.taskId === 'string') {
      const requestedTaskId = req.body.taskId.trim();
      const validTask = await ComplaintTask.findOne({
        taskId: requestedTaskId,
        complaintId: complaint.complaintId,
        departmentId: department._id,
      });

      if (!validTask) {
        return res.status(400).json({
          success: false,
          message: 'Specified task does not belong to this complaint and department.',
        });
      }

      // If employee, ensure the requested task is assigned to this employee
      if (req.user.role === 'department_employee') {
        if (!validTask.assignedEmployeeId || validTask.assignedEmployeeId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only attach messages to tasks assigned to you.',
          });
        }
      }

      associatedTaskId = validTask.taskId;
    } else if (req.user.role === 'department_employee' && authResult.assignedTask) {
      // Default to employee's assigned task if not explicitly passed
      associatedTaskId = authResult.assignedTask.taskId;
    }

    // 11. Create and Persist ComplaintMessage
    const createdMessage = await ComplaintMessage.create({
      complaintId: complaint.complaintId,
      departmentId: department._id,
      departmentName: department.name,
      taskId: associatedTaskId,
      senderId,
      senderName,
      senderRole,
      messageType: effectiveMessageType,
      message: cleanMessage,
      attachments: cleanAttachments,
      isInternal: effectiveIsInternal,
    });

    // 12. Dispatch Non-Blocking Notification
    dispatchChatNotification({
      complaint,
      department,
      message: createdMessage,
      sender: req.user,
      taskId: associatedTaskId,
    });

    // 13. Workflow Isolation Guarantee:
    // Complaint status, task status, priority, and SLA are completely untouched.

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: sanitizeMessage(createdMessage),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: GET /api/complaints/:id/departments ─────────────────────────

/**
 * Retrieve list of all departments associated with a complaint.
 * Enables the frontend to render department conversation tabs dynamically.
 */
async function getComplaintDepartments(req, res, next) {
  try {
    const { id } = req.params;

    const complaint = await findComplaint(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Authorization: User must be complaint owner, central admin, or belonging to an associated department
    if (req.user.role === 'citizen') {
      const isOwner =
        (req.user.citizenId && req.user.citizenId === complaint.citizenId) ||
        (complaint.citizenRef && complaint.citizenRef.toString() === req.user._id.toString()) ||
        (complaint.citizenId === req.user._id.toString());
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You may only view departments for your own complaints.',
        });
      }
    }

    // Collect all unique department ObjectIds associated with this complaint
    const departmentMap = new Map();

    if (complaint.departments?.primary?.departmentId) {
      const dId = complaint.departments.primary.departmentId.toString();
      departmentMap.set(dId, {
        departmentId: complaint.departments.primary.departmentId,
        departmentName: complaint.departments.primary.departmentName,
        isPrimary: true,
        reason: complaint.departments.primary.reason || '',
      });
    }

    if (Array.isArray(complaint.departments?.supporting)) {
      for (const sup of complaint.departments.supporting) {
        if (sup.departmentId) {
          const dId = sup.departmentId.toString();
          if (!departmentMap.has(dId)) {
            departmentMap.set(dId, {
              departmentId: sup.departmentId,
              departmentName: sup.departmentName,
              isPrimary: false,
              reason: sup.reason || '',
            });
          }
        }
      }
    }

    if (complaint.routing?.departmentId) {
      const rId = complaint.routing.departmentId.toString();
      if (!departmentMap.has(rId)) {
        departmentMap.set(rId, {
          departmentId: complaint.routing.departmentId,
          departmentName: complaint.routing.departmentName,
          isPrimary: true,
          reason: complaint.routing.routingReason || '',
        });
      }
    }

    // Also look up any departments with tasks for this complaint
    const tasks = await ComplaintTask.find({ complaintId: complaint.complaintId })
      .select('taskId departmentId departmentName status assignedEmployeeId assignedEmployeeName')
      .lean();

    for (const t of tasks) {
      if (t.departmentId) {
        const tId = t.departmentId.toString();
        if (!departmentMap.has(tId)) {
          departmentMap.set(tId, {
            departmentId: t.departmentId,
            departmentName: t.departmentName,
            isPrimary: false,
            reason: '',
          });
        }
      }
    }

    // Hydrate department details and compute message counts
    const result = [];
    for (const [deptIdStr, item] of departmentMap.entries()) {
      const deptRecord = await Department.findById(deptIdStr).select('code description active').lean();

      // Query message counts
      const msgFilter = {
        complaintId: complaint.complaintId,
        departmentId: item.departmentId,
      };
      if (req.user.role === 'citizen') {
        msgFilter.isInternal = false;
      }
      const messageCount = await ComplaintMessage.countDocuments(msgFilter);

      // Associated tasks under this department
      const deptTasks = tasks.filter(
        (t) => t.departmentId && t.departmentId.toString() === deptIdStr
      );

      result.push({
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        code: deptRecord?.code || '',
        description: deptRecord?.description || '',
        isPrimary: item.isPrimary,
        reason: item.reason,
        taskCount: deptTasks.length,
        tasks: deptTasks.map((t) => ({
          taskId: t.taskId,
          status: t.status,
          assignedEmployeeName: t.assignedEmployeeName,
        })),
        messageCount,
      });
    }

    return res.json({
      success: true,
      complaintId: complaint.complaintId,
      count: result.length,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: GET /api/complaints/:id/messages (General & Legacy Support) ───

/**
 * Retrieve complaint-level messages including legacy seeded records where departmentId is null.
 * Ensures backward compatibility and clean visibility segregation.
 */
async function getComplaintMessages(req, res, next) {
  try {
    const { id } = req.params;

    const complaint = await findComplaint(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Role check: Citizen must own complaint
    if (req.user.role === 'citizen') {
      const isOwner =
        (req.user.citizenId && req.user.citizenId === complaint.citizenId) ||
        (complaint.citizenRef && complaint.citizenRef.toString() === req.user._id.toString()) ||
        (complaint.citizenId === user._id.toString());
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You may only access messages for your own complaints.',
        });
      }
    }

    const query = { complaintId: complaint.complaintId };

    // If query specifies legacyOnly: true, filter where departmentId is null
    if (req.query.legacyOnly === 'true') {
      query.departmentId = null;
    }

    // Citizen visibility filter
    if (req.user.role === 'citizen') {
      query.isInternal = false;
    } else if (req.query.internalOnly === 'true') {
      query.isInternal = true;
    }

    const messages = await ComplaintMessage.find(query).sort({ createdAt: 1, _id: 1 }).lean();

    return res.json({
      success: true,
      complaintId: complaint.complaintId,
      count: messages.length,
      data: messages.map(sanitizeMessage),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDepartmentMessages,
  postDepartmentMessage,
  getComplaintDepartments,
  getComplaintMessages,
  // Exported helpers for isolated testing
  authorizeChatAccess,
  verifyDepartmentAssociation,
  findComplaint,
  findDepartment,
  dispatchChatNotification,
};

