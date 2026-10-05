'use strict';

const Complaint = require('../models/Complaint');
const WorkflowEvent = require('../models/WorkflowEvent');
const Resolution = require('../models/Resolution');
const { runAnalysisPipeline, logEvent } = require('../services/workflowOrchestrator');
const { verifyResolution } = require('../services/resolutionVerificationService');

/**
 * POST /api/complaints
 * Register a new civic complaint
 */
async function createComplaint(req, res, next) {
  try {
    const {
      citizenId = 'CIT-8842',
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

    const complaintId = await Complaint.generateComplaintId();

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

    const newComplaint = new Complaint({
      complaintId,
      citizenId,
      originalText: originalText || description,
      description,
      language,
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

    await newComplaint.save();

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

    if (search) {
      filter.$or = [
        { complaintId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.landmark': { $regex: search, $options: 'i' } },
      ];
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
    complaint.status = 'CLOSED';
    complaint.workflowStage = 'CLOSED';
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

    const previousStatus = complaint.status;

    // Apply status update
    if (updates.status) {
      complaint.status = updates.status;
      complaint.workflowStage = updates.status;
      if (updates.status === 'Resolved' || updates.status === 'VERIFIED') {
        complaint.actualResolutionTime = new Date();
      }
    }

    // Apply department update
    if (updates.department) {
      complaint.routing = complaint.routing || {};
      complaint.routing.departmentName = updates.department;
      if (updates.category) complaint.category = updates.category;
    }

    // Apply assigned officer
    if (updates.assignedOfficer || updates.officerName) {
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

module.exports = {
  createComplaint,
  getAllComplaints,
  getComplaintById,
  getComplaintTimeline,
  submitResolution,
  submitCitizenFeedback,
  upvoteComplaint,
  updateComplaint,
};
