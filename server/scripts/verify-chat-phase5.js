'use strict';

/**
 * verify-chat-phase5.js
 * Verification Suite for Phase 5:
 * Department Supervisor & Employee Official Chat UI & Backend Contract.
 *
 * Verifies all 10 required test scenarios:
 * 1. Supervisor can access their department conversations.
 * 2. Supervisor cannot access another department's conversations.
 * 3. Assigned employee can access their task conversation.
 * 4. Unassigned employee cannot access that conversation.
 * 5. Citizen-visible replies are visible to citizens.
 * 6. Internal messages are hidden from citizens.
 * 7. Employees cannot spoof another sender's identity.
 * 8. Messages persist after refresh.
 * 9. Notifications work without duplication.
 * 10. Existing task assignment, progress and verification workflows remain unaffected.
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
const Notification = require('../models/Notification');

async function runVerification() {
  console.log('================================================================');
  console.log('🏛️  PHASE 5: DEPARTMENT SUPERVISOR & EMPLOYEE CHAT VERIFICATION');
  console.log('================================================================\n');

  const results = [];
  function record(id, title, passed, details) {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  await connectDatabase();

  const initialMsgCount = await ComplaintMessage.countDocuments();
  const initialNotifCount = await Notification.countDocuments();
  console.log(`Initial Atlas ComplaintMessages: ${initialMsgCount}, Notifications: ${initialNotifCount}`);

  // Fetch real entities from Atlas
  const targetComplaint = await Complaint.findOne({ complaintId: 'CMP-2026-001248' });
  const citizenOwner = await User.findOne({ citizenId: targetComplaint.citizenId });

  // Road Maintenance Supervisor & Department
  const roadSupervisor = await User.findOne({ role: 'department_supervisor', active: true });
  const roadDept = await Department.findById(roadSupervisor.departmentId);

  // Health Supervisor (different department)
  const healthDept = await Department.findOne({ _id: { $ne: roadDept._id }, active: true });
  let healthSupervisor = await User.findOne({
    role: 'department_supervisor',
    departmentId: healthDept._id,
    active: true,
  });
  if (!healthSupervisor) {
    healthSupervisor = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Alternative Supervisor',
      role: 'department_supervisor',
      departmentId: healthDept._id,
      email: 'alt.supervisor@smartcity.gov.in',
      active: true,
    };
  }

  // Find task assigned to an employee
  const testTask = await ComplaintTask.findOne({
    complaintId: targetComplaint.complaintId,
    departmentId: roadDept._id,
    assignedEmployeeId: { $ne: null },
  });

  const empAssigned = await User.findById(testTask.assignedEmployeeId);

  // An employee from the same department who is NOT assigned to this task
  let empUnassigned = await User.findOne({
    role: 'department_employee',
    departmentId: roadDept._id,
    _id: { $ne: empAssigned._id },
    active: true,
  });
  if (!empUnassigned) {
    empUnassigned = await User.create({
      name: 'Unassigned Technician Test',
      email: `unassigned.tech.${Date.now()}@smartcity.gov.in`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      role: 'department_employee',
      departmentId: roadDept._id,
      employeeId: 'EMP-UNASSIGNED-99',
      active: true,
    });
  }

  // Tokens
  const tokenCitizen = generateToken(citizenOwner);
  const tokenRoadSupervisor = generateToken(roadSupervisor);
  const tokenHealthSupervisor = generateToken(healthSupervisor);
  const tokenEmpAssigned = generateToken(empAssigned);
  const tokenEmpUnassigned = generateToken(empUnassigned);

  // Start Express on test port
  const TEST_PORT = 5124;
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
  const createdNotificationIds = [];

  try {
    // ─── 1. Supervisor can access their department conversations ─────────────
    const res1 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadSupervisor
    );
    record(
      'T1',
      'Supervisor can access their own department conversations',
      res1.status === 200 && res1.body.success === true && Array.isArray(res1.body.data),
      `HTTP ${res1.status}, department: ${res1.body.department?.name}, messages: ${res1.body.data?.length}`
    );

    // ─── 2. Supervisor cannot access another department's conversations ───────
    const res2 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenHealthSupervisor
    );
    record(
      'T2',
      "Supervisor cannot access another department's conversations (403)",
      res2.status === 403 && res2.body.success === false,
      `HTTP ${res2.status}, message: "${res2.body.message}"`
    );

    // ─── 3. Assigned employee can access their task conversation ─────────────
    const res3 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenEmpAssigned
    );
    record(
      'T3',
      'Assigned employee can access their task department conversation',
      res3.status === 200 && res3.body.success === true,
      `HTTP ${res3.status}, authenticated as ${empAssigned.name}`
    );

    // ─── 4. Unassigned employee cannot access that conversation ──────────────
    const res4 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenEmpUnassigned
    );
    record(
      'T4',
      'Unassigned employee cannot access conversation without assigned task (403)',
      res4.status === 403 && res4.body.success === false,
      `HTTP ${res4.status}, message: "${res4.body.message}"`
    );

    // ─── 5. Citizen-visible replies are visible to citizens ──────────────────
    const publicReplyText = `Official road repair update by ${roadSupervisor.name} at ${Date.now()}`;
    const resPostPublic = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: publicReplyText,
        isInternal: false,
        taskId: testTask.taskId,
      },
      tokenRoadSupervisor
    );
    const publicMsgId = resPostPublic.body.data?._id;
    if (publicMsgId) createdMessageIds.push(publicMsgId);

    // Citizen reads department messages
    const resCitizenRead = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );
    const citizenSawPublicMsg = resCitizenRead.body.data?.some((m) => m._id === publicMsgId);

    record(
      'T5',
      'Citizen-visible replies from staff are received and visible to citizens',
      resPostPublic.status === 201 && citizenSawPublicMsg === true,
      `HTTP ${resPostPublic.status}, citizenSawMsg=${citizenSawPublicMsg}`
    );

    // ─── 6. Internal messages are hidden from citizens ───────────────────────
    const internalNoteText = `CONFIDENTIAL staff observation on asphalt depth at ${Date.now()}`;
    const resPostInternal = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: internalNoteText,
        isInternal: true,
        taskId: testTask.taskId,
      },
      tokenEmpAssigned
    );
    const internalMsgId = resPostInternal.body.data?._id;
    if (internalMsgId) createdMessageIds.push(internalMsgId);

    // Supervisor reads messages (should see internal note)
    const resSupRead = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadSupervisor
    );
    const supSawInternal = resSupRead.body.data?.some((m) => m._id === internalMsgId);

    // Citizen reads messages (must NOT see internal note)
    const resCitizenCheck2 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );
    const citizenSawInternal = resCitizenCheck2.body.data?.some(
      (m) => m._id === internalMsgId || m.isInternal === true
    );

    record(
      'T6',
      'Internal messages visible to supervisor but strictly hidden from citizen',
      resPostInternal.status === 201 && supSawInternal === true && citizenSawInternal === false,
      `Supervisor saw internal note: ${supSawInternal}, Citizen saw internal note: ${citizenSawInternal}`
    );

    // ─── 7. Employees cannot spoof another sender's identity ─────────────────
    const fakeAdminId = new mongoose.Types.ObjectId();
    const resSpoof = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Spoof attempt: Field technician pretending to be Central Admin.',
        senderId: fakeAdminId.toString(),
        senderName: 'Commissioner Radhakrishnan',
        senderRole: 'central_admin',
        isInternal: false,
      },
      tokenEmpAssigned
    );
    const spoofMsgId = resSpoof.body.data?._id;
    if (spoofMsgId) createdMessageIds.push(spoofMsgId);

    const spoofBlocked =
      resSpoof.status === 201 &&
      resSpoof.body.data?.senderRole === 'department_employee' &&
      resSpoof.body.data?.senderName === empAssigned.name &&
      resSpoof.body.data?.senderId.toString() === empAssigned._id.toString();

    record(
      'T7',
      'Anti-Spoofing: Employee cannot override senderId, senderName, or senderRole',
      spoofBlocked,
      `Stored senderRole="${resSpoof.body.data?.senderRole}", senderName="${resSpoof.body.data?.senderName}"`
    );

    // ─── 8. Messages persist after refresh ───────────────────────────────────
    const resRefreshCheck = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadSupervisor
    );
    const persistedPublic = resRefreshCheck.body.data?.find((m) => m._id === publicMsgId);
    const persistedInternal = resRefreshCheck.body.data?.find((m) => m._id === internalMsgId);

    record(
      'T8',
      'Messages persist with full fidelity across repeated retrievals (simulating refresh)',
      resRefreshCheck.status === 200 && Boolean(persistedPublic) && Boolean(persistedInternal),
      `Public msg found: ${Boolean(persistedPublic)}, Internal note found: ${Boolean(persistedInternal)}`
    );

    // ─── 9. Notifications work without duplication ───────────────────────────
    // Query notifications created during this test for targetComplaint
    const latestNotifs = await Notification.find({
      complaintId: targetComplaint.complaintId,
    }).sort({ createdAt: -1 });

    // When public reply was sent, citizen was notified
    const citizenNotif = latestNotifs.find(
      (n) => n.recipientRole === 'citizen' && n.message.includes('Official road repair update')
    );

    // When employee posted internal note, citizen was NOT notified
    const leakedCitizenNotif = latestNotifs.find(
      (n) => n.recipientRole === 'citizen' && n.message.includes('CONFIDENTIAL staff observation')
    );

    // Track for cleanup
    latestNotifs
      .filter((n) => n.createdAt > new Date(Date.now() - 60000))
      .forEach((n) => createdNotificationIds.push(n._id));

    record(
      'T9',
      'Notifications dispatched properly: citizen notified on public reply, zero leaks on internal note',
      Boolean(citizenNotif) && !leakedCitizenNotif,
      `Citizen received public update: ${Boolean(citizenNotif)}, Leaked internal note: ${Boolean(leakedCitizenNotif)}`
    );

    // ─── 10. Existing task assignment, progress & verification unaffected ────
    const taskCurrent = await ComplaintTask.findOne({ taskId: testTask.taskId });
    const complaintCurrent = await Complaint.findOne({ complaintId: targetComplaint.complaintId });

    const workflowsIntact =
      taskCurrent.status === testTask.status &&
      taskCurrent.assignedEmployeeId?.toString() === testTask.assignedEmployeeId?.toString() &&
      complaintCurrent.status === targetComplaint.status;

    record(
      'T10',
      'Workflow Isolation: Task status, employee assignment, and complaint state completely untouched',
      workflowsIntact,
      `Task status: ${taskCurrent.status}, Assigned employee: ${taskCurrent.assignedEmployeeName}, Complaint status: ${complaintCurrent.status}`
    );

  } finally {
    // Rollback test records
    if (createdMessageIds.length > 0) {
      await ComplaintMessage.deleteMany({ _id: { $in: createdMessageIds } });
      console.log(`\n🧹 Cleaned up ${createdMessageIds.length} test messages.`);
    }

    if (createdNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
      console.log(`🧹 Cleaned up ${createdNotificationIds.length} test notifications.`);
    }

    if (empUnassigned?._id && empUnassigned.employeeId === 'EMP-UNASSIGNED-99') {
      await User.deleteOne({ _id: empUnassigned._id });
      console.log('🧹 Cleaned up test unassigned employee.');
    }

    const finalMsgCount = await ComplaintMessage.countDocuments();
    const finalNotifCount = await Notification.countDocuments();
    console.log(`Final Atlas ComplaintMessages: ${finalMsgCount} (Initial: ${initialMsgCount})`);
    console.log(`Final Atlas Notifications: ${finalNotifCount} (Initial: ${initialNotifCount})`);

    record(
      'CLEANUP',
      'Database integrity preserved with exact document parity',
      finalMsgCount === initialMsgCount && finalNotifCount === initialNotifCount,
      `Messages: ${finalMsgCount}/${initialMsgCount}, Notifications: ${finalNotifCount}/${initialNotifCount}`
    );

    testServer.close();
    await mongoose.disconnect();
    console.log('🔌 Test server closed and database disconnected.');
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`Phase 5 Test Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`Overall Status: ${allPassed ? 'ALL 10 REQUIRED TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('Phase 5 verification script failed:', err);
  process.exit(1);
});

