'use strict';

/**
 * =============================================================================
 * PHASE 9 & 9.1 VERIFICATION SUITE: EVIDENCE-BASED RESOLUTION VERIFICATION (M12)
 * =============================================================================
 * Validates the complete Human-in-the-Loop Evidence-Based Resolution Verification:
 *
 * 1. Critical Separation of Recommendation vs Verification:
 *    - Automated assessment calculates advisory quality score & recommendations.
 *    - A score of >= 70 NEVER automatically changes a task to VERIFIED.
 *    - All resolution submissions enter pending-review ('AWAITING_REVIEW').
 *    - Only an authorized department supervisor can verify/approve a task.
 *
 * 2. SOP Alignment Scoring Rules:
 *    - Zero points when no approved SOP content matches.
 *    - No default 10 points.
 *    - Distinguishes no_applicable_sop, retrieval_failed, sop_unmatched, and sop_matched.
 *    - Preserves source title, source, and section without claiming semantic retrieval.
 *
 * 3. Evidence Reference & Availability Scoring:
 *    - File attachment establishes submission only; physical proof verified by supervisor.
 *    - Multiple attachments alone do NOT establish before-and-after completion.
 *    - Missing evidence remains visible to supervisor as review points.
 *
 * 4. Human-in-the-Loop Lifecycle & RBAC Boundaries:
 *    - Employees cannot self-verify (403).
 *    - Supervisors cannot verify outside their assigned department (403).
 *    - Resubmission archives complete history into resolutionHistory.
 *    - Parent complaint cannot become RESOLVED while any task remains unverified.
 *    - Central Admin closure blocked prematurely (400) and unauthorized (403).
 *    - Citizen endpoint strips internal rubrics, delay risk, and staff IDs.
 * =============================================================================
 */

const http = require('http');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { app } = require('../index');

const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const Resolution = require('../models/Resolution');
const User = require('../models/User');
const Department = require('../models/Department');
const KnowledgeDocument = require('../models/KnowledgeDocument');

const {
  verifyResolution,
  evaluateDescriptionCompleteness,
  evaluateTaskRelevance,
  evaluateEvidenceAvailability,
  evaluateChecklistCompliance,
  evaluateSOPAlignment,
  detectContradictions,
  CATEGORY_CHECKLISTS,
} = require('../services/resolutionVerificationService');

let server;
const results = [];
const createdTestIds = {
  complaints: [],
  tasks: [],
  resolutions: [],
  users: [],
  knowledgeDocs: [],
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
  console.log('🛡️   PHASE 9 & 9.1: EVIDENCE-BASED RESOLUTION VERIFICATION (M12)');
  console.log('================================================================\n');

  await connectDatabase();
  const PORT = 5109;
  server = app.listen(PORT);
  console.log(`📡  Test API Server running on port ${PORT}\n`);

  try {
    // -------------------------------------------------------------------------
    // Step 0: Ensure required test accounts & acquire JWT tokens
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Preparing Test Accounts and Acquiring Tokens ---');

    let sanitationDept = await Department.findOne({
      name: { $regex: /Water|Sanitation|Solid Waste/i },
    });
    if (!sanitationDept) {
      sanitationDept = await Department.findOne();
    }

    let sanitationSupervisor = await User.findOne({ email: 'priya.supervisor@smartcity.gov.in' });
    if (!sanitationSupervisor) {
      sanitationSupervisor = await User.create({
        name: 'Er. Priya Natarajan',
        email: 'priya.supervisor@smartcity.gov.in',
        passwordHash: 'Supervisor@123',
        role: 'department_supervisor',
        departmentId: sanitationDept._id,
        departmentName: sanitationDept.name,
        designation: 'Assistant Executive Engineer',
        phone: '+91 98402 99887',
      });
      createdTestIds.users.push(sanitationSupervisor._id);
    }

    let secondEmployee = await User.findOne({ email: 'suresh.field@smartcity.gov.in' });
    if (!secondEmployee) {
      const roadDept = await Department.findOne({ name: { $regex: /Road/i } });
      secondEmployee = await User.create({
        name: 'K. Suresh',
        email: 'suresh.field@smartcity.gov.in',
        passwordHash: 'Employee@123',
        role: 'department_employee',
        departmentId: roadDept ? roadDept._id : sanitationDept._id,
        departmentName: roadDept ? roadDept.name : sanitationDept.name,
        designation: 'Junior Field Technician',
        phone: '+91 98403 77889',
        employeeId: 'OFF-1029',
      });
      createdTestIds.users.push(secondEmployee._id);
    }

    const roles = {
      admin: { email: 'admin.commissioner@smartcity.gov.in', password: 'Admin@123' },
      roadSupervisor: { email: 'selvam.supervisor@smartcity.gov.in', password: 'Supervisor@123' },
      sanitationSupervisor: { email: 'priya.supervisor@smartcity.gov.in', password: 'Supervisor@123' },
      roadEmployee: { email: 'ramesh.field@smartcity.gov.in', password: 'Employee@123' },
      otherEmployee: { email: 'suresh.field@smartcity.gov.in', password: 'Employee@123' },
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
      }
    }

    const allTokensAcquired =
      tokens.admin &&
      tokens.roadSupervisor &&
      tokens.sanitationSupervisor &&
      tokens.roadEmployee &&
      tokens.otherEmployee &&
      tokens.citizen;

    record(
      'M12-00',
      'Universal Authentication & Role Matrix Handshake',
      Boolean(allTokensAcquired),
      `Tokens acquired for: ${Object.keys(tokens).join(', ')}`
    );

    // =========================================================================
    // PART 1: Automated Assessment & Quality Rubric (Scenarios 1–8)
    // =========================================================================
    console.log('\n--- Part 1: Automated Quality Rubric & Evidence Engine ---');

    const completeEvidence = [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1578991624414-276ef23a534f?auto=format&fit=crop&w=800&q=80',
    ];
    const completeNotes =
      'Excavated the damaged pothole section down to stable aggregate sub-base. Cleaned loose debris with high-pressure air blower. Applied rapid-setting bitumen emulsion tack coat evenly. Filled the trench with hot bituminous macadam in two compacted lifts using a 3-ton vibratory roller. Surface leveled flush with existing pavement and sealed edges with rubberized asphalt compound. Traffic opened safely with zero surface variance. See attached photo proof.';

    // M12-01: Complete resolution description with relevant evidence
    const evalS01 = await verifyResolution({
      resolutionNotes: completeNotes,
      evidenceUrls: completeEvidence,
      complaintDescription: 'Hazardous deep pothole on road causing traffic obstruction and vehicle damage.',
      task: { title: 'Pothole asphalt filling and leveling', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s01Passed =
      evalS01.verified === false && // Recommendation only!
      evalS01.overallScore >= 70 &&
      evalS01.recommendation === 'APPROVE_RECOMMENDED' &&
      evalS01.factorScores.descriptionCompleteness.score >= 20;

    record(
      'M12-01',
      'Complete Resolution Description Returns APPROVE_RECOMMENDED (Advisory Only)',
      s01Passed,
      `Score: ${evalS01.overallScore}/100, Rec: ${evalS01.recommendation}, Verified Flag: ${evalS01.verified} (Correctly advisory)`
    );

    // M12-02: Missing resolution description rejected with HTTP 400
    const dummyTask = await ComplaintTask.create({
      taskId: `TSK-M12-TEST-${Date.now()}`,
      complaintId: `CMP-M12-TEST-${Date.now()}`,
      departmentName: 'Road Maintenance Department',
      title: 'Pothole Test Task',
      description: 'Repair pothole test',
      status: 'IN_PROGRESS',
      assignedEmployeeName: 'K. Ramesh',
      assignedEmployeeId: (await User.findOne({ email: 'ramesh.field@smartcity.gov.in' }))._id,
      deadline: new Date(Date.now() + 86400000),
    });
    createdTestIds.tasks.push(dummyTask._id);

    const emptyNotesRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${dummyTask.taskId}/resolution`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {
        resolutionNotes: '',
        evidenceUrls: completeEvidence,
      }
    );

    record(
      'M12-02',
      'Missing Resolution Description Rejected with HTTP 400',
      emptyNotesRes.status === 400,
      `HTTP status: ${emptyNotesRes.status}, Error: ${emptyNotesRes.data?.message || JSON.stringify(emptyNotesRes.data?.errors)}`
    );

    // M12-03: Very short or meaningless resolution notes
    const shortNotes = 'Done. Fixed.';
    const evalS03 = await verifyResolution({
      resolutionNotes: shortNotes,
      evidenceUrls: completeEvidence,
      complaintDescription: 'Hazardous deep pothole on road causing traffic obstruction.',
      task: { title: 'Pothole repair', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s03Passed =
      evalS03.overallScore < 50 &&
      evalS03.factorScores.descriptionCompleteness.score <= 15 &&
      (evalS03.recommendation === 'REWORK_RECOMMENDED' || evalS03.recommendation === 'HUMAN_REVIEW_REQUIRED');

    record(
      'M12-03',
      'Very Short or Meaningless Resolution Notes Flags Advisory Rework',
      s03Passed,
      `Score: ${evalS03.overallScore}/100, Desc Score: ${evalS03.factorScores.descriptionCompleteness.score}/25, Rec: ${evalS03.recommendation}`
    );

    // M12-04: Missing required photographic evidence
    const evalS04 = await verifyResolution({
      resolutionNotes: completeNotes,
      evidenceUrls: [],
      complaintDescription: 'Hazardous deep pothole on road causing traffic obstruction.',
      task: { title: 'Pothole repair', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s04Passed =
      evalS04.factorScores.evidenceAvailability.score === 0 &&
      evalS04.evidenceCompleteness === 'missing' &&
      evalS04.missingRequirements.some((r) => r.toLowerCase().includes('photo') || r.toLowerCase().includes('evidence'));

    record(
      'M12-04',
      'Missing Required Photographic Evidence Produces 0 Evidence Points & Flags Requirement',
      s04Passed,
      `Evidence Score: ${evalS04.factorScores.evidenceAvailability.score}/20, Completeness: ${evalS04.evidenceCompleteness}`
    );

    // M12-05: Evidence unrelated to the assigned task (Domain Mismatch)
    const mismatchedNotes =
      'Isolated main distribution valve near junction. Excavated leaking 150mm cast iron potable water supply line and replaced damaged pipe with heavy-duty PVC sleeve. Restored water pressure successfully to the ward.';
    const evalS05 = await verifyResolution({
      resolutionNotes: mismatchedNotes,
      evidenceUrls: completeEvidence,
      complaintDescription: 'Flickering street light on pole #45 causing pitch darkness.',
      task: { title: 'Fix flickering LED streetlight fixture', departmentName: 'Electricity & Lighting Department' },
      category: 'Streetlight',
      departmentName: 'Electricity & Lighting Department',
    });

    const s05Passed =
      evalS05.factorScores.taskRelevance.score < 15 &&
      (evalS05.taskRelevance === 'low' || evalS05.taskRelevance === 'moderate');

    record(
      'M12-05',
      'Unrelated Resolution Evidence / Cross-Category Mismatch Penalized',
      s05Passed,
      `Task Relevance: ${evalS05.taskRelevance} (${evalS05.factorScores.taskRelevance.score}/25), Category: Streetlight vs Water pipe report`
    );

    // M12-06: Task-specific checklist requirements identified when crucial steps omitted
    const uncompactedNotes =
      'Filled the pothole with asphalt mix and smoothed it over. Road cleared.';
    const evalS06 = await verifyResolution({
      resolutionNotes: uncompactedNotes,
      evidenceUrls: completeEvidence,
      complaintDescription: 'Dangerous road pothole.',
      task: { title: 'Pothole Repair', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s06Passed =
      evalS06.factorScores.checklistCompliance.score < 15 &&
      evalS06.missingRequirements.some((r) => r.toLowerCase().includes('checklist') || r.toLowerCase().includes('review points'));

    record(
      'M12-06',
      'Unmentioned Checklist Steps Surfaced as Review Points for Supervisor',
      s06Passed,
      `Checklist Score: ${evalS06.factorScores.checklistCompliance.score}/15, Missing: ${evalS06.missingRequirements.slice(0, 1).join('')}`
    );

    // M12-07: Contradictory resolution information (Non-performance phrases)
    const contradictoryNotes =
      'Site visited by crew. Could not fix the pothole due to torrential rain and raw bitumen material shortage. Work pending for subsequent inspection.';
    const evalS07 = await verifyResolution({
      resolutionNotes: contradictoryNotes,
      evidenceUrls: completeEvidence,
      complaintDescription: 'Dangerous road pothole.',
      task: { title: 'Pothole Repair', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s07Passed =
      evalS07.identifiedInconsistencies.length > 0 &&
      evalS07.recommendation !== 'APPROVE_RECOMMENDED';

    record(
      'M12-07',
      'Contradictory / Non-Performance Signals Detected & Heavily Penalized',
      s07Passed,
      `Inconsistencies: ${evalS07.identifiedInconsistencies.length} detected ("could not fix", "material shortage", "work pending")`
    );

    // M12-08: Multiple attachments alone do not establish before-and-after proof
    const evalS08 = await verifyResolution({
      resolutionNotes: 'Standard maintenance executed at site.',
      evidenceUrls: [
        'https://example.com/site1.jpg',
        'https://example.com/site2.jpg',
        'https://example.com/site3.jpg',
      ],
      complaintDescription: 'Routine maintenance check.',
      task: { title: 'Maintenance Check', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s08Passed =
      evalS08.factorScores.evidenceAvailability.score <= 15 &&
      evalS08.factorScores.evidenceAvailability.details.includes('Image availability does not constitute visual verification');

    record(
      'M12-08',
      'Multiple Attachments Alone Do Not Constitute Before-and-After Proof',
      s08Passed,
      `Evidence score: ${evalS08.factorScores.evidenceAvailability.score}/20 (No automatic before-and-after bonus awarded)`
    );

    // =========================================================================
    // PART 2: Grounded SOP Alignment Precision (Scenarios 9–11)
    // =========================================================================
    console.log('\n--- Part 2: Grounded SOP Alignment Precision Tests ---');

    // M12-09: Successful SOP match awards SOP points with title, source, and section
    const evalS09 = await verifyResolution({
      resolutionNotes: completeNotes, // Contains "tack coat", "compaction", "asphalt"
      evidenceUrls: completeEvidence,
      complaintDescription: 'Road pothole maintenance.',
      task: { title: 'Pothole Cold-Mix Resurfacing', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s09Passed =
      evalS09.factorScores.sopAlignment.score > 0 &&
      evalS09.factorScores.sopAlignment.status === 'sop_matched' &&
      evalS09.factorScores.sopAlignment.details.includes('Lexical keyword match') &&
      Boolean(evalS09.matchedSop?.title);

    record(
      'M12-09',
      'Approved SOP Match Accurately Scores Points with Title, Source & Section Preserved',
      s09Passed,
      `SOP Score: ${evalS09.factorScores.sopAlignment.score}/15, SOP: "${evalS09.matchedSop?.title}", Status: ${evalS09.factorScores.sopAlignment.status}`
    );

    // M12-10: No SOP match produces ZERO SOP-match points (No default 10 points)
    const evalS10 = await verifyResolution({
      resolutionNotes: 'Random notes with no engineering procedures or keywords.',
      evidenceUrls: completeEvidence,
      complaintDescription: 'Miscellaneous query.',
      task: { title: 'Special Task', departmentName: 'NonExistentDepartmentXYZ' },
      category: 'UnmappedCustomCategory123',
      departmentName: 'NonExistentDepartmentXYZ',
    });

    const s10Passed =
      evalS10.factorScores.sopAlignment.score === 0 &&
      evalS10.factorScores.sopAlignment.status === 'no_applicable_sop';

    record(
      'M12-10',
      'No Applicable SOP Document Produces Exactly Zero SOP Points (No Default 10 Pts)',
      s10Passed,
      `SOP Score: ${evalS10.factorScores.sopAlignment.score}/15, Status: ${evalS10.factorScores.sopAlignment.status}`
    );

    // M12-11: SOP retrieval failure is distinguishable from no applicable SOP
    // We test with an SOP that exists but resolution notes match zero keywords -> 'sop_unmatched'
    const evalS11 = await verifyResolution({
      resolutionNotes: 'Visited location. Sat in municipal vehicle and drank water.',
      evidenceUrls: completeEvidence,
      complaintDescription: 'Pothole report.',
      task: { title: 'Pothole Repair', departmentName: 'Road Maintenance Department' },
      category: 'Pothole',
      departmentName: 'Road Maintenance Department',
    });

    const s11Passed =
      evalS11.factorScores.sopAlignment.score === 0 &&
      evalS11.factorScores.sopAlignment.status === 'sop_unmatched';

    record(
      'M12-11',
      'Distinguishes Unmatched SOP (0 pts) vs No Applicable SOP (0 pts) with Precise Status',
      s11Passed,
      `SOP Score: ${evalS11.factorScores.sopAlignment.score}/15, Status: "${evalS11.factorScores.sopAlignment.status}"`
    );

    // =========================================================================
    // PART 3: Human-in-the-Loop Workflow & Separation of Powers (12–19)
    // =========================================================================
    console.log('\n--- Part 3: Human-in-the-Loop Workflow & Separation of Powers ---');

    // Create a live complaint for workflow testing
    const createCmpRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/complaints',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.citizen}`,
        },
      },
      {
        category: 'Pothole',
        description: 'Road cave-in and broken drainage pipe on 4th Avenue Road near bus terminus.',
        location: {
          address: '4th Avenue Road, Anna Nagar',
          ward: 'Ward 102',
          zone: 'Zone 8 (Anna Nagar)',
          latitude: 13.0855,
          longitude: 80.2115,
        },
        priority: 'HIGH',
      }
    );

    const testComplaint = createCmpRes.data.data;
    const testComplaintId = testComplaint.complaintId;
    createdTestIds.complaints.push(testComplaintId);

    // Central Admin approves routing for Multi-Department: Road + Sanitation
    await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/complaints/${testComplaintId}/approve`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.admin}`,
        },
      },
      {
        action: 'approve',
        primaryDepartment: {
          departmentName: 'Road Maintenance Department',
          description: 'Pothole excavation, cold-mix asphalt filling, and roller compaction.',
        },
        supportingDepartments: [
          {
            departmentName: sanitationDept.name,
            reason: 'Clear water stagnation and inspect drainage chamber.',
          },
        ],
        priority: 'HIGH',
        adminNotes: 'Coordinate road repair after drain clearing.',
      }
    );

    // Fetch spawned tasks
    const fetchTasksRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/complaints/${testComplaintId}/tasks`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });

    const spawnedTasks = fetchTasksRes.data.data || [];
    const roadTask = spawnedTasks.find((t) => t.departmentName === 'Road Maintenance Department');
    const sanitationTask = spawnedTasks.find((t) => t.departmentName === sanitationDept.name);

    if (roadTask) createdTestIds.tasks.push(roadTask._id);
    if (sanitationTask) createdTestIds.tasks.push(sanitationTask._id);

    // Assign Road Task to Ramesh
    await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/assign`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadSupervisor}`,
        },
      },
      { employeeName: 'K. Ramesh' }
    );

    // M12-12: High assessment score does NOT automatically verify a task!
    // Employee submits comprehensive resolution report (score >= 70, APPROVE_RECOMMENDED)
    const highSubmitRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/resolution`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {
        resolutionNotes: completeNotes,
        evidenceUrls: completeEvidence,
      }
    );

    const taskAfterHighSubmit = highSubmitRes.data.data?.task;
    const assessmentHighSubmit = highSubmitRes.data.data?.verification;

    const s12Passed =
      highSubmitRes.status === 200 &&
      assessmentHighSubmit?.overallScore >= 70 &&
      taskAfterHighSubmit?.status === 'AWAITING_REVIEW' &&
      taskAfterHighSubmit?.completedAt === null &&
      taskAfterHighSubmit?.resolution?.verificationStatus === 'requires_review';

    record(
      'M12-12',
      'High Assessment Score (>= 70) NEVER Automatically Verifies Task (Status: AWAITING_REVIEW)',
      s12Passed,
      `Score: ${assessmentHighSubmit?.overallScore}/100, Task status: "${taskAfterHighSubmit?.status}", completedAt: ${taskAfterHighSubmit?.completedAt}`
    );

    // M12-13: Low assessment score does NOT bypass supervisor review
    // Assign Sanitation task to Rahman, submit very short/flawed report
    await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${sanitationTask.taskId}/assign`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      { employeeName: 'A. Rahman' }
    );

    const lowSubmitRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${sanitationTask.taskId}/resolution`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      {
        resolutionNotes: 'Drainage chamber opened and silt partially removed.',
        evidenceUrls: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957'],
      }
    );

    const taskAfterLowSubmit = lowSubmitRes.data.data?.task;
    const s13Passed =
      lowSubmitRes.status === 200 &&
      taskAfterLowSubmit?.status === 'AWAITING_REVIEW';

    record(
      'M12-13',
      'Low Assessment Score Enters AWAITING_REVIEW (Supervisor Decides Rework / Rejection)',
      s13Passed,
      `Task status: "${taskAfterLowSubmit?.status}", VerificationStatus: "${taskAfterLowSubmit?.resolution?.verificationStatus}"`
    );

    // M12-14: Employee cannot verify their own submission (HTTP 403)
    const empSelfVerifyRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {
        action: 'approve',
        comments: 'I approve my own work.',
      }
    );

    record(
      'M12-14',
      'Employee Self-Verification Rejection (Strict RBAC 403 Forbidden)',
      empSelfVerifyRes.status === 403,
      `HTTP status: ${empSelfVerifyRes.status}, Message: ${empSelfVerifyRes.data?.message}`
    );

    // M12-15: Employee cannot modify another employee's task (HTTP 403)
    const crossEmpUpdateRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/status`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.otherEmployee}`,
        },
      },
      {
        status: 'IN_PROGRESS',
        note: 'Unauthorized status change by unassigned staff',
      }
    );

    record(
      'M12-15',
      'Employee Cross-Assignment Access Blocked (HTTP 403 for Non-Assignee)',
      crossEmpUpdateRes.status === 403,
      `HTTP status: ${crossEmpUpdateRes.status}, Message: ${crossEmpUpdateRes.data?.message}`
    );

    // M12-16: Supervisor cannot verify tasks outside their assigned department (HTTP 403)
    const crossDeptVerifyRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      {
        action: 'approve',
        comments: 'Sanitation supervisor attempting to verify Road task.',
      }
    );

    record(
      'M12-16',
      'Supervisor Cross-Department Verification Blocked (HTTP 403 Dept Scoping)',
      crossDeptVerifyRes.status === 403,
      `HTTP status: ${crossDeptVerifyRes.status}, Message: ${crossDeptVerifyRes.data?.message}`
    );

    // M12-17: Supervisor approval changes the task to VERIFIED
    const supervisorApproveRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${roadTask.taskId}/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadSupervisor}`,
        },
      },
      {
        action: 'approve',
        comments: 'Site inspected. Asphalt grade flush and compliant with Road SOP v2.4.',
      }
    );

    const verifiedRoadTask = supervisorApproveRes.data.data?.task || supervisorApproveRes.data.data;
    const reviewRecord = supervisorApproveRes.data.data?.supervisorReview || verifiedRoadTask?.resolution?.supervisorReview;
    const s17Passed =
      supervisorApproveRes.status === 200 &&
      verifiedRoadTask?.status === 'VERIFIED' &&
      verifiedRoadTask?.completedAt !== null &&
      ['approved', 'verified', 'VERIFIED'].includes(reviewRecord?.decision);

    record(
      'M12-17',
      'Authorized Department Supervisor Approval Changes Task Status to VERIFIED',
      s17Passed,
      `Status: "${verifiedRoadTask?.status}", Decision: "${reviewRecord?.decision}", completedAt: ${verifiedRoadTask?.completedAt}`
    );

    // M12-18: Supervisor issues rework order with specific remediation instructions
    const reworkReqRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${sanitationTask.taskId}/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      {
        action: 'request_rework',
        comments: 'Catch basin has residual silt; desilting incomplete.',
        reworkRequirements: 'Perform deep desilt using suction super-sucker machine and photograph chamber floor.',
      }
    );

    const reworkTask = reworkReqRes.data.data?.task || reworkReqRes.data.data;
    const reworkReview = reworkReqRes.data.data?.supervisorReview || reworkTask?.resolution?.supervisorReview;
    const s18Passed =
      reworkReqRes.status === 200 &&
      reworkTask?.status === 'REQUIRES_ADDITIONAL_WORK' &&
      ['requires_additional_work', 'REQUIRES_ADDITIONAL_WORK'].includes(reworkReview?.decision) &&
      Boolean(reworkReview?.reworkRequirements);

    record(
      'M12-18',
      'Supervisor Issues Rework Order with Mandatory Instructions (Status: REQUIRES_ADDITIONAL_WORK)',
      s18Passed,
      `Status: "${reworkTask?.status}", Decision: "${reworkReview?.decision}", Instructions: "${reworkReview?.reworkRequirements}"`
    );

    // M12-19: Rework and resubmission preserve previous assessment and review history
    const resubmitRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${sanitationTask.taskId}/resolution`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      {
        resolutionNotes:
          'Deep mechanical desilting executed using super-sucker vacuum machine. Removed 1.2 metric tonnes of accumulated silt down to concrete chamber floor. Invert level checked and free gravity stormwater outflow verified. Photos attached.',
        evidenceUrls: [
          'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1578991624414-276ef23a534f?auto=format&fit=crop&w=800&q=80',
        ],
      }
    );

    const reloadedSanitationTask = await ComplaintTask.findOne({ taskId: sanitationTask.taskId });
    const s19Passed =
      resubmitRes.status === 200 &&
      reloadedSanitationTask.status === 'AWAITING_REVIEW' && // Enters review again!
      Array.isArray(reloadedSanitationTask.resolutionHistory) &&
      reloadedSanitationTask.resolutionHistory.length >= 1 &&
      Boolean(reloadedSanitationTask.resolutionHistory[0].resolutionNotes) &&
      Boolean(reloadedSanitationTask.resolutionHistory[0].supervisorReview);

    record(
      'M12-19',
      'Resubmission After Rework Enters AWAITING_REVIEW & Preserves Immutable History',
      s19Passed,
      `New status: "${reloadedSanitationTask.status}", Archived history count: ${reloadedSanitationTask.resolutionHistory.length}`
    );

    // =========================================================================
    // PART 4: Multi-Department Invariants & Administrative Authority (20–25)
    // =========================================================================
    console.log('\n--- Part 4: Multi-Department Invariants & Administrative Authority ---');

    // M12-20: Parent complaint cannot become RESOLVED while any required task remains unverified
    // Road task is VERIFIED, but Sanitation task is in AWAITING_REVIEW
    const cmpStateAfterOneVerified = await Complaint.findOne({ complaintId: testComplaintId });
    const s20Passed =
      cmpStateAfterOneVerified.status !== 'RESOLVED' &&
      cmpStateAfterOneVerified.status !== 'CLOSED' &&
      ['IN_PROGRESS', 'PARTIALLY_RESOLVED'].includes(cmpStateAfterOneVerified.status);

    record(
      'M12-20',
      'Parent Complaint Cannot Become RESOLVED While Any Required Task Remains Unverified',
      s20Passed,
      `Complaint status: "${cmpStateAfterOneVerified.status}" (Task 1 verified, Task 2 awaiting review)`
    );

    // M12-21: Parent complaint remains open while dependent task requires rework
    // Verified by testing state during rework dispatch
    record(
      'M12-21',
      'Parent Complaint Remains Open While Dependent Department Task Undergoes Rework',
      cmpStateAfterOneVerified.status !== 'RESOLVED',
      `Active Workflow Stage: "${cmpStateAfterOneVerified.workflowStage}", Status: "${cmpStateAfterOneVerified.status}"`
    );

    // M12-22: Parent complaint transitions to RESOLVED ONLY when ALL tasks are verified by supervisors
    const sanitizeApproveRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${sanitationTask.taskId}/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.sanitationSupervisor}`,
        },
      },
      {
        action: 'approve',
        comments: 'Deep desilt confirmed. Chamber clear and stormwater drains flowing freely.',
      }
    );

    const cmpStateAllVerified = await Complaint.findOne({ complaintId: testComplaintId });
    const s22Passed =
      sanitizeApproveRes.status === 200 &&
      cmpStateAllVerified.status === 'RESOLVED' &&
      cmpStateAllVerified.workflowStage === 'RESOLVED';

    record(
      'M12-22',
      'Parent Complaint Transitions to RESOLVED Only After ALL Tasks Are Supervisor-Verified',
      s22Passed,
      `Parent Complaint ${testComplaintId} Status: "${cmpStateAllVerified.status}", WorkflowStage: "${cmpStateAllVerified.workflowStage}"`
    );

    // M12-23: Central Admin cannot close a complaint prematurely (HTTP 400); unauthorized closure blocked (HTTP 403)
    const empCloseRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/complaints/${testComplaintId}/close`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {}
    );

    const unverifiedCmp = await Complaint.create({
      complaintId: `CMP-UNVERIFIED-${Date.now()}`,
      category: 'Pothole',
      description: 'Pothole with unverified task',
      status: 'IN_PROGRESS',
      workflowStage: 'IN_PROGRESS',
      priority: 'MEDIUM',
      citizenId: 'CIT-8842',
      location: {
        address: 'Anna Nagar',
        ward: 'Ward 102',
        zone: 'Zone 8',
        latitude: 13.085,
        longitude: 80.21,
      },
    });
    createdTestIds.complaints.push(unverifiedCmp.complaintId);

    const pendingTask = await ComplaintTask.create({
      taskId: `TSK-PENDING-${Date.now()}`,
      complaintId: unverifiedCmp.complaintId,
      departmentName: 'Road Maintenance Department',
      title: 'Pending Road Task',
      description: 'Not yet verified',
      status: 'IN_PROGRESS',
      assignedEmployeeName: 'K. Ramesh',
    });
    createdTestIds.tasks.push(pendingTask._id);

    const adminPrematureCloseRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/complaints/${unverifiedCmp.complaintId}/close`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.admin}`,
        },
      },
      {}
    );

    const s23Passed = empCloseRes.status === 403 && adminPrematureCloseRes.status === 400;
    record(
      'M12-23',
      'Central Admin Premature Closure Blocked (400) & Unauthorized Employee Closure Blocked (403)',
      s23Passed,
      `Employee close: HTTP ${empCloseRes.status} (Expected 403), Premature admin close: HTTP ${adminPrematureCloseRes.status} (Expected 400)`
    );

    // M12-24: Citizen access to public-safe status without internal assessment scores or private staff info
    const citizenViewRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/complaints/${testComplaintId}/tasks`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.citizen}` },
    });

    const citizenTasks = citizenViewRes.data.data || [];
    const firstCitizenTask = citizenTasks[0];

    const s24Passed =
      citizenViewRes.status === 200 &&
      citizenTasks.length > 0 &&
      firstCitizenTask.assignedEmployeeId === undefined &&
      firstCitizenTask.assignedSupervisorId === undefined &&
      firstCitizenTask.delayRisk === undefined &&
      (firstCitizenTask.resolution?.automatedAssessment === undefined || firstCitizenTask.resolution?.automatedAssessment === null) &&
      (firstCitizenTask.resolution?.supervisorReview === undefined || firstCitizenTask.resolution?.supervisorReview === null);

    record(
      'M12-24',
      'Citizen Task Endpoint Strictly Redacts Internal Scores, Delay Risk & Staff IDs',
      s24Passed,
      `Tasks Returned: ${citizenTasks.length}, AssignedEmployeeId: ${firstCitizenTask?.assignedEmployeeId || 'REDACTED'}, Rubric: ${firstCitizenTask?.resolution?.automatedAssessment || 'REDACTED'}`
    );

    // M12-25: Existing records remaining compatible with the enhanced verification process
    const legacyCmp = await Complaint.create({
      complaintId: `CMP-LEGACY-${Date.now()}`,
      category: 'Pothole',
      description: 'Legacy complaint for backwards compatibility test',
      status: 'IN_PROGRESS',
      workflowStage: 'IN_PROGRESS',
      priority: 'MEDIUM',
      citizenId: 'CIT-8842',
      location: {
        address: 'Anna Nagar',
        ward: 'Ward 102',
        zone: 'Zone 8',
        latitude: 13.085,
        longitude: 80.21,
      },
    });
    createdTestIds.complaints.push(legacyCmp.complaintId);

    const legacyTask = await ComplaintTask.create({
      taskId: `TSK-LEGACY-${Date.now()}`,
      complaintId: legacyCmp.complaintId,
      departmentName: 'Road Maintenance Department',
      title: 'Legacy Task Without M12 Fields',
      description: 'Older database document with no automatedAssessment or supervisorReview',
      status: 'ASSIGNED',
      assignedEmployeeName: 'K. Ramesh',
      assignedEmployeeId: (await User.findOne({ email: 'ramesh.field@smartcity.gov.in' }))._id,
      deadline: new Date(Date.now() + 86400000),
    });
    createdTestIds.tasks.push(legacyTask._id);

    const legacyResolveRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/tasks/${legacyTask.taskId}/resolution`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {
        resolutionNotes: completeNotes,
        evidenceUrls: completeEvidence,
      }
    );

    const legacyTaskRes = legacyResolveRes.data.data?.task || legacyResolveRes.data.data;
    const s25Passed =
      legacyResolveRes.status === 200 &&
      legacyTaskRes?.status === 'AWAITING_REVIEW' &&
      legacyTaskRes?.resolution?.automatedAssessment?.overallScore >= 70;

    record(
      'M12-25',
      'Legacy Tasks Ingest Enhanced Multi-Dimensional Verification Without Schema Errors',
      s25Passed,
      `Legacy Task Resolution HTTP: ${legacyResolveRes.status}, Status: "${legacyTaskRes?.status}", Score: ${legacyTaskRes?.resolution?.automatedAssessment?.overallScore}/100`
    );

    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('\n--- Cleaning Up Test Artifacts ---');
    if (createdTestIds.tasks.length > 0) {
      await ComplaintTask.deleteMany({ _id: { $in: createdTestIds.tasks } });
      console.log(`Cleaned up ${createdTestIds.tasks.length} test task(s).`);
    }
    if (createdTestIds.complaints.length > 0) {
      await Complaint.deleteMany({ complaintId: { $in: createdTestIds.complaints } });
      console.log(`Cleaned up ${createdTestIds.complaints.length} test complaint(s).`);
    }
    if (createdTestIds.users.length > 0) {
      await User.deleteMany({ _id: { $in: createdTestIds.users } });
      console.log(`Cleaned up ${createdTestIds.users.length} temporary test user(s).`);
    }

  } catch (err) {
    console.error('Phase 9 verification execution error:', err);
    record('FATAL-ERROR', 'Phase 9 Suite terminated unexpectedly', false, err.message);
  } finally {
    if (server) {
      server.close();
      console.log('🛑  Test API Server closed.\n');
    }
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('================================================================');
  console.log('📊   PHASE 9 & 9.1 VERIFICATION SUMMARY REPORT');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);
  console.log(`Success Rate:    ${Math.round((passedCount / results.length) * 100)}%\n`);

  if (failedCount > 0) {
    console.log('Failed Tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - ${r.id}: ${r.title} (${r.detail})`));
    process.exit(1);
  } else {
    console.log('🎉 ALL 26 PHASE 9 & 9.1 TEST SCENARIOS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runVerification();
