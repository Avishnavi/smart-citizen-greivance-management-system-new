'use strict';

/**
 * verify-chat-phase3.js
 * Comprehensive Verification Suite for Phase 3:
 * Official Citizen–Department Chat Backend APIs.
 *
 * Tests:
 * - Part A: Unit & Controller Authorization Logic Tests
 * - Part B: End-to-End Authenticated Express Route API Tests (14 Strict Scenarios)
 */

const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDatabase } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { app } = require('../index');

const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const ComplaintMessage = require('../models/ComplaintMessage');
const Department = require('../models/Department');
const User = require('../models/User');

const {
  authorizeChatAccess,
  verifyDepartmentAssociation,
} = require('../controllers/chatController');

async function runVerification() {
  console.log('================================================================');
  console.log('🏛️  PHASE 3: OFFICIAL CITIZEN-DEPARTMENT CHAT API VERIFICATION');
  console.log('================================================================\n');

  const results = [];
  function record(section, id, title, passed, details) {
    results.push({ section, id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${section} - ${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  // ─── PART A: CONTROLLER LOGIC & AUTHORIZATION UNIT TESTS ────────────────────
  console.log('--- Part A: Unit Tests on Controller Functions & Authorization Matrix ---');

  const deptRoadId = new mongoose.Types.ObjectId();
  const deptHealthId = new mongoose.Types.ObjectId();
  const citizenUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Citizen A',
    role: 'citizen',
    citizenId: 'CIT-TEST-001',
  };
  const foreignCitizen = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Citizen B',
    role: 'citizen',
    citizenId: 'CIT-TEST-002',
  };
  const roadSupervisor = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Sup Road',
    role: 'department_supervisor',
    departmentId: deptRoadId,
  };
  const healthSupervisor = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Sup Health',
    role: 'department_supervisor',
    departmentId: deptHealthId,
  };
  const centralAdmin = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin IAS',
    role: 'central_admin',
  };

  const mockDeptRoad = { _id: deptRoadId, name: 'Roads', code: 'RMD' };
  const mockDeptHealth = { _id: deptHealthId, name: 'Health', code: 'PHS' };

  const mockComplaint = {
    complaintId: 'CMP-UNIT-001',
    citizenId: 'CIT-TEST-001',
    citizenRef: citizenUser._id,
    departments: {
      primary: { departmentId: deptRoadId, departmentName: 'Roads' },
      supporting: [],
    },
    routing: { departmentId: deptRoadId },
  };

  // Unit 1: Citizen owning complaint
  const authCit = await authorizeChatAccess(citizenUser, mockComplaint, mockDeptRoad);
  record('UNIT', 'U1', 'Citizen owner authorized with internal sending disallowed',
    authCit.authorized && !authCit.canSendInternal,
    `authorized=${authCit.authorized}, canSendInternal=${authCit.canSendInternal}`
  );

  // Unit 2: Foreign citizen rejected
  const authForeign = await authorizeChatAccess(foreignCitizen, mockComplaint, mockDeptRoad);
  record('UNIT', 'U2', 'Foreign citizen rejected with 403 Forbidden',
    !authForeign.authorized && authForeign.status === 403,
    `status=${authForeign.status}, message="${authForeign.message}"`
  );

  // Unit 3: Supervisor matching department
  const authSupMatch = await authorizeChatAccess(roadSupervisor, mockComplaint, mockDeptRoad);
  record('UNIT', 'U3', 'Supervisor matching department authorized with internal notes enabled',
    authSupMatch.authorized && authSupMatch.canSendInternal,
    `authorized=${authSupMatch.authorized}, canSendInternal=${authSupMatch.canSendInternal}`
  );

  // Unit 4: Supervisor wrong department
  const authSupWrong = await authorizeChatAccess(healthSupervisor, mockComplaint, mockDeptRoad);
  record('UNIT', 'U4', 'Supervisor of wrong department rejected with 403 Forbidden',
    !authSupWrong.authorized && authSupWrong.status === 403,
    `status=${authSupWrong.status}, message="${authSupWrong.message}"`
  );

  // Unit 5: Central Admin city-wide access
  const authAdmin = await authorizeChatAccess(centralAdmin, mockComplaint, mockDeptRoad);
  record('UNIT', 'U5', 'Central Admin authorized for any department conversation',
    authAdmin.authorized && authAdmin.canSendInternal,
    `authorized=${authAdmin.authorized}, canSendInternal=${authAdmin.canSendInternal}`
  );

  // ─── PART B: END-TO-END AUTHENTICATED EXPRESS ROUTE TESTS ───────────────────
  console.log('\n--- Part B: End-to-End Authenticated Express API Routes ---');

  await connectDatabase();

  // Verify initial legacy message count
  const initialMessageCount = await ComplaintMessage.countDocuments();
  console.log(`Live Atlas initial ComplaintMessage documents: ${initialMessageCount}`);

  // Fetch real users and entities from Atlas
  const adminUser = await User.findOne({ role: 'central_admin', active: true });
  const roadSup = await User.findOne({ role: 'department_supervisor', active: true });
  const roadDept = await Department.findById(roadSup.departmentId);

  // Health Supervisor (different department)
  const healthDept = await Department.findOne({ _id: { $ne: roadDept._id }, active: true });
  let healthSup = await User.findOne({
    role: 'department_supervisor',
    departmentId: healthDept._id,
    active: true,
  });
  if (!healthSup) {
    healthSup = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Alt Supervisor',
      email: 'alt.sup@smartcity.gov.in',
      role: 'department_supervisor',
      departmentId: healthDept._id,
      active: true,
    };
  }

  // Find assigned employee on a task
  const testTask = await ComplaintTask.findOne({
    departmentId: roadDept._id,
    assignedEmployeeId: { $ne: null },
  });

  const empAssigned = await User.findById(testTask.assignedEmployeeId);

  // Another employee who is NOT assigned to this task
  let empUnassigned = await User.findOne({
    role: 'department_employee',
    departmentId: roadDept._id,
    _id: { $ne: empAssigned._id },
    active: true,
  });
  if (!empUnassigned) {
    empUnassigned = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Unassigned Officer',
      email: 'unassigned.emp@smartcity.gov.in',
      role: 'department_employee',
      departmentId: roadDept._id,
      active: true,
    };
  }

  // Find complaint corresponding to testTask
  const targetComplaint = await Complaint.findOne({ complaintId: testTask.complaintId });
  const initialComplaintStatus = targetComplaint.status;
  const initialTaskStatus = testTask.status;

  // Real citizen owner of targetComplaint
  let citizenOwner = await User.findOne({ citizenId: targetComplaint.citizenId });
  if (!citizenOwner && targetComplaint.citizenRef) {
    citizenOwner = await User.findById(targetComplaint.citizenRef);
  }
  if (!citizenOwner) {
    citizenOwner = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Rajesh Kumar Test',
      email: 'rajesh.test@example.com',
      role: 'citizen',
      citizenId: targetComplaint.citizenId,
      active: true,
    };
  }

  // Create an ephemeral foreign citizen user in DB for isolated permission testing
  const foreignCitizenDb = await User.create({
    name: 'Foreign Citizen Test',
    email: `foreign.citizen.${Date.now()}@example.com`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'citizen',
    citizenId: 'CIT-FOREIGN-9999',
    active: true,
  });

  // Generate real JWT tokens
  const tokenCitizen = generateToken(citizenOwner);
  const tokenOtherCitizen = generateToken(foreignCitizenDb);
  const tokenRoadSup = generateToken(roadSup);
  const tokenHealthSup = generateToken(healthSup);
  const tokenEmpAssigned = generateToken(empAssigned);
  const tokenEmpUnassigned = generateToken(empUnassigned);
  const tokenAdmin = generateToken(adminUser);

  // Start Express on ephemeral port
  const TEST_PORT = 5122;
  const testServer = app.listen(TEST_PORT);
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  function apiCall(method, apiPath, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(apiPath, baseUrl);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = { method, headers };
      const req = http.request(url, options, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  const createdMessageIds = [];

  try {
    // ─── Test 1: Citizen can read their own department conversation ──────────
    const res1 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );
    record('ROUTE', 'T1', 'Citizen can read their own department conversation',
      res1.status === 200 && res1.body.success === true && Array.isArray(res1.body.data),
      `HTTP ${res1.status}, data length=${res1.body.data?.length}`
    );

    // ─── Test 2: Citizen can send a message to an assigned department ────────
    const res2 = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Hello, could you provide an update on the pothole repair at 4th Main?',
        attachments: ['https://example.com/photo1.jpg'],
      },
      tokenCitizen
    );
    const msgId2 = res2.body.data?._id;
    if (msgId2) createdMessageIds.push(msgId2);

    record('ROUTE', 'T2', 'Citizen can send a message to an assigned department',
      res2.status === 201 &&
      res2.body.success === true &&
      res2.body.data?.senderRole === 'citizen' &&
      res2.body.data?.isInternal === false,
      `HTTP ${res2.status}, senderRole=${res2.body.data?.senderRole}, isInternal=${res2.body.data?.isInternal}`
    );

    // ─── Test 3: Citizen cannot read another citizen's conversation ──────────
    const res3 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenOtherCitizen
    );
    record('ROUTE', 'T3', "Citizen cannot read another citizen's conversation (403)",
      res3.status === 403 && res3.body.success === false,
      `HTTP ${res3.status}, message="${res3.body.message}"`
    );

    // ─── Test 4: Citizen cannot read internal messages ────────────────────────
    // First, supervisor posts an internal note
    const resInternalPost = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'CONFIDENTIAL: Internal staff note regarding asphalt contractor.',
        isInternal: true,
      },
      tokenRoadSup
    );
    const internalMsgId = resInternalPost.body.data?._id;
    if (internalMsgId) createdMessageIds.push(internalMsgId);

    // Citizen reads department messages
    const res4 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );
    const citizenSawInternal = res4.body.data?.some((m) => m._id === internalMsgId || m.isInternal === true);
    record('ROUTE', 'T4', 'Citizen cannot read internal messages (strictly filtered out)',
      res4.status === 200 && citizenSawInternal === false,
      `Internal note present in citizen response: ${citizenSawInternal}`
    );

    // ─── Test 5: Citizen cannot send internal messages ────────────────────────
    const res5 = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Citizen attempting to force isInternal flag.',
        isInternal: true, // Should be safely forced to false by backend
      },
      tokenCitizen
    );
    const msgId5 = res5.body.data?._id;
    if (msgId5) createdMessageIds.push(msgId5);

    record('ROUTE', 'T5', 'Citizen cannot send internal messages (forced isInternal: false)',
      res5.status === 201 && res5.body.data?.isInternal === false,
      `HTTP ${res5.status}, requested isInternal=true -> stored isInternal=${res5.body.data?.isInternal}`
    );

    // ─── Test 6: Department A cannot read Department B's messages ────────────
    const res6 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenHealthSup
    );
    record('ROUTE', 'T6', "Department A cannot read Department B's messages (403)",
      res6.status === 403 && res6.body.success === false,
      `HTTP ${res6.status}, message="${res6.body.message}"`
    );

    // ─── Test 7: Department A cannot send messages as Department B ───────────
    const res7 = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Health Department trying to post into Road Department thread.',
      },
      tokenHealthSup
    );
    record('ROUTE', 'T7', 'Department A cannot send messages into Department B thread (403)',
      res7.status === 403 && res7.body.success === false,
      `HTTP ${res7.status}, message="${res7.body.message}"`
    );

    // ─── Test 8: An employee cannot access an unassigned employee's task conversation
    const res8 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenEmpUnassigned
    );
    record('ROUTE', 'T8', "Unassigned employee cannot access conversation without assigned task (403)",
      res8.status === 403 && res8.body.success === false,
      `HTTP ${res8.status}, message="${res8.body.message}"`
    );

    // Assigned employee CAN access conversation
    const res8Assigned = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenEmpAssigned
    );
    record('ROUTE', 'T8b', 'Assigned employee can access their task department conversation (200)',
      res8Assigned.status === 200 && res8Assigned.body.success === true,
      `HTTP ${res8Assigned.status}`
    );

    // ─── Test 9: A supervisor can access their own department conversation ───
    const res9 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadSup
    );
    // Supervisor sees both public and internal
    const supervisorSeesInternal = res9.body.data?.some((m) => m._id === internalMsgId);
    record('ROUTE', 'T9', 'Supervisor can access their own department conversation (includes internal notes)',
      res9.status === 200 && supervisorSeesInternal === true,
      `HTTP ${res9.status}, sawInternalNote=${supervisorSeesInternal}`
    );

    // ─── Test 10: Central Admin can access authorized conversations ──────────
    const res10 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenAdmin
    );
    record('ROUTE', 'T10', 'Central Admin can access department conversations with city-wide oversight (200)',
      res10.status === 200 && res10.body.success === true,
      `HTTP ${res10.status}, messages count=${res10.body.data?.length}`
    );

    // ─── Test 11: Invalid complaint-department relationships are rejected ────
    // Find all department IDs that ARE associated with targetComplaint
    const existingTasks = await ComplaintTask.find({ complaintId: targetComplaint.complaintId });
    const taskDeptIdStrs = existingTasks.map((t) => t.departmentId?.toString()).filter(Boolean);
    const routingDeptStr = targetComplaint.routing?.departmentId?.toString();
    const primaryDeptStr = targetComplaint.departments?.primary?.departmentId?.toString();
    const supportingDeptStrs = (targetComplaint.departments?.supporting || []).map((d) => d.departmentId?.toString()).filter(Boolean);

    const allAssocDeptIdStrs = new Set([
      ...taskDeptIdStrs,
      routingDeptStr,
      primaryDeptStr,
      ...supportingDeptStrs,
    ].filter(Boolean));

    const unassociatedDept = await Department.findOne({
      _id: { $nin: Array.from(allAssocDeptIdStrs).map((id) => new mongoose.Types.ObjectId(id)) },
      active: true,
    });

    const res11 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${unassociatedDept._id}/messages`,
      null,
      tokenAdmin
    );
    record('ROUTE', 'T11', 'Unassociated department on complaint is rejected with 400',
      res11.status === 400 && res11.body.success === false,
      `HTTP ${res11.status}, unassociatedDept=${unassociatedDept.name}, message="${res11.body.message}"`
    );

    // ─── Test 12: Sender identity spoofing is rejected or ignored safely ──────
    const fakeAdminId = new mongoose.Types.ObjectId();
    const res12 = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Spoof attempt: I am pretending to be Commissioner Radhakrishnan.',
        senderId: fakeAdminId.toString(),
        senderName: 'Dr. K. Radhakrishnan, IAS',
        senderRole: 'central_admin',
      },
      tokenCitizen
    );
    const msgId12 = res12.body.data?._id;
    if (msgId12) createdMessageIds.push(msgId12);

    const spoofIgnored =
      res12.status === 201 &&
      res12.body.data?.senderRole === 'citizen' &&
      res12.body.data?.senderName === citizenOwner.name &&
      res12.body.data?.senderId.toString() === citizenOwner._id.toString();

    record('ROUTE', 'T12', 'Sender identity spoofing ignored: senderId, senderName, senderRole enforced from req.user',
      spoofIgnored,
      `Stored senderRole="${res12.body.data?.senderRole}", senderName="${res12.body.data?.senderName}"`
    );

    // ─── Test 13: Messages persist and return in chronological order ─────────
    const res13 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadSup
    );

    let isChronological = true;
    const msgs = res13.body.data || [];
    for (let i = 1; i < msgs.length; i++) {
      if (new Date(msgs[i].createdAt) < new Date(msgs[i - 1].createdAt)) {
        isChronological = false;
        break;
      }
    }

    record('ROUTE', 'T13', 'Messages persist and return in strict chronological order',
      res13.status === 200 && msgs.length >= 3 && isChronological,
      `Messages retrieved: ${msgs.length}, strictly ordered: ${isChronological}`
    );

    // ─── Test 14: Sending a message does not change complaint or task status ──
    const complaintAfter = await Complaint.findOne({ complaintId: targetComplaint.complaintId });
    const taskAfter = await ComplaintTask.findOne({ taskId: testTask.taskId });

    const statusUntouched =
      complaintAfter.status === initialComplaintStatus &&
      taskAfter.status === initialTaskStatus;

    record('ROUTE', 'T14', 'Workflow Isolation: Sending messages leaves complaint and task status untouched',
      statusUntouched,
      `Complaint status: ${complaintAfter.status} (was ${initialComplaintStatus}), Task status: ${taskAfter.status} (was ${initialTaskStatus})`
    );

    // ─── Supplemental: Test Department Listing & Unauthenticated Access ──────
    const resDeptList = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments`,
      null,
      tokenCitizen
    );
    record('ROUTE', 'SUP1', 'GET /api/complaints/:id/departments lists associated departments with message count',
      resDeptList.status === 200 && Array.isArray(resDeptList.body.data) && resDeptList.body.data.length > 0,
      `Found ${resDeptList.body.data?.length} departments, e.g. ${resDeptList.body.data?.[0]?.departmentName}`
    );

    const resUnauth = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      null // No token
    );
    record('ROUTE', 'SUP2', 'Unauthenticated request receives 401 Unauthorized',
      resUnauth.status === 401,
      `HTTP ${resUnauth.status}, message="${resUnauth.body.message}"`
    );

  } finally {
    // Clean up created test messages and test user so live database remains untouched
    if (createdMessageIds.length > 0) {
      await ComplaintMessage.deleteMany({ _id: { $in: createdMessageIds } });
      console.log(`\n🧹 Cleaned up ${createdMessageIds.length} ephemeral test messages.`);
    }

    if (foreignCitizenDb?._id) {
      await User.deleteOne({ _id: foreignCitizenDb._id });
      console.log('🧹 Cleaned up ephemeral foreign citizen user.');
    }

    // Verify live Atlas messages count is still exactly preserved
    const finalMessageCount = await ComplaintMessage.countDocuments();
    console.log(`Live Atlas final ComplaintMessage documents: ${finalMessageCount} (Initial: ${initialMessageCount})`);
    record('CLEANUP', 'C1', 'Database integrity preserved: live message count identical to initial count',
      finalMessageCount === initialMessageCount,
      `Final count: ${finalMessageCount}, Initial count: ${initialMessageCount}`
    );

    testServer.close();
    await mongoose.disconnect();
    console.log('🔌 Test server closed and database disconnected.');
  }

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`Phase 3 Test Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`Overall Status: ${allPassed ? 'ALL 14 REQUIRED TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
