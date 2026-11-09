'use strict';

/**
 * Escalation Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research contribution: Predictive Escalation Engine.
 *
 * Evaluates each complaint's escalation risk based on:
 * - Priority level
 * - Time elapsed vs. department SLA
 * - Current workflow stage
 * - Department historical performance (stub)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Escalation = require('../models/Escalation');
const Department = require('../models/Department');

const SLA_HOURS_BY_PRIORITY = {
  CRITICAL: 6,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 120,
};

const EARLY_STAGES = ['SUBMITTED', 'UNDER_ANALYSIS', 'CATEGORIZED', 'PRIORITIZED', 'ROUTED'];
const STUCK_STAGES = ['ASSIGNED', 'IN_PROGRESS'];

/**
 * Assess escalation risk for a single complaint.
 * @param {object} complaint - Complaint document
 * @returns {Promise<object>} Escalation assessment result
 */
async function assessEscalationRisk(complaint) {
  const priority = complaint.priority || 'MEDIUM';
  const slaHours = SLA_HOURS_BY_PRIORITY[priority] ?? 72;
  const createdAt = new Date(complaint.createdAt);
  const now = new Date();
  const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

  const reasons = [];
  let riskScore = 0;

  // 1. SLA breach
  if (elapsedHours > slaHours) {
    riskScore += 40;
    const breachHours = Math.round(elapsedHours - slaHours);
    reasons.push(`SLA breached by ${breachHours}h (${priority} SLA = ${slaHours}h)`);
  } else if (elapsedHours > slaHours * 0.75) {
    riskScore += 20;
    reasons.push(`Approaching SLA deadline (${Math.round(elapsedHours)}/${slaHours}h elapsed)`);
  }

  // 2. Priority weight
  if (priority === 'CRITICAL') riskScore += 25;
  else if (priority === 'HIGH') riskScore += 15;
  else if (priority === 'MEDIUM') riskScore += 5;

  // 3. Complaint stuck in early stage
  if (EARLY_STAGES.includes(complaint.status) && elapsedHours > 2) {
    riskScore += 15;
    reasons.push(`Complaint stuck in ${complaint.status} for ${Math.round(elapsedHours)}h`);
  }

  // 4. No officer assigned yet for a routed complaint
  if (complaint.status === 'ROUTED' && !complaint.routing?.assignedOfficerId) {
    riskScore += 10;
    reasons.push('No officer assigned despite routing completion');
  }

  // 5. Department SLA lookup
  if (complaint.routing?.departmentId) {
    try {
      const dept = await Department.findById(complaint.routing.departmentId);
      if (dept && elapsedHours > dept.slaHours) {
        riskScore += 10;
        reasons.push(`Department "${dept.name}" SLA of ${dept.slaHours}h exceeded`);
      }
    } catch {
      // DB lookup failed — don't break the assessment
    }
  }

  riskScore = Math.min(100, riskScore);
  const escalationLevel = riskScore >= 80 ? 3 : riskScore >= 60 ? 2 : riskScore >= 40 ? 1 : 0;
  const escalationRisk =
    riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

  const predictedDelayHours =
    riskScore >= 60 ? Math.round((elapsedHours - slaHours) * 1.5) : null;

  return {
    escalationRisk,
    escalationLevel,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    expectedResolutionHours: slaHours,
    predictedDelayHours,
    reasons: reasons.length > 0 ? reasons : ['Within acceptable SLA parameters'],
    recommendedAction:
      escalationRisk === 'CRITICAL' || escalationRisk === 'HIGH'
        ? `Immediately escalate to department supervisor. ${reasons[0] ?? ''}`
        : escalationRisk === 'MEDIUM'
        ? 'Monitor closely. Send reminder to assigned officer.'
        : 'No action required.',
    predictionStatus: 'completed',
    method: 'rule_based', // Will become 'ml_model' when predictive model is trained
  };
}

/**
 * Persist escalation assessment to the database.
 */
async function saveEscalation(complaint, assessment) {
  try {
    // Upsert — update existing record or create new one
    await Escalation.findOneAndUpdate(
      { complaintId: complaint.complaintId },
      {
        complaintId: complaint.complaintId,
        complaintCategory: complaint.category,
        ward: complaint.location?.ward,
        ...assessment,
        assessedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`Failed to save escalation for ${complaint.complaintId}:`, err.message);
  }
}

/**
 * Get top at-risk complaints for the dashboard.
 */
async function getTopEscalations(limit = 5) {
  return Escalation.find({
    escalationRisk: { $in: ['HIGH', 'CRITICAL'] },
  })
    .sort({ escalationLevel: -1, assessedAt: -1 })
    .limit(limit);
}

/**
 * Trigger an escalation for a task with deduplication and tiering.
 * @param {object} task - ComplaintTask document
 * @param {object} options - { escalationLevel, triggerCondition, reasons, recipientRole, actionTaken }
 * @returns {Promise<object>} { escalated: boolean, escalation: object, reason?: string }
 */
async function triggerTaskEscalation(task, options = {}) {
  const level = options.escalationLevel || 1;
  const triggerCondition = options.triggerCondition || 'SLA_BREACH';

  // Deduplication check: Do not create redundant escalation if an unacknowledged one exists for this task at this level
  const existing = await Escalation.findOne({
    taskId: task.taskId,
    escalationLevel: level,
    isAcknowledged: false,
  });

  if (existing) {
    return {
      escalated: false,
      reason: 'Duplicate unacknowledged escalation exists',
      escalation: existing,
    };
  }

  const riskLevel = level >= 3 ? 'CRITICAL' : level >= 2 ? 'HIGH' : 'MEDIUM';
  const recipient = options.recipientRole || (level >= 3 ? 'central_admin' : 'department_supervisor');

  const now = new Date();
  const createdAt = task.createdAt ? new Date(task.createdAt) : now;
  const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

  const escalation = await Escalation.create({
    complaintId: task.complaintId,
    taskId: task.taskId,
    complaintCategory: task.title || 'Municipal Task',
    departmentName: task.departmentName || '',
    triggerCondition,
    recipientRole: recipient,
    escalationRisk: riskLevel,
    escalationLevel: level,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    expectedResolutionHours: task.slaHours || 72,
    priority: task.priority || 'MEDIUM',
    currentStatus: task.status,
    reasons: options.reasons || [`Task ${task.taskId} triggered Level ${level} escalation (${triggerCondition})`],
    recommendedAction:
      level >= 3
        ? 'Executive intervention required: Central Admin review and direct reassignment.'
        : level >= 2
        ? 'Supervisor intervention required: Expedite work order and verify field crew dispatch.'
        : 'Field technician notification: 75% SLA elapsed, prioritize immediate execution.',
    predictionStatus: 'completed',
    isAcknowledged: false,
    supervisorNotified: true,
    notifiedAt: now,
    assessedAt: now,
  });

  // Update task's escalationLevel
  try {
    if (typeof task.save === 'function') {
      task.escalationLevel = Math.max(task.escalationLevel || 0, level);
      await task.save();
    }
  } catch (err) {
    console.warn(`Could not update escalationLevel on task ${task.taskId}:`, err.message);
  }

  // Log workflow event
  try {
    const WorkflowEvent = require('../models/WorkflowEvent');
    await WorkflowEvent.create({
      complaintId: task.complaintId,
      taskId: task.taskId,
      eventType: 'TASK_ESCALATED',
      actor: {
        type: 'system',
        id: 'system',
        name: 'SLA Escalation Engine',
      },
      description: `Task ${task.taskId} in ${task.departmentName} escalated to Level ${level} (${riskLevel}). Trigger: ${triggerCondition}`,
      metadata: { taskId: task.taskId, escalationLevel: level, triggerCondition },
    });
  } catch (err) {
    console.warn(`Could not log TASK_ESCALATED event for ${task.taskId}:`, err.message);
  }

  return { escalated: true, escalation };
}

/**
 * Acknowledge an escalation.
 * @param {string} escalationId
 * @param {object} user - User acknowledging the escalation
 * @returns {Promise<object>} Updated escalation
 */
async function acknowledgeTaskEscalation(escalationId, user) {
  const escalation = await Escalation.findById(escalationId);
  if (!escalation) {
    throw new Error(`Escalation ${escalationId} not found`);
  }

  escalation.isAcknowledged = true;
  escalation.acknowledgedAt = new Date();
  escalation.acknowledgedBy = user?._id;
  escalation.acknowledgedByName = user?.name || 'Authorized Staff';
  escalation.actionTaken = `Acknowledged by ${user?.name || 'Staff'} (${user?.role || 'authorized_user'})`;

  await escalation.save();
  return escalation;
}

module.exports = {
  assessEscalationRisk,
  saveEscalation,
  getTopEscalations,
  triggerTaskEscalation,
  acknowledgeTaskEscalation,
};
