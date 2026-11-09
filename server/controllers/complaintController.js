'use strict';

const Complaint = require('../models/Complaint');
const WorkflowEvent = require('../models/WorkflowEvent');
const Resolution = require('../models/Resolution');
const { runAnalysisPipeline, logEvent, notifyCitizen } = require('../services/workflowOrchestrator');
const { verifyResolution } = require('../services/resolutionVerificationService');
const { detectLanguage } = require('../utils/languageDetector');

/**
 * POST /api/complaints
 * Register a new civic complaint
 */
async function createComplaint(req, res, next) {
  try {
    const {
      citizenId = (req.user && req.user.citizenId) ? req.user.citizenId : 'CIT-8842',
      description,
      originalText,
      language = 'English',
      inputType = 'text',
      hasVoice = false,
      voiceUrl,
      voiceDuration,
      imageUrls = [],
      location,
      category = 'Other',
      priority = 'MEDIUM',
    } = req.body;

    const rawOriginal = (originalText || description || '').trim();
    const langInfo = detectLanguage(rawOriginal);
    const resolvedLanguage = (language && language !== 'English') ? language : langInfo.language;
    const finalDescription = (description && description.trim().length > 0)
      ? description.trim()
      : (langInfo.normalizedText || rawOriginal);

    const parsedLat = location && (typeof location.latitude === 'number' ? location.latitude : parseFloat(location.latitude));
    const parsedLng = location && (typeof location.longitude === 'number' ? location.longitude : parseFloat(location.longitude));

    const safeLocation = {
      address: (location && location.address) ? String(location.address).trim() : 'Chennai Central, Tamil Nadu',
      latitude: (parsedLat !== undefined && !isNaN(parsedLat)) ? parsedLat : 13.0827,
      longitude: (parsedLng !== undefined && !isNaN(parsedLng)) ? parsedLng : 80.2707,
      ward: (location && location.ward) || '',
      zone: (location && location.zone) || '',
      landmark: (location && location.landmark) || '',
    };

    // Concurrency-resilient submission: retries on E11000 collision if two concurrent requests generate identical ID
    let newComplaint = null;
    let complaintId = null;
    let saved = false;
    let attempts = 0;

    while (!saved && attempts < 5) {
      attempts++;
      complaintId = await Complaint.generateComplaintId();

      newComplaint = new Complaint({
        complaintId,
        citizenId,
        citizenRef: req.user?._id || null,
        originalText: rawOriginal,
        description: finalDescription,
        language: resolvedLanguage,
        inputType,
        hasVoice,
        voiceUrl,
        voiceDuration,
        imageUrls,
        location: safeLocation,
        category,
        priority,
        status: 'SUBMITTED',
        workflowStage: 'SUBMITTED',
      });

      try {
        await newComplaint.save();
        saved = true;
      } catch (saveErr) {
        if (saveErr.code === 11000 && saveErr.keyPattern?.complaintId && attempts < 5) {
          console.warn(`[Complaint] Concurrent collision on complaintId ${complaintId}. Re-generating ID (attempt ${attempts + 1})...`);
          continue;
        }
        throw saveErr;
      }
    }

    // Log initial submission event
    await logEvent(
      complaintId,
      'COMPLAINT_SUBMITTED',
      `Complaint registered via Citizen Portal (${inputType}).`,
      { inputType, hasVoice, mediaCount: imageUrls.length },
      { type: 'citizen', id: citizenId, name: 'Citizen' }
    );

    // Asynchronously trigger AI pipeline
    setImmediate(() => {
      runAnalysisPipeline(complaintId).catch((err) =>
        console.error(`Pipeline trigger failed for ${complaintId}:`, err)
      );
    });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully and queued for AI analysis.',
      data: newComplaint,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints
 * Retrieve complaints with optional filtering
 */
async function getAllComplaints(req, res, next) {
  try {
    if (require('mongoose').connection.readyState !== 1) {
      const { MOCK_COMPLAINTS } = require('../services/mockData');
      return res.json({
        success: true,
        total: MOCK_COMPLAINTS.length,
        page: 1,
        limit: 50,
        data: MOCK_COMPLAINTS,
      });
    }

    const {
      citizenId,
      status,
      category,
      priority,
      ward,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (citizenId) filter.citizenId = citizenId;
    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.category = category;
    if (priority && priority !== 'all') filter.priority = priority;
    if (ward) filter['location.ward'] = ward;

    // RBAC: Role-based scoping for authenticated requests
    if (req.user) {
      if (req.user.role === 'department_supervisor' && req.user.departmentName) {
        // Supervisor views complaints in their assigned department
        filter['routing.departmentName'] = req.user.departmentName;
      } else if (req.user.role === 'department_employee') {
        // Employee views complaints assigned to them
        const assignedConditions = [];
        if (req.user.name) assignedConditions.push({ 'routing.assignedOfficerName': req.user.name });
        if (req.user.employeeId) {
          assignedConditions.push({ 'routing.assignedOfficerName': { $regex: req.user.employeeId, $options: 'i' } });
        }
        if (req.user._id) assignedConditions.push({ 'routing.assignedOfficerId': req.user._id });
        if (assignedConditions.length > 0) {
          filter.$or = assignedConditions;
        }
      } else if (req.user.role === 'citizen') {
        // Citizen requesting complaints MUST ONLY see their own complaints
        filter.citizenId = req.user.citizenId || '__UNASSIGNED_CITIZEN__';
      }
    } else {
      // Unauthenticated: Only allow filtering if a specific citizenId was queried; otherwise restrict platform dump
      if (citizenId) {
        filter.citizenId = citizenId;
      } else {
        filter.citizenId = '__REQUIRE_LOGIN__';
      }
    }

    if (search) {
      const searchConditions = [
        { complaintId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.landmark': { $regex: search, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions },
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Complaint.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data: complaints,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Checks whether an event is an internal/AI processing step
 * that should not be visible to citizen tracking.
 */
function isInternalAiEvent(event) {
  if (!event) return true;
  const eventType = (event.eventType || '').toUpperCase();
  const desc = (event.description || '').toLowerCase();
  const actorName = (event.actor?.name || '').toLowerCase();
  const actorType = (event.actor?.type || '').toLowerCase();

  // Internal AI pipeline event types
  const internalTypes = [
    'LLM_ANALYSIS_STARTED',
    'LLM_ANALYSIS_COMPLETED',
    'LLM_ANALYSIS_FAILED',
    'CATEGORY_ASSIGNED',
    'DUPLICATE_CHECK_STARTED',
    'DUPLICATE_CHECK_COMPLETED',
    'PRIORITY_PREDICTED',
    'ESCALATION_RISK_UPDATED',
    'RECURRING_ISSUE_FLAGGED',
    'RESOLUTION_VERIFICATION_STARTED',
    'RESOLUTION_VERIFICATION_COMPLETED',
    'TASK_SLA_PAUSED',
    'TASK_SLA_RESUMED',
    'TASK_ESCALATED',
    'SLA_BREACH',
  ];

  if (internalTypes.includes(eventType) || event.metadata?.internal === true) {
    return true;
  }

  // Intermediate status changes from background AI pipeline
  if (eventType === 'STATUS_CHANGED' || eventType === 'STATUS_UPDATED') {
    const prev = (event.previousStatus || event.metadata?.previousStatus || '').toUpperCase();
    const next = (event.newStatus || event.metadata?.newStatus || '').toUpperCase();
    const internalStages = ['UNDER_ANALYSIS', 'CATEGORIZED', 'PRIORITIZED'];
    if (internalStages.includes(prev) || internalStages.includes(next)) {
      return true;
    }
  }

  if (actorType === 'ai') return true;
  if (/\b(ai|llm)\b/i.test(actorName) || actorName.includes('pipeline') || actorName.includes('algorithm')) return true;

  const aiKeywords = [
    'ai pipeline',
    'ai analysis',
    'llm analysis',
    'ai processing',
    'ai classification',
    'ai verification',
    'ai scoring',
    'ai categorization',
    'ai prediction',
    'llm service',
    'under_analysis',
    'status updated to categorized',
    'status updated to prioritized',
  ];

  return /\b(ai|llm)\b/i.test(desc) || aiKeywords.some((kw) => desc.includes(kw));
}

/**
 * Transforms database workflow events into clean citizen-facing grievance lifecycle stages.
 */
function formatCitizenTimeline(events) {
  const citizenEvents = (events || []).filter((e) => !isInternalAiEvent(e));

  const formatted = [];
  let lastTitle = '';

  for (const e of citizenEvents) {
    const item = typeof e.toObject === 'function' ? e.toObject() : { ...e };
    const eventType = (item.eventType || '').toUpperCase();
    let title = 'Status Update';

    if (eventType === 'COMPLAINT_SUBMITTED') {
      title = 'Complaint Submitted';
    } else if (eventType === 'DEPARTMENT_ROUTED' || eventType === 'OFFICER_ASSIGNED') {
      title = 'Assigned to Department / Officer';
    } else if (eventType === 'PROGRESS_NOTE_ADDED') {
      title = 'Field Progress Update';
    } else if (eventType === 'RESOLUTION_SUBMITTED') {
      title = 'Resolution Submitted';
    } else if (eventType === 'CITIZEN_FEEDBACK_SUBMITTED') {
      title = 'Citizen Feedback Recorded';
    } else if (eventType === 'COMPLAINT_CLOSED') {
      title = 'Grievance Closed';
    } else if (eventType === 'COMPLAINT_REJECTED') {
      title = 'Complaint Rejected';
    } else if (eventType === 'STATUS_CHANGED' || eventType === 'STATUS_UPDATED') {
      const newStatus = (item.newStatus || item.metadata?.newStatus || '').toUpperCase();
      const descUpper = (item.description || '').toUpperCase();

      if (newStatus.includes('RESOLV') || newStatus.includes('VERIF') || descUpper.includes('TO "RESOLVED"') || descUpper.includes('TO RESOLVED')) {
        title = 'Resolved';
      } else if (newStatus.includes('IN_PROGRESS') || newStatus.includes('IN PROGRESS') || descUpper.includes('TO "IN PROGRESS"') || descUpper.includes('TO IN PROGRESS')) {
        title = 'In Progress';
      } else if (newStatus.includes('CLOSE') || descUpper.includes('TO "CLOSED"') || descUpper.includes('TO CLOSED')) {
        title = 'Closed';
      } else if (newStatus.includes('REJECT') || descUpper.includes('TO "REJECTED"')) {
        title = 'Complaint Rejected';
      } else if (newStatus.includes('UNDER_REVIEW') || newStatus.includes('UNDER REVIEW') || descUpper.includes('UNDER REVIEW') || descUpper.includes('UNDER_REVIEW')) {
        title = 'Complaint Received / Under Review';
      } else if (newStatus.includes('ASSIGN') || newStatus.includes('ROUT') || descUpper.includes('ASSIGNED') || descUpper.includes('ROUTED')) {
        title = 'Assigned to Department / Officer';
      } else {
        title = 'Status Update';
      }
    }

    // Deduplicate immediate adjacent duplicate titles (e.g. consecutive Assignment steps)
    if (title === lastTitle && (title === 'Assigned to Department / Officer' || title === 'Complaint Received / Under Review')) {
      if (item.description && item.description.length > formatted[formatted.length - 1].description.length) {
        formatted[formatted.length - 1].description = item.description;
      }
      continue;
    }

    lastTitle = title;
    formatted.push({
      ...item,
      title: item.title || title,
      step: formatted.length + 1,
    });
  }

  return formatted;
}

/**
 * GET /api/complaints/:id
 * Retrieve a single complaint by complaintId or Mongo _id
 */
async function getComplaintById(req, res, next) {
  try {
    const { id } = req.params;
    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const events = await WorkflowEvent.find({ complaintId: complaint.complaintId }).sort({
      createdAt: 1,
    });

    const complaintData = complaint.toObject();
    complaintData.timeline = formatCitizenTimeline(events);

    // Data Privacy: Redact internal administrative directives from unauthorized public viewers
    const isOwner = req.user && (
      req.user.citizenId === complaint.citizenId ||
      (complaint.citizenRef && complaint.citizenRef.toString() === req.user._id?.toString())
    );
    const isStaffOrAdmin = req.user && ['central_admin', 'department_supervisor', 'department_employee'].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
      delete complaintData.adminNotes;
      if (complaintData.adminApproval) {
        delete complaintData.adminApproval.adminNotes;
      }
    }

    res.json({ success: true, data: complaintData });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/:id/timeline
 * Get all workflow audit events for a complaint
 */
async function getComplaintTimeline(req, res, next) {
  try {
    const { id } = req.params;
    const events = await WorkflowEvent.find({ complaintId: id.trim() }).sort({
      createdAt: 1,
    });
    const citizenTimeline = formatCitizenTimeline(events);

    res.json({ success: true, count: citizenTimeline.length, data: citizenTimeline });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/resolution
 * Officer submits a resolution
 */
async function submitResolution(req, res, next) {
  try {
    const { id } = req.params;
    const {
      officerId,
      officerName = 'Field Supervisor',
      departmentName = 'Municipal Department',
      resolutionNotes,
      actionsTaken = [],
      evidenceUrls = [],
    } = req.body;

    const complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // RBAC: Verify department boundary for resolution submission
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Citizens cannot submit resolution reports.',
        });
      }
      if (req.user.role === 'department_supervisor' || req.user.role === 'department_employee') {
        const complaintDept = complaint.routing?.departmentName || complaint.department;
        if (complaintDept && req.user.departmentName && complaintDept.toLowerCase() !== req.user.departmentName.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Complaint belongs to "${complaintDept}", but your assigned department is "${req.user.departmentName}".`,
          });
        }
      }
      if (req.user.role === 'department_employee') {
        const assignedName = complaint.routing?.assignedOfficerName || '';
        const isAssigned =
          (assignedName && assignedName === req.user.name) ||
          (complaint.routing?.assignedOfficerId?.toString() === req.user._id?.toString()) ||
          (req.user.employeeId && assignedName.includes(req.user.employeeId));
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only submit resolutions for complaints assigned to you.',
          });
        }
      }
    }

    // Create resolution record
    const resolution = new Resolution({
      complaintId: complaint.complaintId,
      officerId,
      officerName,
      departmentName,
      resolutionNotes,
      actionsTaken,
      evidenceUrls,
      verificationStatus: 'pending',
    });
    await resolution.save();

    complaint.status = 'UNDER_VERIFICATION';
    complaint.workflowStage = 'UNDER_VERIFICATION';
    complaint.resolutionId = resolution._id;
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'RESOLUTION_SUBMITTED',
      `Resolution submitted by ${officerName}: "${resolutionNotes}"`,
      { resolutionId: resolution._id },
      { type: 'officer', id: officerId || 'officer', name: officerName }
    );

    // Run resolution verification
    const verification = await verifyResolution(
      complaint.description,
      resolutionNotes,
      complaint.category
    );

    resolution.verificationStatus = verification.verificationStatus;
    resolution.verificationScore = verification.verificationScore;
    resolution.verificationReason = verification.reason;
    resolution.verifierType = verification.verifierType;
    resolution.verifiedAt = new Date();
    resolution.knowledgeDocumentsUsed = verification.knowledgeDocumentsUsed || [];
    await resolution.save();

    const newStatus = verification.verified ? 'VERIFIED' : 'REQUIRES_REVIEW';
    complaint.status = newStatus;
    complaint.workflowStage = newStatus;
    if (verification.verified) {
      complaint.actualResolutionTime = new Date();
    }
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'RESOLUTION_VERIFICATION_COMPLETED',
      verification.reason,
      { ...verification }
    );

    res.json({
      success: true,
      message: `Resolution processed. Verification status: ${verification.verificationStatus}`,
      data: { complaint, resolution, verification },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/feedback
 * Citizen submits feedback rating & comment
 */
async function submitCitizenFeedback(req, res, next) {
  try {
    const { id } = req.params;
    const { rating, comment, tags = [] } = req.body;

    const complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const feedbackObj = {
      rating: Number(rating),
      comment,
      tags,
      submittedAt: new Date(),
    };

    complaint.feedback = feedbackObj;
    // Note: Feedback records citizen satisfaction without modifying workflow status;
    // final closure is strictly reserved for Central Admin via POST /api/complaints/:id/close
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'CITIZEN_FEEDBACK_SUBMITTED',
      `Citizen rated ${rating}★: "${comment || 'Feedback received'}"`,
      feedbackObj,
      { type: 'citizen', id: complaint.citizenId, name: 'Citizen' }
    );

    res.json({ success: true, message: 'Feedback submitted successfully', data: complaint });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/upvote
 * Upvote/attach citizen report to existing complaint
 */
async function upvoteComplaint(req, res, next) {
  try {
    const { id } = req.params;
    const { additionalNotes } = req.body;

    const complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.priorityScore = Math.min(99, (complaint.priorityScore || 60) + 10);
    complaint.priorityFactors = Array.from(
      new Set([...(complaint.priorityFactors || []), 'Multiple Citizen Reports / Upvoted'])
    );
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'SYSTEM_NOTE',
      `Complaint upvoted by citizen. Priority elevated to score ${complaint.priorityScore}.`,
      { additionalNotes }
    );

    res.json({ success: true, message: 'Complaint upvoted successfully', data: complaint });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/complaints/:id
 * Admin or Officer updates complaint fields (status, department, officer, priority, etc.)
 */
async function updateComplaint(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // RBAC: Verify permissions for modifying complaint
    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Citizens cannot modify grievance management fields.',
        });
      }
      if (req.user.role === 'department_supervisor') {
        const complaintDept = complaint.routing?.departmentName || complaint.department;
        if (complaintDept && req.user.departmentName && complaintDept.toLowerCase() !== req.user.departmentName.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You can only manage complaints within your department (${req.user.departmentName}).`,
          });
        }
      }
      if (req.user.role === 'department_employee') {
        const assignedName = complaint.routing?.assignedOfficerName || '';
        const isAssigned = (assignedName === req.user.name) ||
          (complaint.routing?.assignedOfficerId?.toString() === req.user._id.toString()) ||
          (req.user.employeeId && assignedName.includes(req.user.employeeId));
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only update complaints assigned to you.',
          });
        }
      }
    }

    const previousStatus = complaint.status;

    // Apply status update
    if (updates.status) {
      if (['CLOSED', 'Closed'].includes(updates.status)) {
        return res.status(400).json({
          success: false,
          message: 'Final complaint closure must be performed via POST /api/complaints/:id/close by Central Admin after all tasks are verified.',
        });
      }
      complaint.status = updates.status;
      complaint.workflowStage = updates.status;
      if (updates.status === 'Resolved' || updates.status === 'VERIFIED') {
        complaint.actualResolutionTime = new Date();
      }
    }

    // Apply department update
    if (updates.department) {
      if (req.user && req.user.role === 'department_employee') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Department employees cannot reassign departments.',
        });
      }
      complaint.routing = complaint.routing || {};
      complaint.routing.departmentName = updates.department;
      if (updates.category) complaint.category = updates.category;
    }

    // Apply assigned officer
    if (updates.assignedOfficer || updates.officerName) {
      if (req.user && req.user.role === 'department_employee') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Department employees cannot assign or reassign officers.',
        });
      }
      complaint.routing = complaint.routing || {};
      complaint.routing.assignedOfficerName = updates.assignedOfficer || updates.officerName;
    }

    // Apply priority
    if (updates.priority) {
      complaint.priority = String(updates.priority).toUpperCase();
    }

    // Apply resolution details if provided
    if (updates.resolution) {
      const resolution = new Resolution({
        complaintId: complaint.complaintId,
        officerName: updates.resolution.officerName || 'Field Team',
        departmentName: complaint.routing?.departmentName || 'Municipal Dept',
        resolutionNotes: updates.resolution.resolutionNotes || 'Resolved by municipal team.',
        evidenceUrls: updates.resolution.proofImageUrl ? [updates.resolution.proofImageUrl] : [],
        verificationStatus: 'verified',
        verifiedAt: new Date(),
      });
      await resolution.save();
      complaint.resolutionId = resolution._id;
    }

    // Apply admin notes
    if (updates.adminNotes) {
      complaint.priorityReason = updates.adminNotes;
    }

    // Apply escalation
    if (updates.escalated !== undefined) {
      complaint.escalationRisk = updates.escalated ? 'HIGH' : 'LOW';
      complaint.escalationLevel = updates.escalated ? 1 : 0;
    }

    await complaint.save();

    // Log timeline event for status or admin change
    const isStatusChanged = updates.status && updates.status !== previousStatus;
    const eventType = isStatusChanged ? 'STATUS_CHANGED' : 'SYSTEM_NOTE';
    const eventDesc = isStatusChanged
      ? `Complaint status updated from "${previousStatus}" to "${updates.status}".`
      : `Complaint details updated by Admin / Officer.`;

    await logEvent(
      complaint.complaintId,
      eventType,
      eventDesc,
      { previousStatus, newStatus: updates.status, updates },
      { type: 'admin', id: 'admin', name: updates.officerName || 'Municipal Admin' }
    );

    // Fetch updated timeline events
    const events = await WorkflowEvent.find({ complaintId: complaint.complaintId }).sort({
      createdAt: 1,
    });
    const data = complaint.toObject();
    data.timeline = formatCitizenTimeline(events);

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/approve
 * Central Admin approves/rejects/clarifies complaint and spawns department tasks.
 */
async function approveComplaintRouting(req, res, next) {
  try {
    const { id } = req.params;
    const {
      action = 'approve',
      primaryDepartment,
      supportingDepartments = [],
      priority,
      adminNotes = req.body.notes || '',
      rejectionReason = '',
    } = req.body;

    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const { createTasksForComplaint } = require('./taskController');

    if (action === 'reject') {
      complaint.status = 'REJECTED';
      complaint.workflowStage = 'REJECTED';
      complaint.adminApproval = {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.user?.name || 'Central Admin',
        reviewedById: req.user?._id,
        rejectionReason: rejectionReason || adminNotes || 'Grievance rejected upon administrative review.',
      };
      await complaint.save();

      await logEvent(
        complaint.complaintId,
        'COMPLAINT_REJECTED',
        `Complaint rejected by Central Admin: "${rejectionReason || adminNotes || 'Not actionable'}"`,
        { rejectionReason: rejectionReason || adminNotes },
        { type: 'admin', id: req.user?._id, name: req.user?.name || 'Central Admin' }
      );

      return res.json({
        success: true,
        message: 'Complaint rejected successfully.',
        data: complaint,
      });
    }

    if (action === 'request_clarification' || action === 'clarification') {
      complaint.status = 'CLARIFICATION_REQUIRED';
      complaint.workflowStage = 'CLARIFICATION_REQUIRED';
      complaint.adminApproval = {
        status: 'clarification_required',
        reviewedAt: new Date(),
        reviewedBy: req.user?.name || 'Central Admin',
        reviewedById: req.user?._id,
        adminNotes,
      };
      await complaint.save();

      await logEvent(
        complaint.complaintId,
        'CLARIFICATION_REQUESTED',
        `Central Admin requested clarification: "${adminNotes}"`,
        { adminNotes },
        { type: 'admin', id: req.user?._id, name: req.user?.name || 'Central Admin' }
      );

      return res.json({
        success: true,
        message: 'Clarification requested from citizen.',
        data: complaint,
      });
    }

    // Default: 'approve'
    const normPrimary = typeof primaryDepartment === 'string'
      ? { departmentName: primaryDepartment }
      : primaryDepartment;
    const normSupporting = Array.isArray(supportingDepartments)
      ? supportingDepartments.map((s) => (typeof s === 'string' ? { departmentName: s } : s))
      : [];

    if (!normPrimary || !normPrimary.departmentName) {
      return res.status(400).json({
        success: false,
        message: 'A valid primary department must be specified for complaint approval.',
      });
    }

    complaint.priority = priority || complaint.priority || 'MEDIUM';
    complaint.adminApproval = {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: req.user?.name || 'Central Admin',
      reviewedById: req.user?._id,
      adminNotes,
    };

    complaint.departments = {
      primary: normPrimary,
      supporting: normSupporting,
    };

    complaint.routing = complaint.routing || {};
    complaint.routing.departmentName = normPrimary.departmentName;
    if (normPrimary.departmentId) {
      complaint.routing.departmentId = normPrimary.departmentId;
    }

    complaint.status = 'DEPARTMENT_ASSIGNMENT';
    complaint.workflowStage = 'DEPARTMENT_ASSIGNMENT';

    // Spawn Department Tasks (1 Primary + N Supporting)
    const tasks = await createTasksForComplaint(
      complaint,
      normPrimary,
      normSupporting,
      complaint.priority,
      req.user
    );

    complaint.taskCount = tasks.length;
    complaint.tasksCompleted = 0;
    await complaint.save();

    const supportingNames = normSupporting.map((s) => s.departmentName).join(', ');
    await logEvent(
      complaint.complaintId,
      'COMPLAINT_APPROVED',
      `Central Admin approved complaint. Dispatched ${tasks.length} task(s): Primary (${primaryDepartment.departmentName})${supportingNames ? `, Supporting (${supportingNames})` : ''}.`,
      {
        primaryDepartment: primaryDepartment.departmentName,
        supportingDepartments: supportingNames,
        taskCount: tasks.length,
        priority: complaint.priority,
      },
      { type: 'admin', id: req.user?._id, name: req.user?.name || 'Central Admin' }
    );

    await notifyCitizen(
      complaint.citizenId,
      complaint.complaintId,
      `Grievance ${complaint.complaintId} Approved & Dispatched`,
      `Your grievance has been approved and dispatched to ${primaryDepartment.departmentName}.`,
      'assigned',
      { userId: complaint.citizenRef }
    );

    res.json({
      success: true,
      message: `Complaint approved and ${tasks.length} department task(s) dispatched.`,
      data: {
        complaint,
        tasks,
        taskCount: tasks.length,
        status: complaint.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/close
 * Central Admin finalizes complaint closure after all tasks are verified.
 */
async function closeComplaint(req, res, next) {
  try {
    const { id } = req.params;

    // RBAC: Central Admin only final closure
    if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Central Admin can perform final complaint closure.',
      });
    }

    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const ComplaintTask = require('../models/ComplaintTask');
    const tasks = await ComplaintTask.find({ complaintId: complaint.complaintId });

    if (tasks.length > 0) {
      const unverifiedTasks = tasks.filter((t) => !['VERIFIED', 'COMPLETED'].includes(t.status));
      if (unverifiedTasks.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot close complaint: ${unverifiedTasks.length} department task(s) are still pending resolution or verification.`,
          unverifiedTasks: unverifiedTasks.map((t) => ({ taskId: t.taskId, department: t.departmentName, status: t.status })),
        });
      }
    }

    complaint.status = 'CLOSED';
    complaint.workflowStage = 'CLOSED';
    complaint.actualResolutionTime = new Date();
    complaint.closedAt = new Date();
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'COMPLAINT_CLOSED',
      `Complaint successfully closed following verified resolution of all department tasks.`,
      { closedBy: req.user?.name || 'Central Admin', closedAt: new Date() },
      { type: 'admin', id: req.user?._id, name: req.user?.name || 'Central Admin' }
    );

    await notifyCitizen(
      complaint.citizenId,
      complaint.complaintId,
      `Grievance ${complaint.complaintId} Resolved & Closed`,
      `Your complaint regarding "${complaint.category}" has been verified and closed. Please provide your feedback and rating.`,
      'closed'
    );

    res.json({
      success: true,
      message: 'Complaint closed successfully. Notification sent to citizen.',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/reopen
 * Citizen or Admin reopens a complaint if resolution was incomplete or recurring.
 */
async function reopenComplaint(req, res, next) {
  try {
    const { id } = req.params;
    const { reason = 'Issue persists or was not properly addressed.' } = req.body;
    const cleanReason = (typeof reason === 'string' && reason.trim().length > 0)
      ? reason.trim()
      : 'Issue persists or was not properly addressed.';

    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Must be in a terminal or resolved state to reopen
    if (!['RESOLVED', 'CLOSED', 'PARTIALLY_RESOLVED', 'VERIFIED'].includes(complaint.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reopen complaint in "${complaint.status}" state. Reopening is permitted only on resolved or closed complaints.`,
      });
    }

    const ComplaintTask = require('../models/ComplaintTask');
    const Notification = require('../models/Notification');
    const tasks = await ComplaintTask.find({ complaintId: complaint.complaintId });

    let reopenedTasksCount = 0;
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const previousTaskStatus = task.status;
        const isAssigned = Boolean(task.assignedEmployeeId || task.assignedEmployeeName);

        // If employee is assigned, set to REQUIRES_ADDITIONAL_WORK so the employee
        // receives it directly with rework instructions and can resubmit resolution.
        // If unassigned, set to PENDING_ASSIGNMENT so supervisor can assign an officer.
        const newTaskStatus = isAssigned ? 'REQUIRES_ADDITIONAL_WORK' : 'PENDING_ASSIGNMENT';
        task.status = newTaskStatus;
        task.completedAt = null;

        if (task.resolution) {
          task.resolution.verificationStatus = 'requires_review';
        }

        task.progressNotes = task.progressNotes || [];
        task.progressNotes.push({
          note: `Complaint reopened by ${req.user?.name || 'Citizen'}: "${cleanReason}"`,
          authorId: req.user?._id,
          authorName: req.user?.name || 'Citizen',
          authorRole: req.user?.role || 'citizen',
          createdAt: new Date(),
        });

        await task.save();
        reopenedTasksCount++;

        // Log task-level event
        await logEvent(
          complaint.complaintId,
          'TASK_REWORK_REQUESTED',
          `Task "${task.title}" (${task.departmentName}) restored to ${newTaskStatus} for rework following grievance reopening: "${cleanReason}".`,
          {
            taskId: task.taskId,
            departmentName: task.departmentName,
            previousStatus: previousTaskStatus,
            newStatus: newTaskStatus,
            reason: cleanReason,
          },
          { type: req.user?.role || 'citizen', id: req.user?._id, name: req.user?.name || 'Citizen' }
        );

        // Notify assigned employee if assigned
        if (task.assignedEmployeeId) {
          try {
            await Notification.create({
              citizenId: complaint.citizenId,
              userId: task.assignedEmployeeId,
              recipientRole: 'department_employee',
              complaintId: complaint.complaintId,
              taskId: task.taskId,
              title: `Task Reopened - ${task.taskId}`,
              message: `Grievance ${complaint.complaintId} was reopened: "${cleanReason}". Please re-inspect and submit revised resolution.`,
              type: 'status_change',
            });
          } catch (notifErr) {
            console.warn('Failed to notify assigned employee:', notifErr.message);
          }
        }
      }
    }

    complaint.status = 'REOPENED';
    complaint.workflowStage = 'REOPENED';
    complaint.tasksCompleted = 0;
    complaint.reopenedAt = new Date();
    complaint.reopenReason = cleanReason;
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'COMPLAINT_REOPENED',
      `Grievance reopened: "${cleanReason}". ${reopenedTasksCount} task(s) restored for rework.`,
      { reason: cleanReason, tasksReopened: reopenedTasksCount, reopenedBy: req.user?.name || 'Citizen' },
      { type: req.user?.role || 'citizen', id: req.user?._id, name: req.user?.name || 'Citizen' }
    );

    // Notify citizen
    await notifyCitizen(
      complaint.citizenId,
      complaint.complaintId,
      `Grievance ${complaint.complaintId} Reopened`,
      `Your grievance regarding "${complaint.category}" has been reopened and returned to the department for rework.`,
      'status_change',
      { userId: complaint.citizenRef }
    );

    res.json({
      success: true,
      message: `Complaint reopened successfully and ${reopenedTasksCount} department task(s) restored for rework.`,
      data: {
        complaint,
        tasksReopened: reopenedTasksCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints/:id/clarification
 * Citizen responds to a clarification request from Central Admin
 */
async function respondToClarification(req, res, next) {
  try {
    const { id } = req.params;
    const clarificationText = req.body.clarificationText || req.body.responseNotes;
    const additionalImageUrls = req.body.additionalImageUrls || [];

    if (!clarificationText || clarificationText.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Clarification response must be at least 5 characters.',
      });
    }

    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Require authentication if complaint belongs to an identified citizen
    if (complaint.citizenId || complaint.citizenRef) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required to respond to clarification.' });
      }
    }

    // Verify ownership if authenticated as citizen
    if (req.user && req.user.role === 'citizen') {
      let isOwner = false;
      if (complaint.citizenRef && req.user._id) {
        isOwner = complaint.citizenRef.toString() === req.user._id.toString();
      } else if (complaint.citizenId && req.user.citizenId) {
        isOwner = complaint.citizenId === req.user.citizenId;
      }
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied: You do not own this complaint.' });
      }
    }

    // Check that complaint is awaiting clarification
    const isClarificationState =
      complaint.status === 'CLARIFICATION_REQUIRED' ||
      complaint.adminApproval?.status === 'clarification_required';

    if (!isClarificationState) {
      return res.status(400).json({
        success: false,
        message: `Complaint is currently in "${complaint.status}" status, not awaiting clarification.`,
      });
    }

    complaint.clarificationResponse = {
      responseNotes: clarificationText.trim(),
      additionalImageUrls: Array.isArray(additionalImageUrls) ? additionalImageUrls : [],
      respondedAt: new Date(),
    };

    // Transition complaint back to AWAITING_ADMIN_REVIEW for triage
    complaint.status = 'AWAITING_ADMIN_REVIEW';
    complaint.workflowStage = 'AWAITING_ADMIN_REVIEW';
    if (complaint.adminApproval) {
      complaint.adminApproval.status = 'pending';
    }
    await complaint.save();

    await logEvent(
      complaint.complaintId,
      'CLARIFICATION_PROVIDED',
      `Citizen provided requested clarification: "${clarificationText.trim()}"`,
      { clarificationText: clarificationText.trim() },
      { type: 'citizen', id: req.user?._id || complaint.citizenRef || null, name: req.user?.name || 'Citizen' }
    );

    res.json({
      success: true,
      message: 'Clarification submitted successfully. Grievance returned to Central Admin for triage.',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/:id/tasks
 * Retrieve department tasks associated with a complaint (safe view for citizen & staff).
 */
async function getComplaintTasks(req, res, next) {
  try {
    const { id } = req.params;
    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const ComplaintTask = require('../models/ComplaintTask');
    const tasks = await ComplaintTask.find({ complaintId: complaint.complaintId }).sort({ taskType: 1, createdAt: 1 });

    // Sanitize for public / citizen view
    const isStaffOrAdmin = req.user && ['central_admin', 'department_supervisor', 'department_employee'].includes(req.user.role);

    const safeTasks = tasks.map((t) => {
      const obj = t.toObject();
      if (!isStaffOrAdmin) {
        // Redact internal employee IDs, internal rubric scores, or sensitive notes for citizen privacy
        delete obj.assignedSupervisorId;
        delete obj.assignedEmployeeId;
        delete obj.pauseHistory;
        delete obj.delayRisk;
        if (obj.resolution) {
          delete obj.resolution.automatedAssessment;
          delete obj.resolution.supervisorReview;
        }
        if (Array.isArray(obj.resolutionHistory)) {
          obj.resolutionHistory = obj.resolutionHistory.map((rh) => {
            const safeRh = { ...rh };
            delete safeRh.automatedAssessment;
            delete safeRh.supervisorReview;
            return safeRh;
          });
        }
      }
      return obj;
    });

    res.json({
      success: true,
      count: safeTasks.length,
      data: safeTasks,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/:id/knowledge
 * Retrieve grounded municipal knowledge & SOP guidance for this complaint.
 */
async function getComplaintKnowledge(req, res, next) {
  try {
    const { id } = req.params;
    let complaint = await Complaint.findOne({ complaintId: id.trim() });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const { retrieveRelevantKnowledge } = require('../services/ragService');
    const userRole = req.user?.role || 'citizen';
    const userDept = req.user?.departmentName || '';

    const guidance = await retrieveRelevantKnowledge({
      category: complaint.category,
      subcategory: complaint.aiAnalysis?.subcategory || '',
      description: complaint.description || complaint.originalText || '',
      issue: complaint.category,
      department: complaint.routing?.departmentName || '',
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

module.exports = {
  createComplaint,
  getAllComplaints,
  getComplaintById,
  getComplaintTimeline,
  submitResolution,
  submitCitizenFeedback,
  upvoteComplaint,
  updateComplaint,
  approveComplaintRouting,
  closeComplaint,
  reopenComplaint,
  respondToClarification,
  getComplaintTasks,
  getComplaintKnowledge,
};
