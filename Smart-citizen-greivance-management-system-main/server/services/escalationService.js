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

module.exports = { assessEscalationRisk, saveEscalation, getTopEscalations };
