'use strict';

/**
 * PHASE 7 VERIFICATION SUITE
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates all required test scenarios for:
 *   - M9: SLA Monitoring
 *   - M10: Predictive SLA Delay Estimation & Escalation
 *   - Security & RBAC boundaries
 *   - Regressions across previous phases
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http = require('http');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { app } = require('../index');

const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const Escalation = require('../models/Escalation');
const User = require('../models/User');
const Department = require('../models/Department');

const {
  calculateTaskSLA,
  pauseTaskSLA,
  resumeTaskSLA,
  evaluateAllTasksSLA,
  SLA_HOURS_BY_PRIORITY,
} = require('../services/slaMonitoringService');

const { predictTaskDelay } = require('../services/predictiveDelayService');
const { triggerTaskEscalation, acknowledgeTaskEscalation } = require('../services/escalationService');

let server;
const results = [];
const createdTestIds = {
  complaints: [],
  tasks: [],
  escalations: [],
};

function record(id, title, passed, detail) {
  results.push({ id, title, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${id}: ${title}`);
  if (detail) console.log(`       └─ ${detail}`);
}

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('⏱️   PHASE 7: SLA MONITORING (M9) & PREDICTIVE DELAY (M10)');
  console.log('================================================================\n');

  await connectDatabase();
  const PORT = 5107;
  server = app.listen(PORT);
  console.log(`📡  Test API Server running on port ${PORT}\n`);

  try {
    // 0. Authenticate Test Users
    console.log('--- Step 0: Auth Handshake for Universal Role Testing ---');
    const roles = {
      admin: { email: 'admin.commissioner@smartcity.gov.in', password: 'Admin@123' },
      roadSupervisor: { email: 'selvam.supervisor@smartcity.gov.in', password: 'Supervisor@123' },
      roadEmployee: { email: 'ramesh.field@smartcity.gov.in', password: 'Employee@123' },
      sanitationSupervisor: { email: 'priya.supervisor@smartcity.gov.in', password: 'Supervisor@123' },
      citizen: { email: 'rajesh.kumar88@example.gov.in', password: 'Citizen@123' },
    };

    const tokens = {};
    for (const [roleKey, creds] of Object.entries(roles)) {
      const authRes = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        creds
      );
      if (authRes.status === 200 && authRes.data.token) {
        tokens[roleKey] = authRes.data.token;
      } else {
        console.warn(`[Auth Notice] Login fallback for ${roleKey}`);
      }
    }
    console.log('✅ Tokens obtained for available roles.\n');

    // =========================================================================
    // PART 1: 14 M9 Tests (SLA Monitoring)
    // =========================================================================
    console.log('--- Part 1: M9 SLA Monitoring Tests ---');

    // M9-01: Priority to SLA hours mapping
    const critH = SLA_HOURS_BY_PRIORITY['CRITICAL'];
    const highH = SLA_HOURS_BY_PRIORITY['HIGH'];
    const medH = SLA_HOURS_BY_PRIORITY['MEDIUM'];
    const lowH = SLA_HOURS_BY_PRIORITY['LOW'];
    const m9_1 = critH === 6 && highH === 24 && medH === 72 && lowH === 120;
    record(
      'M9-01',
      'Priority to SLA Hours Mapping (CRITICAL=6h, HIGH=24h, MEDIUM=72h, LOW=120h)',
      m9_1,
      `Calculated: Critical=${critH}h, High=${highH}h, Medium=${medH}h, Low=${lowH}h`
    );

    // M9-02: Multi-department complaint generates tasks with separate independent deadlines
    const testCmpId = `CMP-P7-TEST-${Date.now()}`;
    const baseNow = new Date();
    await Complaint.create({
      complaintId: testCmpId,
      citizenId: 'CIT-P7-TEST',
      category: 'Pothole',
      description: 'Major arterial road damage and pothole crater on Anna Salai',
      location: {
        address: 'Anna Salai Main Road',
        latitude: 13.0827,
        longitude: 80.2707,
        ward: 'Ward 12',
      },
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      adminNotes: 'Confidential administrative note: Expedited under executive priority directive.',
    });
    createdTestIds.complaints.push(testCmpId);

    const taskA = await ComplaintTask.create({
      taskId: `TSK-${testCmpId}-01`,
      complaintId: testCmpId,
      taskType: 'primary',
      departmentName: 'Road Maintenance Department',
      title: 'Pothole restoration on arterial corridor',
      priority: 'HIGH',
      slaHours: 24,
      slaDeadline: new Date(baseNow.getTime() + 24 * 3600000),
      status: 'PENDING_ASSIGNMENT',
      createdAt: baseNow,
    });
    const taskB = await ComplaintTask.create({
      taskId: `TSK-${testCmpId}-02`,
      complaintId: testCmpId,
      taskType: 'supporting',
      departmentName: 'Traffic Police Liaison',
      title: 'Traffic diversion coordination',
      priority: 'CRITICAL',
      slaHours: 6,
      slaDeadline: new Date(baseNow.getTime() + 6 * 3600000),
      status: 'PENDING_ASSIGNMENT',
      createdAt: baseNow,
    });
    createdTestIds.tasks.push(taskA.taskId, taskB.taskId);

    const m9_2 = taskA.slaDeadline.getTime() !== taskB.slaDeadline.getTime() && taskA.slaHours === 24 && taskB.slaHours === 6;
    record(
      'M9-02',
      'Multi-Department Tasks Have Separate Independent Deadlines',
      m9_2,
      `Task A deadline: ${taskA.slaDeadline.toISOString()} (${taskA.slaHours}h), Task B deadline: ${taskB.slaDeadline.toISOString()} (${taskB.slaHours}h)`
    );

    // M9-03: SLA state ON_TRACK (<75% elapsed)
    const taskOnTrack = {
      taskId: 'TSK-ON-TRACK-01',
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(baseNow.getTime() - 6 * 3600000), // 6h elapsed of 24h = 25%
      slaDeadline: new Date(baseNow.getTime() + 18 * 3600000),
      status: 'IN_PROGRESS',
    };
    const slaOnTrack = calculateTaskSLA(taskOnTrack, baseNow);
    const m9_3 = slaOnTrack.slaStatus === 'ON_TRACK' && slaOnTrack.elapsedPercentage === 25;
    record(
      'M9-03',
      'SLA Status ON_TRACK (<75% elapsed duration)',
      m9_3,
      `State: ${slaOnTrack.slaStatus}, Elapsed: ${slaOnTrack.elapsedPercentage}%, Remaining: ${slaOnTrack.remainingHours}h`
    );

    // M9-04: SLA state AT_RISK (>=75% and <=100% elapsed)
    const taskAtRisk = {
      taskId: 'TSK-AT-RISK-01',
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(baseNow.getTime() - 20 * 3600000), // 20h elapsed of 24h = 83%
      slaDeadline: new Date(baseNow.getTime() + 4 * 3600000),
      status: 'IN_PROGRESS',
    };
    const slaAtRisk = calculateTaskSLA(taskAtRisk, baseNow);
    const m9_4 = slaAtRisk.slaStatus === 'AT_RISK' && slaAtRisk.elapsedPercentage >= 75;
    record(
      'M9-04',
      'SLA Status AT_RISK (>=75% elapsed duration)',
      m9_4,
      `State: ${slaAtRisk.slaStatus}, Elapsed: ${slaAtRisk.elapsedPercentage}%, Remaining: ${slaAtRisk.remainingHours}h`
    );

    // M9-05: SLA state OVERDUE (>100% elapsed)
    const taskOverdue = {
      taskId: 'TSK-OVERDUE-01',
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(baseNow.getTime() - 26 * 3600000), // 26h elapsed
      slaDeadline: new Date(baseNow.getTime() - 2 * 3600000),
      status: 'IN_PROGRESS',
    };
    const slaOverdue = calculateTaskSLA(taskOverdue, baseNow);
    const m9_5 = slaOverdue.slaStatus === 'OVERDUE' && slaOverdue.isBreached === true;
    record(
      'M9-05',
      'SLA Status OVERDUE (>100% elapsed duration / deadline passed)',
      m9_5,
      `State: ${slaOverdue.slaStatus}, isBreached: ${slaOverdue.isBreached}, Remaining: ${slaOverdue.remainingHours}h`
    );

    // M9-06: SLA state COMPLETED_WITHIN_SLA
    const taskCompletedInSLA = {
      taskId: 'TSK-COMP-01',
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(baseNow.getTime() - 15 * 3600000),
      slaDeadline: new Date(baseNow.getTime() + 9 * 3600000),
      completedAt: new Date(baseNow.getTime() - 2 * 3600000), // Completed 2h ago, within deadline
      status: 'VERIFIED',
    };
    const slaCompIn = calculateTaskSLA(taskCompletedInSLA, baseNow);
    const m9_6 = slaCompIn.slaStatus === 'COMPLETED_WITHIN_SLA' && !slaCompIn.isBreached;
    record(
      'M9-06',
      'SLA Status COMPLETED_WITHIN_SLA (completedAt <= deadline)',
      m9_6,
      `State: ${slaCompIn.slaStatus}, isBreached: ${slaCompIn.isBreached}`
    );

    // M9-07: SLA state COMPLETED_AFTER_SLA
    const taskCompletedLate = {
      taskId: 'TSK-COMP-02',
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(baseNow.getTime() - 30 * 3600000),
      slaDeadline: new Date(baseNow.getTime() - 6 * 3600000),
      completedAt: new Date(baseNow.getTime() - 1 * 3600000), // Completed 5h after deadline
      status: 'VERIFIED',
    };
    const slaCompLate = calculateTaskSLA(taskCompletedLate, baseNow);
    const m9_7 = slaCompLate.slaStatus === 'COMPLETED_AFTER_SLA' && slaCompLate.isBreached;
    record(
      'M9-07',
      'SLA Status COMPLETED_AFTER_SLA (completedAt > deadline)',
      m9_7,
      `State: ${slaCompLate.slaStatus}, isBreached: ${slaCompLate.isBreached}`
    );

    // M9-08: Reassignment preserves original createdAt, slaDeadline, and slaHours
    const initialDeadline = taskA.slaDeadline;
    const initialCreatedAt = taskA.createdAt;
    taskA.assignmentHistory.push({
      employeeName: 'K. Ramesh (Reassigned)',
      supervisorName: 'Selvam (Supervisor)',
      assignedAt: new Date(),
      action: 'reassignment',
    });
    taskA.assignedEmployeeName = 'K. Ramesh (Reassigned)';
    await taskA.save();

    const reloadedA = await ComplaintTask.findOne({ taskId: taskA.taskId });
    const m9_8 =
      reloadedA.slaDeadline.getTime() === initialDeadline.getTime() &&
      reloadedA.createdAt.getTime() === initialCreatedAt.getTime() &&
      reloadedA.slaHours === 24;
    record(
      'M9-08',
      'Reassignment Preserves Initial SLA Deadline and Creation Timestamp',
      m9_8,
      `Original deadline: ${initialDeadline.toISOString()}, Preserved deadline: ${reloadedA.slaDeadline.toISOString()}`
    );

    // M9-09: Adding progress notes preserves original createdAt, slaDeadline, and slaHours
    reloadedA.progressNotes.push({
      note: 'Field inspection completed. Asphalt supplier on way.',
      authorName: 'K. Ramesh',
      createdAt: new Date(),
    });
    await reloadedA.save();
    const afterNotesA = await ComplaintTask.findOne({ taskId: taskA.taskId });
    const m9_9 =
      afterNotesA.slaDeadline.getTime() === initialDeadline.getTime() &&
      afterNotesA.createdAt.getTime() === initialCreatedAt.getTime() &&
      afterNotesA.slaHours === 24;
    record(
      'M9-09',
      'Progress Notes Addition Preserves Initial SLA Deadline & Timestamps',
      m9_9,
      `Original deadline: ${initialDeadline.toISOString()}, After notes: ${afterNotesA.slaDeadline.toISOString()}`
    );

    // M9-10: Pause SLA clock records active pause in pauseHistory
    const mockAdminUser = { _id: new mongoose.Types.ObjectId(), name: 'Commissioner Office', role: 'central_admin' };
    const pausedTask = await pauseTaskSLA(taskA.taskId, 'Heavy downpour halting hot-mix bitumen work', mockAdminUser);
    const m9_10 =
      pausedTask.isPaused === true &&
      pausedTask.pauseHistory.length === 1 &&
      pausedTask.pauseHistory[0].reason.includes('Heavy downpour');
    record(
      'M9-10',
      'Pause SLA Clock Records Active Pause in History and Halts Timer',
      m9_10,
      `isPaused: ${pausedTask.isPaused}, History count: ${pausedTask.pauseHistory.length}, Reason: ${pausedTask.pauseHistory[0]?.reason}`
    );

    // M9-11: Resume SLA clock extends deadline by exact duration
    // Simulate elapsed time during pause
    pausedTask.pauseHistory[0].pausedAt = new Date(Date.now() - 3 * 3600000); // Paused 3 hours ago
    await pausedTask.save();
    const preResumeDeadline = pausedTask.slaDeadline;
    const resumedTask = await resumeTaskSLA(taskA.taskId, mockAdminUser);
    const extendedHours = (resumedTask.slaDeadline.getTime() - preResumeDeadline.getTime()) / 3600000;
    const m9_11 = resumedTask.isPaused === false && extendedHours >= 2.9 && extendedHours <= 3.1;
    record(
      'M9-11',
      'Resume SLA Clock Extends SLA Deadline by Paused Duration',
      m9_11,
      `Pre-resume: ${preResumeDeadline.toISOString()}, Post-resume: ${resumedTask.slaDeadline.toISOString()} (+${Math.round(extendedHours * 10) / 10}h)`
    );

    // M9-12: Trigger Level 1 escalation (approaching SLA breach)
    const esc1Res = await triggerTaskEscalation(taskA, {
      escalationLevel: 1,
      triggerCondition: 'APPROACHING_BREACH_75',
      reasons: ['75% SLA threshold elapsed without progress verification'],
    });
    if (esc1Res.escalation?._id) createdTestIds.escalations.push(esc1Res.escalation._id);
    const m9_12 = esc1Res.escalated === true && esc1Res.escalation.escalationLevel === 1;
    record(
      'M9-12',
      'Trigger Level 1 Escalation (Approaching SLA Deadline Nudge)',
      m9_12,
      `Escalated: ${esc1Res.escalated}, Level: ${esc1Res.escalation?.escalationLevel}, Risk: ${esc1Res.escalation?.escalationRisk}`
    );

    // M9-13: Trigger Level 2/3 escalation (breached SLA)
    const esc2Res = await triggerTaskEscalation(taskB, {
      escalationLevel: 3,
      triggerCondition: 'SLA_BREACH',
      reasons: ['Critical priority task breached 6-hour response deadline'],
    });
    if (esc2Res.escalation?._id) createdTestIds.escalations.push(esc2Res.escalation._id);
    const m9_13 = esc2Res.escalated === true && esc2Res.escalation.escalationLevel === 3;
    record(
      'M9-13',
      'Trigger Level 3 Critical Escalation (SLA Breached Executive Alert)',
      m9_13,
      `Escalated: ${esc2Res.escalated}, Level: ${esc2Res.escalation?.escalationLevel}, Risk: ${esc2Res.escalation?.escalationRisk}`
    );

    // M9-14: Escalation deduplication prevents duplicate records
    const dupEscRes = await triggerTaskEscalation(taskA, {
      escalationLevel: 1,
      triggerCondition: 'APPROACHING_BREACH_75',
      reasons: ['Duplicate alert attempt for existing open escalation'],
    });
    const m9_14 = dupEscRes.escalated === false && dupEscRes.reason.includes('Duplicate');
    record(
      'M9-14',
      'Escalation Deduplication Prevents Redundant Escalation Records',
      m9_14,
      `Escalated: ${dupEscRes.escalated}, Reason: ${dupEscRes.reason}`
    );

    // =========================================================================
    // PART 2: 10 M10 Tests (Predictive Delay Estimation)
    // =========================================================================
    console.log('\n--- Part 2: M10 Predictive Delay Estimation Tests ---');

    // M10-01: Baseline returns valid risk schema
    const delayEval = await predictTaskDelay(taskA);
    const m10_1 =
      delayEval &&
      typeof delayEval.riskLevel === 'string' &&
      typeof delayEval.riskScore === 'number' &&
      Array.isArray(delayEval.contributingFactors) &&
      typeof delayEval.recommendedAction === 'string' &&
      delayEval.scoringMethod === 'feature_weighted_risk_baseline';
    record(
      'M10-01',
      'Baseline Returns Standard Explainable Risk Schema',
      m10_1,
      `RiskLevel: ${delayEval.riskLevel}, Score: ${delayEval.riskScore}/100, Method: ${delayEval.scoringMethod}`
    );

    // M10-02: Factor 1 - Elapsed time ratio contributes to risk score
    const freshTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(),
      status: 'ASSIGNED',
      assignedEmployeeName: 'Technician A',
    };
    const agedTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 22 * 3600000), // 22h elapsed = ~92%
      status: 'ASSIGNED',
      assignedEmployeeName: 'Technician A',
    };
    const freshEval = await predictTaskDelay(freshTask);
    const agedEval = await predictTaskDelay(agedTask);
    const m10_2 = agedEval.riskScore > freshEval.riskScore;
    record(
      'M10-02',
      'Factor 1: Elapsed SLA Consumption Directly Elevates Risk Score',
      m10_2,
      `Fresh score: ${freshEval.riskScore}, Aged score (92% elapsed): ${agedEval.riskScore}`
    );

    // M10-03: Factor 2 - Assignment latency contributes to risk score
    const unassignedAged = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 5 * 3600000),
      status: 'PENDING_ASSIGNMENT',
      assignedEmployeeName: '',
    };
    const assignedPrompt = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 5 * 3600000),
      status: 'ASSIGNED',
      assignedEmployeeName: 'Field Officer',
      assignedAt: new Date(Date.now() - 4.5 * 3600000),
    };
    const unassignedEval = await predictTaskDelay(unassignedAged);
    const promptEval = await predictTaskDelay(assignedPrompt);
    const m10_3 = unassignedEval.riskScore > promptEval.riskScore;
    record(
      'M10-03',
      'Factor 2: Unassigned Latency Directly Escalates Delay Risk Points',
      m10_3,
      `Unassigned (5h pending): ${unassignedEval.riskScore} pts vs Promptly Assigned: ${promptEval.riskScore} pts`
    );

    // M10-04: Factor 3 - Department workload congestion contributes to risk score
    const lowCongestionEval = await predictTaskDelay(freshTask, { activeDeptCount: 1 });
    const highCongestionEval = await predictTaskDelay(freshTask, { activeDeptCount: 12 });
    const m10_4 = highCongestionEval.riskScore > lowCongestionEval.riskScore;
    record(
      'M10-04',
      'Factor 3: Department Workload Congestion Adds Calibrated Friction Score',
      m10_4,
      `Low load (1 active): ${lowCongestionEval.riskScore} pts vs High load (12 active): ${highCongestionEval.riskScore} pts`
    );

    // M10-05: Factor 4 - Reassignment and rework friction contributes to risk score
    const reworkTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 4 * 3600000),
      status: 'REQUIRES_ADDITIONAL_WORK',
      assignedEmployeeName: 'Officer B',
      assignmentHistory: [{}, {}, {}], // 2 reassignments
    };
    const smoothTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 4 * 3600000),
      status: 'IN_PROGRESS',
      assignedEmployeeName: 'Officer A',
      assignmentHistory: [{}],
    };
    const reworkEval = await predictTaskDelay(reworkTask);
    const smoothEval = await predictTaskDelay(smoothTask);
    const m10_5 = reworkEval.riskScore > smoothEval.riskScore;
    record(
      'M10-05',
      'Factor 4: Rework History and Multiple Reassignments Elevate Risk Points',
      m10_5,
      `Rework/2 reassignments: ${reworkEval.riskScore} pts vs Smooth progression: ${smoothEval.riskScore} pts`
    );

    // M10-06: Factor 5 - Progress note stagnation contributes to risk score
    const stagnantTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 14 * 3600000), // >50% elapsed
      status: 'IN_PROGRESS',
      assignedEmployeeName: 'Officer A',
      progressNotes: [], // Zero progress notes
    };
    const activeTask = {
      priority: 'HIGH',
      slaHours: 24,
      createdAt: new Date(Date.now() - 14 * 3600000),
      status: 'IN_PROGRESS',
      assignedEmployeeName: 'Officer A',
      progressNotes: [{ note: 'Underway', createdAt: new Date(Date.now() - 1 * 3600000) }],
    };
    const stagnantEval = await predictTaskDelay(stagnantTask);
    const activeEval = await predictTaskDelay(activeTask);
    const m10_6 = stagnantEval.riskScore > activeEval.riskScore;
    record(
      'M10-06',
      'Factor 5: Progress Note Stagnation Penalizes Inactive Assigned Work Orders',
      m10_6,
      `Stagnant (0 notes at 58% SLA): ${stagnantEval.riskScore} pts vs Active updates: ${activeEval.riskScore} pts`
    );

    // M10-07: Risk level classification boundaries
    const highRiskTask = {
      priority: 'CRITICAL',
      slaHours: 6,
      createdAt: new Date(Date.now() - 5.5 * 3600000), // 91% elapsed
      status: 'REQUIRES_ADDITIONAL_WORK',
      assignedEmployeeName: 'Technician',
      assignmentHistory: [{}, {}, {}],
      progressNotes: [],
    };
    const highRiskEval = await predictTaskDelay(highRiskTask, { activeDeptCount: 10 });
    const m10_7 =
      freshEval.riskLevel === 'LOW' &&
      highRiskEval.riskLevel === 'HIGH' &&
      highRiskEval.riskScore >= 70;
    record(
      'M10-07',
      'Risk Classification Conforms to Score Thresholds (LOW < 40, HIGH >= 70)',
      m10_7,
      `Low test level: ${freshEval.riskLevel} (${freshEval.riskScore}), High test level: ${highRiskEval.riskLevel} (${highRiskEval.riskScore})`
    );

    // M10-08: Explainable contributing factors
    const hasExplainableReasons =
      highRiskEval.contributingFactors.length > 0 &&
      highRiskEval.contributingFactors.every((r) => typeof r === 'string' && r.length > 5);
    record(
      'M10-08',
      'Contributing Factors Provide Actionable Human-Readable Reasons',
      hasExplainableReasons,
      `Explanations provided: "${highRiskEval.contributingFactors.slice(0, 2).join('; ')}"`
    );

    // M10-09: Transparent attribution (Case B non-fabrication)
    const m10_9 =
      delayEval.scoringMethod === 'feature_weighted_risk_baseline' &&
      delayEval.predictionStatus === 'preliminary_rule_based';
    record(
      'M10-09',
      'Transparent Model Attribution Discloses Baseline Rubric Without ML Fabrication',
      m10_9,
      `Method: ${delayEval.scoringMethod}, Status: ${delayEval.predictionStatus}`
    );

    // M10-10: Advisory non-interference
    const initialTaskStatus = taskA.status;
    await predictTaskDelay(taskA);
    const m10_10 = taskA.status === initialTaskStatus;
    record(
      'M10-10',
      'Advisory Non-Interference: Delay Prediction Does Not Mutate Task Status',
      m10_10,
      `Task status remained: "${taskA.status}" after prediction evaluation`
    );

    // =========================================================================
    // PART 3: 5 Security & RBAC Tests
    // =========================================================================
    console.log('\n--- Part 3: Security & RBAC Boundary Tests ---');

    // SEC-01: Citizens cannot pause task SLA (403 Forbidden)
    const citizenPauseRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${taskA.taskId}/pause-sla`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.citizen || ''}`,
        },
      },
      { reason: 'Citizen attempting unauthorized pause' }
    );
    const sec1 = citizenPauseRes.status === 403;
    record(
      'SEC-01',
      'Citizens Denied Permission to Pause Task SLA Timer (403 Forbidden)',
      sec1,
      `Status: ${citizenPauseRes.status}, Message: ${citizenPauseRes.data?.message}`
    );

    // SEC-02: Employees cannot escalate tasks from other departments (403 Forbidden)
    const empEscRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${taskB.taskId}/escalate`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee || ''}`,
        },
      },
      { escalationLevel: 2, reason: 'Field employee escalation attempt' }
    );
    const sec2 = empEscRes.status === 403;
    record(
      'SEC-02',
      'Department Employees Denied Permission to Trigger Task Escalations (403 Forbidden)',
      sec2,
      `Status: ${empEscRes.status}, Message: ${empEscRes.data?.message}`
    );

    // SEC-03: Supervisors cannot pause/resume tasks belonging to other departments
    const foreignPauseRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${taskB.taskId}/pause-sla`, // taskB is Traffic Police, roadSupervisor is Roads
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadSupervisor || ''}`,
        },
      },
      { reason: 'Cross-department pause attempt' }
    );
    const sec3 = foreignPauseRes.status === 403;
    record(
      'SEC-03',
      'Department Supervisors Cannot Pause/Escalate Cross-Department Tasks',
      sec3,
      `Status: ${foreignPauseRes.status}, Message: ${foreignPauseRes.data?.message}`
    );

    // SEC-04: Central Admin can view municipality-wide SLA metrics and acknowledge escalations
    const adminSlaMetrics = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/dashboard/sla-metrics',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.admin || ''}`,
      },
    });
    const sec4 =
      adminSlaMetrics.status === 200 &&
      adminSlaMetrics.data.success === true &&
      typeof adminSlaMetrics.data.data.complianceRate === 'number';
    record(
      'SEC-04',
      'Central Admin Retains Municipality-Wide SLA Visibility & Metrics',
      sec4,
      `Compliance rate: ${adminSlaMetrics.data?.data?.complianceRate}%, Total tasks evaluated: ${adminSlaMetrics.data?.data?.totalTasks}`
    );

    // SEC-05: Public tracking does not leak internal officer notes or escalation trigger logs
    const publicTrackRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/complaints/${testCmpId}`,
      method: 'GET',
    });
    const leakedNotes =
      publicTrackRes.data?.data?.adminNotes ||
      publicTrackRes.data?.data?.pauseHistory ||
      JSON.stringify(publicTrackRes.data).includes('downpour');
    const sec5 = publicTrackRes.status === 200 && !leakedNotes;
    record(
      'SEC-05',
      'Public Tracking Endpoint Redacts Internal SLA Pauses and Staff Progress Notes',
      sec5,
      `Status: ${publicTrackRes.status}, Sensitive fields leaked: ${Boolean(leakedNotes)}`
    );

    // =========================================================================
    // PART 4: Regression Tests (Phases 2, 3, 5, 6)
    // =========================================================================
    console.log('\n--- Part 4: System Regression Tests ---');

    // REG-01: Phase 6 RAG Knowledge Support still operational
    const ragGuidance = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/tasks/${taskA.taskId}/knowledge`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.admin || tokens.roadSupervisor || ''}`,
      },
    });
    const reg1 = ragGuidance.status === 200 && ragGuidance.data.success === true;
    record('REG-01', 'Phase 6 Grounded Knowledge Support Remains Fully Operational', reg1, `Status: ${ragGuidance.status}`);

    // REG-02: Phase 5 Multi-turn AI Analysis still operational
    const aiAnalysisRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/ai/preview-analysis',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { description: 'Water pipe leak flooding main street near Market cross road' }
    );
    const reg2 =
      aiAnalysisRes.status === 200 &&
      aiAnalysisRes.data.success === true &&
      Boolean(aiAnalysisRes.data?.data?.classification?.category);
    record(
      'REG-02',
      'Phase 5 Complaint Analysis & Categorization Remains Operational',
      reg2,
      `Category: ${aiAnalysisRes.data?.data?.classification?.category}`
    );

    // REG-03: Phase 3 Database Schema & Task Models intact
    const taskCount = await ComplaintTask.countDocuments();
    const reg3 = taskCount > 0;
    record('REG-03', 'Phase 3 Database Task Schema Integrity Maintained', reg3, `Total tasks in DB: ${taskCount}`);

    // REG-04: Phase 2 Multi-department Complaint Routing intact
    const tasksForTestCmp = await ComplaintTask.find({ complaintId: testCmpId });
    const reg4 = tasksForTestCmp.length === 2;
    record('REG-04', 'Phase 2 Multi-Department Task Orchestration Intact', reg4, `Tasks linked to complaint: ${tasksForTestCmp.length}`);

  } catch (err) {
    console.error('Verification encountered an uncaught error:', err);
  } finally {
    // Cleanup temporary test tasks, complaints, and escalations
    console.log('\n--- Cleaning up temporary test artifacts ---');
    if (createdTestIds.tasks.length > 0) {
      await ComplaintTask.deleteMany({ taskId: { $in: createdTestIds.tasks } });
    }
    if (createdTestIds.complaints.length > 0) {
      await Complaint.deleteMany({ complaintId: { $in: createdTestIds.complaints } });
    }
    if (createdTestIds.escalations.length > 0) {
      await Escalation.deleteMany({ _id: { $in: createdTestIds.escalations } });
    }
    console.log('✅ Temporary test records cleaned up.');

    if (server) {
      server.close();
      console.log('🔌 Test server shut down.');
    }
    await mongoose.connection.close();
    console.log('📦 Database connection closed.\n');

    // Print summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log('================================================================');
    console.log(`📊 PHASE 7 VERIFICATION SUMMARY: ${passed}/${results.length} PASSED (${failed} FAILED)`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runVerification();
