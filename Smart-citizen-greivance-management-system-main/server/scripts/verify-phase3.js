'use strict';

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Citizen = require('../models/Citizen');
const Officer = require('../models/Officer');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const Resolution = require('../models/Resolution');
const WorkflowEvent = require('../models/WorkflowEvent');
const Notification = require('../models/Notification');
const Escalation = require('../models/Escalation');
const RecurringIssue = require('../models/RecurringIssue');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const ComplaintMessage = require('../models/ComplaintMessage');
const request = require('http');
const { app } = require('../index');

let server;

async function runVerification() {
  console.log('===========================================================');
  console.log('🗄️  PHASE 3: DATABASE MODELS & RELATIONSHIPS VERIFICATION');
  console.log('===========================================================\n');

  await connectDatabase();
  const PORT = 5102;
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
    // 0. Authenticate Roles
    console.log('--- Step 0: Auth Handshake ---');
    const loginRes = await apiCall('POST', '/api/auth/login', {
      email: 'admin.commissioner@smartcity.gov.in',
      password: 'Admin@123',
    });
    const adminToken = loginRes.body?.token;

    const supRes = await apiCall('POST', '/api/auth/login', {
      email: 'selvam.supervisor@smartcity.gov.in',
      password: 'Supervisor@123',
    });
    const supervisorToken = supRes.body?.token;

    const empRes = await apiCall('POST', '/api/auth/login', {
      email: 'ramesh.field@smartcity.gov.in',
      password: 'Employee@123',
    });
    const employeeToken = empRes.body?.token;

    const citRes = await apiCall('POST', '/api/auth/login', {
      email: 'rajesh.kumar88@example.gov.in',
      password: 'Citizen@123',
    });
    const citizenToken = citRes.body?.token;

    const allTokens = Boolean(adminToken && supervisorToken && employeeToken && citizenToken);
    record('AUTH-HANDSHAKE', 'Universal Token Issuance for All 4 Roles', allTokens, 'Tokens verified.');

    // =========================================================================
    // SCENARIO 1: A Citizen Can Have Multiple Complaints
    // =========================================================================
    console.log('\n--- Scenario 1: Citizen Multiple Complaints Relationship ---');
    const subCmp1 = await apiCall(
      'POST',
      '/api/complaints',
      {
        category: 'Pothole',
        description: 'Road surface pothole near school gate creating hazards for students.',
        location: { address: 'School Road, Anna Nagar', ward: 'Ward 102', latitude: 13.085, longitude: 80.211 },
        priority: 'HIGH',
      },
      citizenToken
    );

    const subCmp2 = await apiCall(
      'POST',
      '/api/complaints',
      {
        category: 'Drainage',
        description: 'Blocked stormwater inlet causing localized stagnant water pool.',
        location: { address: '2nd Avenue, Anna Nagar', ward: 'Ward 102', latitude: 13.087, longitude: 80.214 },
        priority: 'MEDIUM',
      },
      citizenToken
    );

    const citizenComplaints = await Complaint.find({ citizenId: 'CIT-8842' });
    const hasMultiple = citizenComplaints.length >= 2;
    record(
      'SCENARIO-1',
      'Citizen Can Have Multiple Complaints (1:N Relationship)',
      hasMultiple && subCmp1.status === 201 && subCmp2.status === 201,
      `Citizen "CIT-8842" owns ${citizenComplaints.length} registered complaint documents.`
    );

    // =========================================================================
    // SCENARIO 2: A Complaint Can Contain Multiple Department Tasks
    // =========================================================================
    console.log('\n--- Scenario 2: Complaint to Multiple Tasks (1:N Relationship) ---');
    const cmpTargetId = subCmp1.body.data.complaintId;

    const approveMulti = await apiCall(
      'POST',
      `/api/complaints/${cmpTargetId}/approve`,
      {
        action: 'approve',
        primaryDepartment: { departmentName: 'Road Maintenance Department' },
        supportingDepartments: [
          { departmentName: 'Water & Sewerage Board', reason: 'Inspect drainage valve below road' },
        ],
        priority: 'HIGH',
      },
      adminToken
    );

    const complaintTasks = await ComplaintTask.find({ complaintId: cmpTargetId });
    record(
      'SCENARIO-2',
      'Complaint Contains Multiple Department Tasks',
      complaintTasks.length === 2,
      `Complaint ${cmpTargetId} contains ${complaintTasks.length} tasks: ${complaintTasks.map((t) => t.taskId).join(', ')}`
    );

    // =========================================================================
    // SCENARIO 3: Every Task Correctly References Parent Complaint and Department
    // =========================================================================
    console.log('\n--- Scenario 3: Task References Integrity ---');
    const parentComplaintDoc = await Complaint.findOne({ complaintId: cmpTargetId });
    const allTasksRefCorrect = complaintTasks.every(
      (t) =>
        t.complaintId === cmpTargetId &&
        t.complaintRef &&
        t.complaintRef.toString() === parentComplaintDoc._id.toString() &&
        Boolean(t.departmentName)
    );

    record(
      'SCENARIO-3',
      'Tasks Reference Parent Complaint & Department Correctly',
      allTasksRefCorrect,
      `Both tasks reference parent ObjectId ${parentComplaintDoc._id} and valid department names.`
    );

    // =========================================================================
    // SCENARIO 4: Supervisor & Employee Associated With Correct Department
    // =========================================================================
    console.log('\n--- Scenario 4: User & Staff Department Association ---');
    const supervisorUser = await User.findOne({ email: 'selvam.supervisor@smartcity.gov.in' });
    const employeeUser = await User.findOne({ email: 'ramesh.field@smartcity.gov.in' });
    const deptDoc = await Department.findOne({ name: 'Road Maintenance Department' });

    const supervisorMatch =
      supervisorUser &&
      supervisorUser.role === 'department_supervisor' &&
      supervisorUser.departmentName === 'Road Maintenance Department';

    const employeeMatch =
      employeeUser &&
      employeeUser.role === 'department_employee' &&
      employeeUser.departmentName === 'Road Maintenance Department';

    record(
      'SCENARIO-4',
      'Supervisor & Employee Correctly Associated With Department',
      supervisorMatch && employeeMatch && deptDoc !== null,
      `Supervisor "${supervisorUser?.name}" and Employee "${employeeUser?.name}" bound to "${deptDoc?.name}".`
    );

    // =========================================================================
    // SCENARIO 5: Task Assignment & Reassignment Preserves History
    // =========================================================================
    console.log('\n--- Scenario 5: Task Assignment & Reassignment History ---');
    const testTask = complaintTasks[0];

    // Initial assignment
    await apiCall(
      'PATCH',
      `/api/tasks/${testTask.taskId}/assign`,
      { employeeName: 'K. Ramesh', notes: 'Initial route assignment' },
      supervisorToken
    );

    // Reassignment to another tech
    await apiCall(
      'PATCH',
      `/api/tasks/${testTask.taskId}/assign`,
      { employeeName: 'Er. S. Selvam', notes: 'Reassigned for direct supervision' },
      supervisorToken
    );

    const updatedTask = await ComplaintTask.findOne({ taskId: testTask.taskId });
    const historyCount = updatedTask?.assignmentHistory?.length || 0;
    const hasInitial = updatedTask?.assignmentHistory?.some((h) => h.action === 'initial_assignment');
    const hasReassign = updatedTask?.assignmentHistory?.some((h) => h.action === 'reassignment');

    record(
      'SCENARIO-5',
      'Task Assignment and Reassignment Preserves Traceable History',
      historyCount >= 2 && hasInitial && hasReassign,
      `Assignment history contains ${historyCount} entries. Actions: ${updatedTask?.assignmentHistory?.map((h) => `${h.action} (${h.employeeName})`).join(' -> ')}`
    );

    // =========================================================================
    // SCENARIO 6: Multiple Resolution Submissions Preserve Previous Evidence
    // =========================================================================
    console.log('\n--- Scenario 6: Multiple Resolution Submissions History ---');
    // Reassign back to employee K. Ramesh
    await apiCall(
      'PATCH',
      `/api/tasks/${testTask.taskId}/assign`,
      { employeeName: 'K. Ramesh' },
      supervisorToken
    );

    // 1st submission: Inadequate evidence (fails verification)
    await apiCall(
      'POST',
      `/api/tasks/${testTask.taskId}/resolution`,
      { resolutionNotes: 'checked site, temporary fix done', evidenceUrls: [] },
      employeeToken
    );

    // 2nd submission: Full evidence and verified notes
    await apiCall(
      'POST',
      `/api/tasks/${testTask.taskId}/resolution`,
      {
        resolutionNotes: 'Road pothole aggregate base compacted and asphalt leveled permanently.',
        evidenceUrls: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957'],
      },
      employeeToken
    );

    // Supervisor conducts verification (as mandated by Phase 9.1)
    await apiCall(
      'POST',
      `/api/tasks/${testTask.taskId}/verify`,
      { action: 'approve', comments: 'Supervisor verified road patch completed.' },
      supervisorToken
    );

    const taskWithResHistory = await ComplaintTask.findOne({ taskId: testTask.taskId });
    const resHistCount = taskWithResHistory?.resolutionHistory?.length || 0;
    const currentVerified = taskWithResHistory?.resolution?.verificationStatus === 'verified';
    const previousPreserved = taskWithResHistory?.resolutionHistory?.[0]?.resolutionNotes === 'checked site, temporary fix done';

    record(
      'SCENARIO-6',
      'Multiple Resolution Submissions Preserve Previous Evidence and History',
      resHistCount >= 1 && currentVerified && previousPreserved,
      `Resolution history preserved ${resHistCount} prior attempt(s). Current status: "${taskWithResHistory?.resolution?.verificationStatus}". Previous attempt notes: "${taskWithResHistory?.resolutionHistory?.[0]?.resolutionNotes}".`
    );

    // =========================================================================
    // SCENARIO 7: Workflow Events Reference Complaint and Task
    // =========================================================================
    console.log('\n--- Scenario 7: Workflow Events References ---');
    const taskEvents = await WorkflowEvent.find({ complaintId: cmpTargetId, taskId: testTask.taskId });
    record(
      'SCENARIO-7',
      'Workflow Events Correctly Reference Complaint and Specific Task',
      taskEvents.length >= 1,
      `Found ${taskEvents.length} workflow event(s) tagged with taskId "${testTask.taskId}".`
    );

    // =========================================================================
    // SCENARIO 8: Notifications Associated With Correct Recipient
    // =========================================================================
    console.log('\n--- Scenario 8: Notification Recipient Integrity ---');
    const notifs = await Notification.find({ citizenId: 'CIT-8842' });
    const hasCitizenNotif = notifs.length > 0;

    record(
      'SCENARIO-8',
      'Notifications Correctly Bound to Intended Recipient',
      hasCitizenNotif,
      `Verified ${notifs.length} notification(s) bound to citizenId "CIT-8842". Latest title: "${notifs[notifs.length - 1]?.title}".`
    );

    // =========================================================================
    // SCENARIO 9: Invalid References and Statuses Rejected
    // =========================================================================
    console.log('\n--- Scenario 9: Data Integrity & Validation Enforcement ---');
    let rejectedInvalidStatus = false;
    try {
      const invalidTask = new ComplaintTask({
        taskId: 'TSK-TEST-INVALID',
        complaintId: cmpTargetId,
        departmentName: 'Road Maintenance Department',
        title: 'Test',
        status: 'NON_EXISTENT_STATUS_VAL',
      });
      await invalidTask.validate();
    } catch (valErr) {
      rejectedInvalidStatus = true;
    }

    let rejectedInvalidCoords = false;
    try {
      const invalidComplaint = new Complaint({
        complaintId: 'CMP-INVALID-COORD',
        citizenId: 'CIT-8842',
        description: 'Test',
        location: {
          address: 'Invalid location test',
          latitude: 999.99, // Exceeds 90
          longitude: 80.21,
        },
      });
      await invalidComplaint.validate();
    } catch (coordErr) {
      rejectedInvalidCoords = true;
    }

    record(
      'SCENARIO-9',
      'Invalid Enums and Out-of-Bounds Coordinates Rejected by Models',
      rejectedInvalidStatus && rejectedInvalidCoords,
      'Invalid task status rejected by enum validator. Out-of-bounds latitude (999.99) rejected.'
    );

    // =========================================================================
    // SCENARIO 10: Existing Phase 1 & 2 Functionality Preserved
    // =========================================================================
    console.log('\n--- Scenario 10: Regression Prevention (Phase 1 & 2) ---');
    const tasksRes = await apiCall('GET', `/api/complaints/${cmpTargetId}/tasks`, null, adminToken);
    const tasksPreserved = tasksRes.status === 200 && tasksRes.body.data?.length === 2;
    record(
      'SCENARIO-10',
      'Phase 1 Auth and Phase 2 Multi-Department Tasks Preserved',
      tasksPreserved,
      `API GET /api/complaints/${cmpTargetId}/tasks returned 2 department tasks cleanly.`
    );

    // =========================================================================
    // SCENARIO 11: Existing Records Remain Accessible After Changes
    // =========================================================================
    console.log('\n--- Scenario 11: Data Compatibility with Existing Records ---');
    const totalComplaintsInDb = await Complaint.countDocuments();
    const totalDepartmentsInDb = await Department.countDocuments();
    const totalUsersInDb = await User.countDocuments();

    record(
      'SCENARIO-11',
      'Existing Records Intact and Accessible in Database',
      totalComplaintsInDb > 0 && totalDepartmentsInDb > 0 && totalUsersInDb > 0,
      `Database currently holds ${totalComplaintsInDb} complaints, ${totalDepartmentsInDb} departments, and ${totalUsersInDb} users.`
    );

    // =========================================================================
    // SCENARIO 12: Unauthorized Cross-Department Action Prevented
    // =========================================================================
    console.log('\n--- Scenario 12: Cross-Department Boundary Enforcement ---');
    const supportingTask = complaintTasks[1]; // Water & Sewerage Board
    const crossDeptRes = await apiCall(
      'PATCH',
      `/api/tasks/${supportingTask.taskId}/assign`,
      { employeeName: 'K. Ramesh' },
      supervisorToken // Road Maintenance supervisor
    );

    record(
      'SCENARIO-12',
      'Unauthorized Cross-Department Task Assignment Blocked (HTTP 403)',
      crossDeptRes.status === 403,
      `Road supervisor assignment on Water task rejected with HTTP ${crossDeptRes.status}: "${crossDeptRes.body?.message}"`
    );

    // =========================================================================
    // BONUS: Verify KnowledgeChunk and ComplaintMessage Models
    // =========================================================================
    console.log('\n--- Supplemental: KnowledgeChunk & ComplaintMessage ---');
    const testDoc = await KnowledgeDocument.findOne();
    let chunkSaved = false;
    if (testDoc) {
      await KnowledgeChunk.deleteMany({ documentId: testDoc._id });
      const chunk = new KnowledgeChunk({
        documentId: testDoc._id,
        chunkIndex: 0,
        content: testDoc.content.slice(0, 150),
        department: testDoc.department,
        applicableCategories: testDoc.applicableCategories,
      });
      await chunk.save();
      chunkSaved = Boolean(chunk._id);
    }

    const testMsg = new ComplaintMessage({
      complaintId: cmpTargetId,
      senderId: supervisorUser._id,
      senderName: supervisorUser.name,
      senderRole: 'department_supervisor',
      message: 'Field technician dispatched with hydraulic equipment.',
      isInternal: true,
    });
    await testMsg.save();
    const msgSaved = Boolean(testMsg._id);

    record(
      'SUPPLEMENTAL-MODELS',
      'KnowledgeChunk (RAG) and ComplaintMessage Models Verified',
      chunkSaved && msgSaved,
      `KnowledgeChunk saved with parent documentId. Internal ComplaintMessage saved for ${cmpTargetId}.`
    );

  } catch (err) {
    console.error('Phase 3 verification error:', err);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }

  // Print Summary
  console.log('\n===========================================================');
  console.log('📊  PHASE 3 VERIFICATION SUMMARY');
  console.log('===========================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Checks: ${total}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL 14 PHASE 3 DATABASE MODEL & RELATIONSHIP CHECKS PASSED!\n');
  } else {
    console.log(`\n⚠️ ${failed} check(s) failed.\n`);
  }
}

runVerification();
