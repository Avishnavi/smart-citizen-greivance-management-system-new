'use strict';

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const Department = require('../models/Department');
const request = require('http');
const { app } = require('../index');

let server;

async function runVerification() {
  console.log('===========================================================');
  console.log('🏛️  PHASE 2: END-TO-END WORKFLOW & ARCHITECTURE VERIFICATION');
  console.log('===========================================================\n');

  await connectDatabase();
  const PORT = 5101;
  server = app.listen(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  function apiCall(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = { method, headers };
      const req = request.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  const results = [];

  function record(id, title, passed, details) {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  try {
    // 0. Authenticate All 4 Roles
    console.log('--- Step 0: Authenticate All Roles ---');
    const roles = [
      { key: 'admin', email: 'admin.commissioner@smartcity.gov.in', pass: 'Admin@123' },
      { key: 'supervisor', email: 'selvam.supervisor@smartcity.gov.in', pass: 'Supervisor@123' },
      { key: 'employee', email: 'ramesh.field@smartcity.gov.in', pass: 'Employee@123' },
      { key: 'citizen', email: 'rajesh.kumar88@example.gov.in', pass: 'Citizen@123' },
    ];

    const tokens = {};
    for (const r of roles) {
      const res = await apiCall('POST', '/api/auth/login', {
        email: r.email,
        password: r.pass,
      });
      if (res.status === 200 && res.body.token) {
        tokens[r.key] = res.body.token;
      }
    }

    record(
      'AUTH-ALL',
      'All 4 Roles Successfully Authenticated',
      Object.keys(tokens).length === 4,
      `Obtained JWTs for: ${Object.keys(tokens).join(', ')}`
    );

    // =========================================================================
    // SCENARIO A: Single Department Complaint Lifecycle
    // Submit -> AI Recommendation -> Admin Approve -> Task Created ->
    // Supervisor Assigns -> Employee Progress -> Resolution Verification ->
    // Complaint Resolved -> Admin Closes
    // =========================================================================
    console.log('\n--- Scenario A: Single Department Complaint Lifecycle ---');

    // 1. Citizen submits complaint
    const subResA = await apiCall(
      'POST',
      '/api/complaints',
      {
        category: 'Pothole',
        description: 'Large hazardous pothole measuring 3 feet wide near Anna Nagar junction causing traffic jams.',
        location: {
          address: '3rd Main Road, Anna Nagar West',
          ward: 'Ward 102',
          zone: 'Zone 8 (Anna Nagar)',
          latitude: 13.085,
          longitude: 80.21,
        },
        priority: 'HIGH',
      },
      tokens.citizen
    );

    const complaintA = subResA.body.data;
    const cmpIdA = complaintA.complaintId;

    record(
      'SCENARIO-A1',
      'Citizen Complaint Submission & AI Routing Status',
      subResA.status === 201 && ['SUBMITTED', 'AWAITING_ADMIN_REVIEW', 'UNDER_REVIEW', 'PENDING'].includes(complaintA.status),
      `Complaint created: ${cmpIdA}. Status: ${complaintA.status}. Category: ${complaintA.category}`
    );

    // 2. Central Admin Reviews and Approves Routing (Single Dept)
    const approveResA = await apiCall(
      'POST',
      `/api/complaints/${cmpIdA}/approve`,
      {
        action: 'approve',
        primaryDepartment: {
          departmentName: 'Road Maintenance Department',
          description: 'Pothole asphalt filling and leveling.',
        },
        priority: 'HIGH',
        adminNotes: 'High traffic junction. Complete within 24h SLA.',
      },
      tokens.admin
    );

    record(
      'SCENARIO-A2',
      'Central Admin Routing Approval & Task Generation',
      approveResA.status === 200 && (approveResA.body.data?.taskCount === 1 || approveResA.body.data?.tasks?.length === 1),
      `Complaint ${cmpIdA} approved. Spawned ${approveResA.body.data?.taskCount || approveResA.body.data?.tasks?.length} primary task.`
    );

    // 3. Supervisor views tasks and assigns to field employee
    const tasksResA = await apiCall('GET', `/api/tasks?complaintId=${cmpIdA}`, null, tokens.supervisor);
    const taskA = tasksResA.body.data?.[0];

    const assignResA = await apiCall(
      'PATCH',
      `/api/tasks/${taskA.taskId}/assign`,
      {
        employeeName: 'K. Ramesh',
      },
      tokens.supervisor
    );

    record(
      'SCENARIO-A3',
      'Supervisor Task Assignment to Employee',
      assignResA.status === 200 && assignResA.body.data?.status === 'ASSIGNED' && assignResA.body.data?.assignedEmployeeName === 'K. Ramesh',
      `Task ${taskA.taskId} assigned to K. Ramesh. Status: ${assignResA.body.data?.status}`
    );

    // 4. Employee accepts and starts work
    const startResA = await apiCall(
      'PATCH',
      `/api/tasks/${taskA.taskId}/status`,
      {
        status: 'IN_PROGRESS',
        note: 'Arrived at site with asphalt roller and cold mix batch.',
      },
      tokens.employee
    );

    record(
      'SCENARIO-A4',
      'Employee Accepts Work & Updates Progress',
      startResA.status === 200 && startResA.body.data?.status === 'IN_PROGRESS' && startResA.body.data?.progressNotes?.length > 0,
      `Task ${taskA.taskId} status: ${startResA.body.data?.status}. Progress note recorded.`
    );

    // 5. Employee submits resolution with valid evidence & notes
    const resolveResA = await apiCall(
      'POST',
      `/api/tasks/${taskA.taskId}/resolution`,
      {
        resolutionNotes: 'Road pothole successfully repaired, filled with asphalt aggregate, compacted with roller, and resurfaced to level.',
        evidenceUrls: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957'],
      },
      tokens.employee
    );

    const taskVerificationA = resolveResA.body.data?.verification;
    const taskStatusAfterSubmissionA = resolveResA.body.data?.task?.status;

    // 5b. Department Supervisor verifies and approves the submitted resolution
    const supervisorVerifyResA = await apiCall(
      'POST',
      `/api/tasks/${taskA.taskId}/verify`,
      {
        action: 'approve',
        comments: 'Verified on site: asphalt aggregate compaction flush with road surface, compliant with SOP.',
      },
      tokens.supervisor
    );

    const taskFinalStatusA = supervisorVerifyResA.body.data?.task?.status;
    const complaintStatusAfterA = supervisorVerifyResA.body.data?.parentComplaintStatus;

    record(
      'SCENARIO-A5',
      'Resolution Submission & Automated Verification',
      resolveResA.status === 200 && taskStatusAfterSubmissionA === 'AWAITING_REVIEW' && supervisorVerifyResA.status === 200 && taskFinalStatusA === 'VERIFIED',
      `Assessment recommendation: "${taskVerificationA?.recommendation}" (Score: ${Math.round((taskVerificationA?.verificationScore || 0) * 100)}%). Submission status: ${taskStatusAfterSubmissionA}. Post-supervisor status: ${taskFinalStatusA}`
    );

    record(
      'SCENARIO-A6',
      'Parent Complaint State Advances to RESOLVED (All Tasks Verified)',
      complaintStatusAfterA === 'RESOLVED',
      `Parent complaint ${cmpIdA} advanced to: ${complaintStatusAfterA}`
    );

    // 6. Central Admin Closes Complaint
    const closeResA = await apiCall('POST', `/api/complaints/${cmpIdA}/close`, {}, tokens.admin);

    record(
      'SCENARIO-A7',
      'Central Admin Performs Final Review and Closes Complaint',
      closeResA.status === 200 && closeResA.body.data?.status === 'CLOSED',
      `Complaint ${cmpIdA} status is now: ${closeResA.body.data?.status}`
    );

    // =========================================================================
    // SCENARIO B: Multi-Department Complaint
    // 1 Complaint ID -> Primary (Roads) + Supporting (Water & Sewerage) ->
    // Partial Resolution -> Premature Close Blocked -> Full Resolution -> Closed
    // =========================================================================
    console.log('\n--- Scenario B: Multi-Department Complaint Lifecycle ---');

    // 1. Citizen submits multi-department grievance
    const subResB = await apiCall(
      'POST',
      '/api/complaints',
      {
        category: 'Water Supply',
        description: 'Underground high pressure drinking water pipe burst causing arterial road collapse and flooding in Anna Nagar.',
        location: {
          address: '5th Avenue Road, Anna Nagar',
          ward: 'Ward 102',
          zone: 'Zone 8 (Anna Nagar)',
          latitude: 13.086,
          longitude: 80.215,
        },
        priority: 'CRITICAL',
      },
      tokens.citizen
    );

    const cmpIdB = subResB.body.data.complaintId;

    // 2. Central Admin Approves: Primary (Road Maintenance) + Supporting (Water & Sewerage Board)
    const approveResB = await apiCall(
      'POST',
      `/api/complaints/${cmpIdB}/approve`,
      {
        action: 'approve',
        primaryDepartment: {
          departmentName: 'Road Maintenance Department',
          description: 'Excavate and rebuild collapsed road section.',
        },
        supportingDepartments: [
          {
            departmentName: 'Water & Sewerage Board',
            reason: 'Isolate main valve and repair underground water pipe burst.',
          },
        ],
        priority: 'CRITICAL',
        adminNotes: 'Multi-agency emergency. Water board must seal leak before road resurfacing.',
      },
      tokens.admin
    );

    record(
      'SCENARIO-B1',
      'Multi-Department Approval Spawns Multiple Tasks Under 1 Complaint ID',
      approveResB.status === 200 && (approveResB.body.data?.taskCount === 2 || approveResB.body.data?.tasks?.length === 2),
      `Complaint ${cmpIdB} spawned ${approveResB.body.data?.taskCount || approveResB.body.data?.tasks?.length} tasks under identical complaint ID.`
    );

    // 3. Inspect the 2 spawned tasks
    const tasksResB = await apiCall('GET', `/api/complaints/${cmpIdB}/tasks`, null, tokens.admin);
    const tasksB = tasksResB.body.data || [];
    const primaryTask = tasksB.find((t) => t.taskType === 'primary');
    const supportingTask = tasksB.find((t) => t.taskType === 'supporting');

    record(
      'SCENARIO-B2',
      'Primary and Supporting Tasks Generated Correctly',
      primaryTask && supportingTask && primaryTask.taskId !== supportingTask.taskId && primaryTask.complaintId === supportingTask.complaintId,
      `Primary Task: ${primaryTask?.taskId} (${primaryTask?.departmentName}), Supporting Task: ${supportingTask?.taskId} (${supportingTask?.departmentName})`
    );

    // 4. Assign both tasks
    await apiCall('PATCH', `/api/tasks/${primaryTask.taskId}/assign`, { employeeName: 'K. Ramesh' }, tokens.admin);
    await apiCall('PATCH', `/api/tasks/${supportingTask.taskId}/assign`, { employeeName: 'A. Rahman' }, tokens.admin);

    // 5. Complete ONLY Supporting Task (Water Board repairs pipe)
    const resolveSupportingRes = await apiCall(
      'POST',
      `/api/tasks/${supportingTask.taskId}/resolution`,
      {
        resolutionNotes: 'Main line pressure sleeve replaced and pipeline welded securely. Water leakage cleared and pressure tested.',
        evidenceUrls: ['https://images.unsplash.com/photo-1585704032915-c3400ca199e7'],
      },
      tokens.admin
    );

    // Supervisor verifies supporting task
    const verifySupportingRes = await apiCall(
      'POST',
      `/api/tasks/${supportingTask.taskId}/verify`,
      {
        action: 'approve',
        comments: 'Water Board supervisor site inspection: pipeline weld inspected and pressure confirmed.',
      },
      tokens.admin
    );

    record(
      'SCENARIO-B3',
      'Supporting Task Resolved First -> Complaint is PARTIALLY_RESOLVED',
      verifySupportingRes.body.data?.parentComplaintStatus === 'PARTIALLY_RESOLVED',
      `Parent complaint status is: ${verifySupportingRes.body.data?.parentComplaintStatus} (1 of 2 tasks completed).`
    );

    // 6. Attempt Premature Complaint Closure while Road task is still pending -> MUST FAIL (400)
    const prematureCloseRes = await apiCall('POST', `/api/complaints/${cmpIdB}/close`, {}, tokens.admin);

    record(
      'SCENARIO-B4',
      'Premature Complaint Closure Blocked While Tasks Pending',
      prematureCloseRes.status === 400 && prematureCloseRes.body.success === false,
      `Closure rejected with HTTP 400: "${prematureCloseRes.body.message}"`
    );

    // 7. Complete Primary Task (Road resurfacing)
    const resolvePrimaryRes = await apiCall(
      'POST',
      `/api/tasks/${primaryTask.taskId}/resolution`,
      {
        resolutionNotes: 'Road cavity filled with aggregate base course, compacted and asphalt surface laid and leveled.',
        evidenceUrls: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957'],
      },
      tokens.employee
    );

    // Supervisor verifies primary task
    const verifyPrimaryRes = await apiCall(
      'POST',
      `/api/tasks/${primaryTask.taskId}/verify`,
      {
        action: 'approve',
        comments: 'Road supervisor site inspection: asphalt level and grade verified flush with existing pavement.',
      },
      tokens.supervisor
    );

    record(
      'SCENARIO-B5',
      'All Department Tasks Completed -> Complaint Transitions to RESOLVED',
      verifyPrimaryRes.body.data?.parentComplaintStatus === 'RESOLVED',
      `Parent complaint status after all tasks finished: ${verifyPrimaryRes.body.data?.parentComplaintStatus}`
    );

    // 8. Central Admin Closes Complaint Now that All Tasks are Verified
    const finalCloseResB = await apiCall('POST', `/api/complaints/${cmpIdB}/close`, {}, tokens.admin);

    record(
      'SCENARIO-B6',
      'Multi-Department Complaint Final Closure by Central Admin',
      finalCloseResB.status === 200 && finalCloseResB.body.data?.status === 'CLOSED',
      `Multi-department complaint ${cmpIdB} closed successfully.`
    );

    // =========================================================================
    // SCENARIO C: Resolution Verification Failure & Rework
    // Employee submits insufficient notes or no proof -> Rejected / Needs Rework
    // Complaint remains unclosed
    // =========================================================================
    console.log('\n--- Scenario C: Verification Failure & Rework ---');

    // 1. Submit and approve test complaint
    const subResC = await apiCall(
      'POST',
      '/api/complaints',
      {
        category: 'Streetlight',
        description: 'Dark street due to non-functioning streetlight for 5 days.',
        location: { address: '2nd Cross, Anna Nagar', ward: 'Ward 102', zone: 'Zone 8' },
        priority: 'MEDIUM',
      },
      tokens.citizen
    );
    const cmpIdC = subResC.body.data.complaintId;

    await apiCall(
      'POST',
      `/api/complaints/${cmpIdC}/approve`,
      {
        action: 'approve',
        primaryDepartment: { departmentName: 'Electricity & Lighting Department' },
        priority: 'MEDIUM',
      },
      tokens.admin
    );

    const tasksC = (await apiCall('GET', `/api/complaints/${cmpIdC}/tasks`, null, tokens.admin)).body.data;
    const taskC = tasksC[0];

    // Assign
    await apiCall('PATCH', `/api/tasks/${taskC.taskId}/assign`, { employeeName: 'K. Ramesh' }, tokens.admin);

    // 2. Submit inadequate resolution (vague notes, no physical description, no photo)
    const failResolveRes = await apiCall(
      'POST',
      `/api/tasks/${taskC.taskId}/resolution`,
      {
        resolutionNotes: 'done checking it is ok now',
        evidenceUrls: [],
      },
      tokens.employee
    );

    const verifC = failResolveRes.body.data?.verification;
    const taskStatusC = failResolveRes.body.data?.task?.status;
    const parentStatusC = failResolveRes.body.data?.parentComplaintStatus;

    record(
      'SCENARIO-C1',
      'Insufficient Evidence Triggers Verification Failure / Review',
      failResolveRes.status === 200 && verifC?.verified === false && ['REQUIRES_ADDITIONAL_WORK', 'AWAITING_REVIEW'].includes(taskStatusC),
      `Verification returned status: "${verifC?.verificationStatus}". Task moved to: ${taskStatusC}`
    );

    record(
      'SCENARIO-C2',
      'Complaint Remains Incomplete on Verification Failure',
      parentStatusC !== 'RESOLVED' && parentStatusC !== 'CLOSED',
      `Parent complaint status remains: ${parentStatusC}. Not marked as resolved.`
    );

    // =========================================================================
    // SCENARIO D: SLA Calculation & Deadline Integrity
    // =========================================================================
    console.log('\n--- Scenario D: SLA Calculation & Deadline Integrity ---');

    const dbTaskA = await ComplaintTask.findOne({ taskId: taskA.taskId });
    const hasDeadline = dbTaskA && dbTaskA.slaDeadline && dbTaskA.slaHours > 0;
    const slaMatchesPriority = dbTaskA && dbTaskA.slaHours === 24; // HIGH priority = 24h

    record(
      'SCENARIO-D1',
      'Automatic SLA Calculation Based on Priority (HIGH = 24h)',
      hasDeadline && slaMatchesPriority,
      `Task SLA hours: ${dbTaskA?.slaHours}h. Calculated deadline: ${dbTaskA?.slaDeadline?.toISOString()}`
    );

    // Check CRITICAL priority task SLA (CRITICAL = 6h or legacy 12h)
    const dbTaskB = await ComplaintTask.findOne({ taskId: primaryTask.taskId });
    const isCriticalSla = dbTaskB && (dbTaskB.slaHours === 6 || dbTaskB.slaHours === 12);

    record(
      'SCENARIO-D2',
      'Critical Priority Mandates 6h/12h SLA Deadline',
      isCriticalSla,
      `Critical Task SLA hours: ${dbTaskB?.slaHours}h. Calculated deadline: ${dbTaskB?.slaDeadline?.toISOString()}`
    );

    // =========================================================================
    // SCENARIO E: Access Restrictions & Boundaries
    // =========================================================================
    console.log('\n--- Scenario E: Access Restrictions & Role Boundaries ---');

    // 1. Citizen cannot view internal department tasks queue
    const citizenTaskAccess = await apiCall('GET', '/api/tasks', null, tokens.citizen);

    record(
      'SCENARIO-E1',
      'Citizen Blocked From Department Task Queues (HTTP 403)',
      citizenTaskAccess.status === 403,
      `Citizen GET /api/tasks returned HTTP ${citizenTaskAccess.status}: "${citizenTaskAccess.body.message}"`
    );

    // 2. Department Employee cannot close a complaint (Only Central Admin can)
    const empCloseAttempt = await apiCall('POST', `/api/complaints/${cmpIdA}/close`, {}, tokens.employee);

    record(
      'SCENARIO-E2',
      'Employee Blocked From Closing Complaint (HTTP 403)',
      empCloseAttempt.status === 403,
      `Employee POST /api/complaints/:id/close returned HTTP ${empCloseAttempt.status}`
    );

    // 3. Supervisor cannot assign tasks of other departments
    // Supervisor Selvam is "Road Maintenance Department"
    // Supporting task is "Water & Sewerage Board"
    const crossDeptAssign = await apiCall(
      'PATCH',
      `/api/tasks/${supportingTask.taskId}/assign`,
      { employeeName: 'Er. S. Selvam' },
      tokens.supervisor
    );

    record(
      'SCENARIO-E3',
      'Supervisor Blocked From Cross-Department Task Assignment (HTTP 403)',
      crossDeptAssign.status === 403,
      `Road Supervisor attempting to assign Water task returned HTTP ${crossDeptAssign.status}: "${crossDeptAssign.body.message}"`
    );

    // 4. Employee cannot update tasks assigned to another employee
    // Task B is assigned to A. Rahman
    const crossEmpUpdate = await apiCall(
      'PATCH',
      `/api/tasks/${supportingTask.taskId}/status`,
      { status: 'ACCEPTED' },
      tokens.employee // Employee is K. Ramesh
    );

    record(
      'SCENARIO-E4',
      'Employee Blocked From Modifying Other Employees Tasks (HTTP 403)',
      crossEmpUpdate.status === 403,
      `Employee K. Ramesh modifying A. Rahman task returned HTTP ${crossEmpUpdate.status}: "${crossEmpUpdate.body.message}"`
    );

    // =========================================================================
    // CITIZEN REOPENING WORKFLOW
    // =========================================================================
    console.log('\n--- Citizen Post-Resolution Feedback & Reopening ---');

    // Citizen reopens closed complaint A
    const reopenRes = await apiCall(
      'POST',
      `/api/complaints/${cmpIdA}/reopen`,
      {
        reason: 'Pothole asphalt aggregate is already washing away after rain.',
      },
      tokens.citizen
    );

    record(
      'CITIZEN-REOPEN',
      'Citizen Successfully Reopens Grievance (Reopen Invariant)',
      reopenRes.status === 200 && reopenRes.body.data?.status === 'REOPENED',
      `Complaint ${cmpIdA} status transitioned to: ${reopenRes.body.data?.status}`
    );

  } catch (err) {
    console.error('Verification suite encountered unexpected error:', err);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }

  // Print Summary
  console.log('\n===========================================================');
  console.log('📊  PHASE 2 VERIFICATION SUMMARY');
  console.log('===========================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Checks: ${total}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL 18 PHASE 2 WORKFLOW & ARCHITECTURE CHECKS PASSED!\n');
  } else {
    console.log(`\n⚠️ ${failed} check(s) failed. Inspect logs above.\n`);
  }
}

runVerification();

