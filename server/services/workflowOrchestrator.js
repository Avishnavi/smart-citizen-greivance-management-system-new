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
    const taskId = metadata?.taskId || null;
    await WorkflowEvent.create({
      complaintId,
      taskId,
      eventType,
      description,
      metadata,
      actor: { type: 'system', id: 'system', name: 'Municipal System', ...actor },
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
  // Only broadcast citizen-meaningful status changes (never internal intermediate AI states)
  const internalStages = ['UNDER_ANALYSIS', 'CATEGORIZED', 'PRIORITIZED'];
  if (!internalStages.includes(toStatus)) {
    let description = `Status updated to ${toStatus}`;
    if (toStatus === 'UNDER_REVIEW') description = 'Complaint received and under review by municipal administration.';
    if (toStatus === 'ASSIGNED') description = 'Complaint assigned to department for field resolution.';
    await logEvent(
      complaintId,
      'STATUS_CHANGED',
      description,
      { previousStatus: fromStatus, newStatus: toStatus },
      { type: 'system', id: 'triage', name: 'Municipal Triage' }
    );
  }
  return complaint;
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function notifyCitizen(citizenId, complaintId, title, message, type = 'status_change', extra = {}) {
  try {
    await Notification.create({
      citizenId,
      complaintId,
      title,
      message,
      type,
      userId: extra.userId || null,
      recipientRole: extra.recipientRole || 'citizen',
      taskId: extra.taskId || null,
    });
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

    // ── Step 1: Mark review started ──────────────────────────────────────────
    await updateComplaintStatus(complaintId, 'SUBMITTED', 'UNDER_REVIEW');
    await logEvent(complaintId, 'LLM_ANALYSIS_STARTED', 'Internal automated analysis initiated.', { internal: true });

    // ── Step 2: LLM Analysis (M2) ──────────────────────────────────────────
    let llmResult;
    try {
      llmResult = await llmService.analyzeComplaint(complaint.description || complaint.originalText, complaint.imageUrls);
      const llmFields = {
        status: llmResult.status,
        provider: llmResult.provider,
        method: llmResult.method,
        processedAt: new Date(),
      };
      if (llmResult.result) {
        Object.assign(llmFields, {
          summary: llmResult.result.summary,
          issueType: llmResult.result.issueType,
          affectedService: llmResult.result.affectedService,
          requestedAction: llmResult.result.requestedAction,
          extractedLocation: llmResult.result.extractedLocation,
          urgencyIndicators: llmResult.result.urgencyIndicators,
          extractedEntities: llmResult.result.extractedEntities,
          contextualDetails: llmResult.result.contextualDetails,
          confidence: llmResult.result.confidence,
        });
      }

      await Complaint.findOneAndUpdate({ complaintId }, { llmAnalysis: llmFields });

      await logEvent(
        complaintId,
        'LLM_ANALYSIS_COMPLETED',
        llmResult.method === 'llm'
          ? 'LLM semantic analysis completed successfully.'
          : 'Processed via transparent civic understanding fallback parser.',
        { llmStatus: llmResult.status, method: llmResult.method, provider: llmResult.provider, internal: true }
      );
    } catch (err) {
      console.error(`[Pipeline] LLM analysis error for ${complaintId}:`, err.message);
      await Complaint.findOneAndUpdate(
        { complaintId },
        { 'llmAnalysis.status': 'failed', 'llmAnalysis.error': err.message }
      );
      await logEvent(
        complaintId,
        'LLM_ANALYSIS_FAILED',
        `LLM analysis module failed: ${err.message}. Downstream processing continuing with raw text.`,
        { error: err.message, internal: true }
      );
    }

    // ── Step 3: Categorization (M3) ─────────────────────────────────────────
    let category = complaint.category || 'Other';
    let subcategory = '';
    let catResult = null;
    try {
      catResult = await categorizationService.categorizeComplaint(
        complaint.description || complaint.originalText,
        complaint.imageUrls
      );
      category = catResult.category;
      subcategory = catResult.subcategory;

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          category,
          subcategory,
          categorizationStatus: catResult.isAmbiguous ? 'manual' : 'completed',
          'llmAnalysis.summary': catResult.aiSummary,
        }
      );
      await logEvent(
        complaintId,
        'CATEGORY_ASSIGNED',
        `Category: "${category}" (${subcategory}) [Confidence: ${catResult.confidence}]. ${catResult.isAmbiguous ? 'Ambiguous: Flagged for Central Admin review.' : ''}`,
        {
          category,
          subcategory,
          confidence: catResult.confidence,
          confidenceType: catResult.confidenceType,
          isAmbiguous: catResult.isAmbiguous,
          explanation: catResult.explanation,
          method: catResult.method,
          internal: true,
        }
      );
    } catch (err) {
      console.error(`[Pipeline] Categorization error for ${complaintId}:`, err.message);
      category = 'Other';
      subcategory = 'Unspecified Civic Grievance';
      await Complaint.findOneAndUpdate(
        { complaintId },
        { category: 'Other', subcategory, categorizationStatus: 'failed' }
      );
      await logEvent(
        complaintId,
        'CATEGORY_ASSIGNMENT_FAILED',
        `Categorization failed: ${err.message}. Set to "Other" pending Central Admin review.`,
        { error: err.message, internal: true }
      );
    }

    // ── Step 4: Duplicate Detection (M4) ────────────────────────────────────
    try {
      const recentComplaints = await Complaint.find({
        complaintId: { $ne: complaintId },
        status: { $nin: ['CLOSED', 'REJECTED'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }).limit(50);

      const dupResult = await duplicateDetectionService.checkDuplicate(
        complaint.description || complaint.originalText,
        complaint.location,
        recentComplaints,
        { category, subcategory, currentComplaintId: complaintId }
      );

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          'duplicateAnalysis.isDuplicate': dupResult.isDuplicate,
          'duplicateAnalysis.duplicateLevel': dupResult.duplicateLevel,
          'duplicateAnalysis.status': 'checked',
          'duplicateAnalysis.similarityScore': dupResult.similarityScore || 0,
          'duplicateAnalysis.distanceMeters': dupResult.distanceMeters,
          'duplicateAnalysis.reason': dupResult.reason,
          'duplicateAnalysis.duplicateComplaintIds': dupResult.similarComplaintId
            ? [dupResult.similarComplaintId]
            : [],
        }
      );
      await logEvent(
        complaintId,
        'DUPLICATE_CHECK_COMPLETED',
        dupResult.isDuplicate
          ? `Potential duplicate of ${dupResult.similarComplaintId} (${Math.round((dupResult.similarityScore || 0) * 100)}% lexical match, ${dupResult.distanceMeters}m away). Forwarded to Admin.`
          : (dupResult.duplicateLevel === 'related'
            ? `Related issue ${dupResult.similarComplaintId} noted in vicinity. Retained as distinct complaint.`
            : 'No duplicate found within threshold radius.'),
        { ...dupResult, method: dupResult.method, internal: true }
      );
    } catch (err) {
      console.error(`[Pipeline] Duplicate detection error for ${complaintId}:`, err.message);
      await Complaint.findOneAndUpdate(
        { complaintId },
        { 'duplicateAnalysis.status': 'failed', 'duplicateAnalysis.isDuplicate': false }
      );
      await logEvent(
        complaintId,
        'DUPLICATE_CHECK_FAILED',
        `Duplicate check module failed: ${err.message}. Complaint retained as distinct.`,
        { error: err.message, internal: true }
      );
    }

    // ── Step 5: Priority Prediction (M5) ────────────────────────────────────
    let priorityResult;
    try {
      priorityResult = await priorityService.predictPriority(
        category,
        complaint.description || complaint.originalText,
        complaint.location,
        complaint.hasVoice || (complaint.imageUrls?.length > 0)
      );

      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          priority: priorityResult.priority,
          priorityScore: priorityResult.score,
          priorityFactors: priorityResult.factors,
          priorityReason: priorityResult.priorityReason,
          priorityStatus: 'completed',
        }
      );
      await logEvent(
        complaintId,
        'PRIORITY_PREDICTED',
        `Priority: ${priorityResult.priority} (Score: ${priorityResult.score}/100, SLA: ${priorityResult.slaHours}h). ${priorityResult.needsAdminReview ? '[Admin Review Recommended]' : ''}`,
        { ...priorityResult, internal: true }
      );
    } catch (err) {
      console.error(`[Pipeline] Priority prediction error for ${complaintId}:`, err.message);
      await Complaint.findOneAndUpdate(
        { complaintId },
        { priority: 'MEDIUM', priorityStatus: 'failed', priorityReason: 'Defaulted to MEDIUM due to priority module error.' }
      );
      await logEvent(
        complaintId,
        'PRIORITY_PREDICTION_FAILED',
        `Priority prediction failed: ${err.message}. Defaulted to MEDIUM.`,
        { error: err.message, internal: true }
      );
    }

    // ── Step 6: Department Recommendation (M6) ──────────────────────────────
    try {
      const recResult = await routingService.recommendDepartments(
        category,
        complaint.description || complaint.originalText
      );

      const updateFields = {
        'routing.departmentName': recResult.primaryDepartment.departmentName,
        'routing.departmentId': recResult.primaryDepartment.departmentId,
        'routing.routingReason': recResult.primaryDepartment.reason,
        'departments.primary': recResult.primaryDepartment.departmentName ? {
          departmentId: recResult.primaryDepartment.departmentId,
          departmentName: recResult.primaryDepartment.departmentName,
          reason: recResult.primaryDepartment.reason,
        } : null,
        'departments.supporting': recResult.supportingDepartments.map((s) => ({
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          reason: s.reason,
        })),
        'adminApproval.status': 'pending',
      };

      await Complaint.findOneAndUpdate({ complaintId }, updateFields);

      await logEvent(
        complaintId,
        'AI_ROUTING_RECOMMENDED',
        recResult.recommendationSummary,
        { ...recResult, internal: true },
        { type: 'ai', id: 'ai_triage', name: 'AI Routing Engine' }
      );

      // Transition to Central Admin review queue (does not bypass approval)
      await updateComplaintStatus(
        complaintId,
        'UNDER_ANALYSIS',
        'AWAITING_ADMIN_REVIEW'
      );
    } catch (err) {
      console.error(`[Pipeline] Routing recommendation error for ${complaintId}:`, err.message);
      await Complaint.findOneAndUpdate(
        { complaintId },
        {
          'routing.routingReason': `Routing error: ${err.message}. Awaiting manual Central Admin routing.`,
          'adminApproval.status': 'pending',
        }
      );
      await logEvent(
        complaintId,
        'AI_ROUTING_FAILED',
        `Department recommendation failed: ${err.message}. Forwarded to Central Admin for manual assignment.`,
        { error: err.message, internal: true }
      );
      await updateComplaintStatus(
        complaintId,
        'UNDER_ANALYSIS',
        'AWAITING_ADMIN_REVIEW'
      );
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
