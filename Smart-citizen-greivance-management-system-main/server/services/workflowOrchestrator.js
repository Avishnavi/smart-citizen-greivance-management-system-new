'use strict';

/**
 * Workflow Orchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 * Coordinates the entire complaint processing pipeline:
 *  1. LLM Analysis (stub)
 *  2. Categorization
 *  3. Duplicate Detection
 *  4. Priority Prediction
 *  5. Department Routing
 *  6. Escalation Assessment
 *  7. Recurring Issue Detection
 *
 * Each step is non-blocking. Failures are logged but don't break the pipeline.
 * All steps create immutable WorkflowEvent records.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Complaint = require('../models/Complaint');
const WorkflowEvent = require('../models/WorkflowEvent');
const Notification = require('../models/Notification');

const llmService = require('./llmService');
const categorizationService = require('./categorizationService');
const duplicateDetectionService = require('./duplicateDetectionService');
const priorityService = require('./priorityService');
const routingService = require('./routingService');
const escalationService = require('./escalationService');
const recurringIssueService = require('./recurringIssueService');

// ─── Helper: create immutable workflow event ──────────────────────────────────

async function logEvent(complaintId, eventType, description, metadata = {}, actor = {}) {
  try {
    await WorkflowEvent.create({
      complaintId,
      eventType,
      description,
      metadata,
      actor: { type: 'system', id: 'system', name: 'AI Pipeline', ...actor },
    });
  } catch (err) {
    console.error(`Failed to log event ${eventType} for ${complaintId}:`, err.message);
  }
}

async function updateComplaintStatus(complaintId, fromStatus, toStatus, updateData = {}) {
  const complaint = await Complaint.findOneAndUpdate(
    { complaintId },
    { status: toStatus, workflowStage: toStatus, ...updateData },
    { new: true }
  );
  await logEvent(
    complaintId,
    'STATUS_CHANGED',
    `Status updated from ${fromStatus} to ${toStatus}`,
    { previousStatus: fromStatus, newStatus: toStatus },
  );
  return complaint;
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function notifyCitizen(citizenId, complaintId, title, message, type = 'status_change') {
  try {
    await Notification.create({ citizenId, complaintId, title, message, type });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full AI analysis pipeline on a newly submitted complaint.
 * This runs ASYNCHRONOUSLY after the HTTP response is sent.
 * @param {string} complaintId - The complaint's string ID (e.g. CMP-2026-001001)
 */
async function runAnalysisPipeline(complaintId) {
  console.log(`\n🔄 [Pipeline] Starting for ${complaintId}`);

  try {
    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) {
      console.error(`[Pipeline] Complaint ${complaintId} not found in DB`);
      return;
    }

    // ── Step 1: Mark analysis started ────────────────────────────────────────
    await updateComplaintStatus(complaintId, 'SUBMITTED', 'UNDER_ANALYSIS');
    await logEvent(complaintId, 'LLM_ANALYSIS_STARTED', 'AI pipeline initiated. Analysing complaint text and media.');

    // ── Step 2: LLM Analysis (stub) ──────────────────────────────────────────
    let llmResult;
    try {
      llmResult = await llmService.analyzeComplaint(complaint.originalText, complaint.imageUrls);
      complaint.llmAnalysis = {
        status: llmResult.status,
        provider: llmResult.provider,
        processedAt: new Date(),
      };
      await logEvent(
        complaintId,
        llmResult.status === 'completed' ? 'LLM_ANALYSIS_COMPLETED' : 'LLM_ANALYSIS_FAILED',
        llmResult.status === 'completed'
          ? 'LLM analysis completed successfully.'
          : `LLM service: ${llmResult.message}`,
        { llmStatus: llmResult.status, provider: llmResult.provider }
      );
    } catch (err) {
      console.error(`[Pipeline] LLM analysis error for ${complaintId}:`, err.message);
    }

    // ── Step 3: Categorization ────────────────────────────────────────────────
    let category = complaint.category || 'Other';
    let department = null;
    try {
      const catResult = await categorizationService.categorizeComplaint(
        complaint.originalText,
        complaint.imageUrls
      );
      category = catResult.category;
      department = catResult.department;

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          category,
          categorizationStatus: 'completed',
          'llmAnalysis.summary': catResult.aiSummary,
        }
      );
      await logEvent(
        complaintId,
        'CATEGORY_ASSIGNED',
        `Category: "${category}", Department: "${department}" (${catResult.method}, ${Math.round(catResult.confidence * 100)}% confidence)`,
        { category, department, confidence: catResult.confidence, method: catResult.method }
      );
      await updateComplaintStatus(complaintId, 'UNDER_ANALYSIS', 'CATEGORIZED');
    } catch (err) {
      console.error(`[Pipeline] Categorization error for ${complaintId}:`, err.message);
    }

    // ── Step 4: Duplicate Detection ───────────────────────────────────────────
    try {
      const recentComplaints = await Complaint.find({
        complaintId: { $ne: complaintId },
        status: { $nin: ['CLOSED', 'REJECTED'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }).limit(50);

      const dupResult = await duplicateDetectionService.checkDuplicate(
        complaint.originalText,
        complaint.location,
        recentComplaints
      );

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          'duplicateAnalysis.isDuplicate': dupResult.isDuplicate,
          'duplicateAnalysis.status': 'checked',
          'duplicateAnalysis.similarityScore': dupResult.similarityScore || 0,
          'duplicateAnalysis.distanceMeters': dupResult.distanceMeters,
          ...(dupResult.similarComplaintId && {
            'duplicateAnalysis.duplicateComplaintIds': [dupResult.similarComplaintId],
          }),
        }
      );
      await logEvent(
        complaintId,
        'DUPLICATE_CHECK_COMPLETED',
        dupResult.isDuplicate
          ? `Potential duplicate of ${dupResult.similarComplaintId} (${Math.round((dupResult.similarityScore || 0) * 100)}% similarity, ${dupResult.distanceMeters}m away)`
          : 'No duplicate found.',
        { ...dupResult, method: dupResult.method }
      );
    } catch (err) {
      console.error(`[Pipeline] Duplicate detection error for ${complaintId}:`, err.message);
    }

    // ── Step 5: Priority Prediction ───────────────────────────────────────────
    let priorityResult;
    try {
      const freshComplaint = await Complaint.findOne({ complaintId });
      priorityResult = await priorityService.predictPriority(
        freshComplaint?.category || category,
        complaint.originalText,
        complaint.location,
        complaint.hasVoice || (complaint.imageUrls?.length > 0)
      );

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          priority: priorityResult.priority,
          priorityScore: priorityResult.score,
          priorityFactors: priorityResult.factors,
          priorityReason: priorityResult.factors.join('; '),
          priorityStatus: 'completed',
        }
      );
      await logEvent(
        complaintId,
        'PRIORITY_PREDICTED',
        `Priority: ${priorityResult.priority} (score: ${priorityResult.score}). Factors: ${priorityResult.factors.join(', ')}`,
        { ...priorityResult }
      );
      await updateComplaintStatus(complaintId, 'CATEGORIZED', 'PRIORITIZED');
    } catch (err) {
      console.error(`[Pipeline] Priority prediction error for ${complaintId}:`, err.message);
    }

    // ── Step 6: Department Routing ────────────────────────────────────────────
    try {
      const routingResult = await routingService.routeComplaint(category);
      const updateFields = {
        'routing.departmentName': routingResult.departmentName,
        'routing.routingReason': routingResult.routingReason,
      };
      if (routingResult.departmentId) {
        updateFields['routing.departmentId'] = routingResult.departmentId;
      }
      if (routingResult.assignedOfficerId) {
        updateFields['routing.assignedOfficerId'] = routingResult.assignedOfficerId;
        updateFields['routing.assignedOfficerName'] = routingResult.assignedOfficerName;
        updateFields['routing.routedAt'] = new Date();
      }
      await Complaint.findOneAndUpdate({ complaintId }, updateFields);

      await logEvent(
        complaintId,
        'DEPARTMENT_ROUTED',
        `Routed to "${routingResult.departmentName}". Officer: ${routingResult.assignedOfficerName}.`,
        { ...routingResult }
      );
      await updateComplaintStatus(
        complaintId,
        'PRIORITIZED',
        routingResult.assignedOfficerId ? 'ASSIGNED' : 'ROUTED'
      );

      // Notify citizen
      await notifyCitizen(
        complaint.citizenId,
        complaintId,
        `Complaint ${complaintId} Assigned`,
        `Your ${category} complaint has been routed to ${routingResult.departmentName}. Officer: ${routingResult.assignedOfficerName}.`,
        'assigned'
      );
    } catch (err) {
      console.error(`[Pipeline] Routing error for ${complaintId}:`, err.message);
    }

    // ── Step 7: Escalation Assessment ────────────────────────────────────────
    try {
      const finalComplaint = await Complaint.findOne({ complaintId });
      if (finalComplaint) {
        const escalation = await escalationService.assessEscalationRisk(finalComplaint);
        await escalationService.saveEscalation(finalComplaint, escalation);
        await Complaint.findOneAndUpdate(
          { complaintId },
          { escalationRisk: escalation.escalationRisk, escalationLevel: escalation.escalationLevel }
        );
        if (['HIGH', 'CRITICAL'].includes(escalation.escalationRisk)) {
          await logEvent(
            complaintId,
            'ESCALATION_RISK_UPDATED',
            `Escalation risk: ${escalation.escalationRisk}. ${escalation.reasons[0] || ''}`,
            { ...escalation }
          );
        }
      }
    } catch (err) {
      console.error(`[Pipeline] Escalation error for ${complaintId}:`, err.message);
    }

    // ── Step 8: Recurring Issue Detection ────────────────────────────────────
    try {
      const finalComplaint = await Complaint.findOne({ complaintId });
      if (finalComplaint) {
        const recurringIssue = await recurringIssueService.detectRecurringIssue(finalComplaint);
        if (recurringIssue) {
          await Complaint.findOneAndUpdate(
            { complaintId },
            { recurringIssueId: recurringIssue._id }
          );
          await logEvent(
            complaintId,
            'RECURRING_ISSUE_FLAGGED',
            `Recurring issue pattern detected: ${recurringIssue.occurrenceCount} occurrences in ${finalComplaint.location.ward} (${category}).`,
            {
              recurringIssueId: recurringIssue._id,
              occurrenceCount: recurringIssue.occurrenceCount,
              severity: recurringIssue.severity,
            }
          );
        }
      }
    } catch (err) {
      console.error(`[Pipeline] Recurring issue detection error for ${complaintId}:`, err.message);
    }

    console.log(`✅ [Pipeline] Completed for ${complaintId}`);
  } catch (err) {
    console.error(`❌ [Pipeline] Fatal error for ${complaintId}:`, err.message);
    await logEvent(
      complaintId,
      'SYSTEM_NOTE',
      `Pipeline encountered an error: ${err.message}`,
      { error: err.message }
    );
  }
}

module.exports = { runAnalysisPipeline, logEvent, notifyCitizen, updateComplaintStatus };
