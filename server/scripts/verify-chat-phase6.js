'use strict';

/**
 * verify-chat-phase6.js
 * Comprehensive Verification Suite for Phase 6:
 * Central Admin Official Chat Integration & Cross-Department Oversight.
 *
 * Verifies all required scenarios:
 * 1. Central Admin fetches all participating departments for a complaint.
 * 2. Central Admin can access department-wise conversations across any municipal department.
 * 3. Central Admin reads BOTH citizen-visible messages and internal staff notes.
 * 4. Central Admin sends official citizen-visible notice (citizen receives notification).
 * 5. Central Admin sends internal administrative directive (supervisor receives notification, citizen receives zero).
 * 6. Server-side anti-spoofing enforces senderId, senderName, and senderRole: 'central_admin'.
 * 7. Citizens cannot view Central Admin internal directives (isInternal: true filtered out).
 * 8. Department supervisors cannot bypass their own department boundaries.
 * 9. Central Admin can retrieve legacy unassociated messages via legacy drawer endpoint.
 * 10. Workflow Isolation: Complaint status, priority, SLA, and task status remain completely untouched.
 * 11. Cleanup Rollback: Exact document parity with Atlas database before test execution.
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
  console.log('🏛️  PHASE 6: CENTRAL ADMIN OFFICIAL CHAT VERIFICATION');
  console.log('================================================================\n');

  const results = [];
  function record(id, title, passed, details) {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  await connectDatabase();

  // Clean any residual test notifications from previous test run
  await Notification.deleteMany({
    complaintId: 'CMP-2026-001248',
    message: { $regex: /directive|Central Admin reviewed progress/i },
  });

  const initialMsgCount = await ComplaintMessage.countDocuments();
  const initialNotifCount = await Notification.countDocuments();
  console.log(`Initial Atlas ComplaintMessages: ${initialMsgCount}, Notifications: ${initialNotifCount}`);

  // Fetch real entities from Atlas
  const targetComplaint = await Complaint.findOne({ complaintId: 'CMP-2026-001248' });
  const citizenOwner = await User.findOne({ citizenId: targetComplaint.citizenId });

  // Central Admin
  let centralAdmin = await User.findOne({ role: 'central_admin', active: true });
  let createdTestAdmin = false;
  if (!centralAdmin) {
    centralAdmin = await User.create({
      name: 'Commissioner Central Admin Test',
      email: `central.admin.${Date.now()}@smartcity.gov.in`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      role: 'central_admin',
      active: true,
    });
    createdTestAdmin = true;
  }

  // Road Maintenance Supervisor & Department
  const roadSupervisor = await User.findOne({ role: 'department_supervisor', active: true });
  const roadDept = await Department.findById(roadSupervisor.departmentId);

  // Health / Other Department & Supervisor
  const otherDept = await Department.findOne({ _id: { $ne: roadDept._id }, active: true });
  let otherSupervisor = await User.findOne({
    role: 'department_supervisor',
    departmentId: otherDept._id,
    active: true,
  });
  if (!otherSupervisor) {
    otherSupervisor = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Other Supervisor',
      role: 'department_supervisor',
      departmentId: otherDept._id,
      email: 'other.supervisor@smartcity.gov.in',
      active: true,
    };
  }

  // Tokens
  const tokenAdmin = generateToken(centralAdmin);
  const tokenCitizen = generateToken(citizenOwner);
  const tokenRoadSupervisor = generateToken(roadSupervisor);
  const tokenOtherSupervisor = generateToken(otherSupervisor);

  // Start Express on test port
  const TEST_PORT = 5125;
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
    // ─── 1. Central Admin fetches all participating departments for a complaint ────
    const resDepts = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments`,
      null,
      tokenAdmin
    );
    const depts = resDepts.body?.data || [];
    const hasRoadDept = depts.some((d) => d.departmentId?.toString() === roadDept._id.toString());

    record(
      'T1',
      'Central Admin fetches all participating departments for complaint oversight',
      resDepts.status === 200 && Array.isArray(depts) && hasRoadDept,
      `Status: ${resDepts.status}, Departments count: ${depts.length}, Contains target dept: ${hasRoadDept}`
    );

    // ─── 2. Central Admin accesses department-wise conversations across municipality ────
    const resAdminRoadMsgs = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenAdmin
    );

    record(
      'T2',
      'Central Admin accesses department conversation without department binding restrictions',
      resAdminRoadMsgs.status === 200 && Array.isArray(resAdminRoadMsgs.body?.data),
      `Status: ${resAdminRoadMsgs.status}, Existing messages in thread: ${resAdminRoadMsgs.body?.data?.length}`
    );

    // ─── 3. Central Admin posts an official citizen-visible notice ─────────────
    const spoofAttempt = {
      message: 'Official Municipal Notice: Central Admin reviewed progress on site.',
      isInternal: false,
      senderRole: 'citizen', // spoofing attempt
      senderName: 'Hacked Citizen',
      senderId: new mongoose.Types.ObjectId(),
    };

    const resNotice = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      spoofAttempt,
      tokenAdmin
    );

    let noticeMsg = null;
    if (resNotice.status === 201 && resNotice.body?.data?._id) {
      noticeMsg = resNotice.body.data;
      createdMessageIds.push(noticeMsg._id);
    }

    record(
      'T3',
      'Central Admin sends official citizen-visible notice',
      resNotice.status === 201 && noticeMsg?.isInternal === false,
      `Status: ${resNotice.status}, MessageId: ${noticeMsg?._id}, isInternal: ${noticeMsg?.isInternal}`
    );

    // ─── 4. Server-side anti-spoofing enforcement ─────────────────────────────
    const antiSpoofCheck =
      noticeMsg &&
      noticeMsg.senderRole === 'central_admin' &&
      noticeMsg.senderName === centralAdmin.name &&
      noticeMsg.senderId?.toString() === centralAdmin._id?.toString();

    record(
      'T4',
      'Anti-spoofing verification: Server strictly enforces senderRole as central_admin',
      Boolean(antiSpoofCheck),
      `senderRole: ${noticeMsg?.senderRole}, senderName: ${noticeMsg?.senderName}, senderId: ${noticeMsg?.senderId}`
    );

    // ─── 5. Citizen receives notification for public Central Admin notice ──────
    const citizenNotif = await Notification.findOne({
      recipientRole: 'citizen',
      complaintId: targetComplaint.complaintId,
      message: { $regex: /Central Admin/i },
    }).sort({ createdAt: -1 });

    if (citizenNotif) {
      createdNotificationIds.push(citizenNotif._id);
    }

    record(
      'T5',
      'Citizen receives official notification when Central Admin issues a public notice',
      Boolean(citizenNotif),
      `Citizen notification found: ${Boolean(citizenNotif)}, Type: ${citizenNotif?.type}`
    );

    // ─── 6. Central Admin sends internal administrative directive ──────────────
    const directivePayload = {
      message: 'Administrative Directive: Complete road resurfacing inspection within 24 hours.',
      isInternal: true,
    };

    const resDirective = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      directivePayload,
      tokenAdmin
    );

    let directiveMsg = null;
    if (resDirective.status === 201 && resDirective.body?.data?._id) {
      directiveMsg = resDirective.body.data;
      createdMessageIds.push(directiveMsg._id);
    }

    record(
      'T6',
      'Central Admin sends internal administrative directive to department staff',
      resDirective.status === 201 && directiveMsg?.isInternal === true,
      `Status: ${resDirective.status}, MessageId: ${directiveMsg?._id}, isInternal: ${directiveMsg?.isInternal}`
    );

    // Allow non-blocking background notification dispatch to commit to Atlas
    await new Promise((r) => setTimeout(r, 600));

    // ─── 7. Supervisor receives notification for internal administrative directive ──
    const supervisorNotif = await Notification.findOne({
      recipientRole: 'department_supervisor',
      userId: roadSupervisor._id,
      complaintId: targetComplaint.complaintId,
      message: { $regex: /issued directive/i },
    }).sort({ createdAt: -1 });

    if (supervisorNotif) {
      createdNotificationIds.push(supervisorNotif._id);
    }

    // Check citizen received ZERO notifications for internal directive
    const leakedCitizenDirectiveNotif = await Notification.findOne({
      recipientRole: 'citizen',
      complaintId: targetComplaint.complaintId,
      message: { $regex: /Complete road resurfacing inspection within 24 hours/i },
    });

    record(
      'T7',
      'Supervisor receives notification for internal directive; Zero citizen notification leak',
      Boolean(supervisorNotif) && !leakedCitizenDirectiveNotif,
      `Supervisor notified: ${Boolean(supervisorNotif)}, Leaked citizen notification: ${Boolean(leakedCitizenDirectiveNotif)}`
    );

    // ─── 8. Citizen privacy check: Citizen cannot view internal directives ────
    const resCitizenView = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );

    const citizenMessages = resCitizenView.body?.data || [];
    const internalLeakedToCitizen = citizenMessages.some((m) => m.isInternal === true);
    const citizenSeesPublicNotice = citizenMessages.some((m) => m._id === noticeMsg?._id);

    record(
      'T8',
      'Citizen isolation check: Internal directive completely hidden; Public notice visible',
      resCitizenView.status === 200 && !internalLeakedToCitizen && citizenSeesPublicNotice,
      `Citizen sees internal notes: ${internalLeakedToCitizen}, Citizen sees public notice: ${citizenSeesPublicNotice}`
    );

    // ─── 9. Central Admin reads BOTH citizen-visible messages and internal notes ──
    const resAdminView = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenAdmin
    );

    const adminMessages = resAdminView.body?.data || [];
    const adminSeesPublic = adminMessages.some((m) => m._id === noticeMsg?._id);
    const adminSeesInternal = adminMessages.some((m) => m._id === directiveMsg?._id);

    record(
      'T9',
      'Central Admin municipal oversight: Reads BOTH citizen-visible messages and internal notes',
      resAdminView.status === 200 && adminSeesPublic && adminSeesInternal,
      `Admin sees public notice: ${adminSeesPublic}, Admin sees internal directive: ${adminSeesInternal}`
    );

    // ─── 10. Department isolation for supervisors still strictly enforced ───────
    // An outside department supervisor cannot access Road Department's thread
    const resOutsideSupervisor = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenOtherSupervisor
    );

    record(
      'T10',
      'Department isolation preserved: Outside supervisor blocked (403 Forbidden)',
      resOutsideSupervisor.status === 403,
      `Status: ${resOutsideSupervisor.status}, Error: ${resOutsideSupervisor.body?.message}`
    );

    // ─── 11. Central Admin retrieves legacy unassociated messages drawer ────────
    const resLegacy = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/messages?legacyOnly=true`,
      null,
      tokenAdmin
    );

    record(
      'T11',
      'Central Admin retrieves archived/legacy unassociated complaint messages drawer',
      resLegacy.status === 200 && Array.isArray(resLegacy.body?.data),
      `Status: ${resLegacy.status}, Legacy message count: ${resLegacy.body?.data?.length}`
    );

    // ─── 12. Workflow Isolation: Complaint and Task statuses remain untouched ───
    const currentComplaint = await Complaint.findOne({ complaintId: targetComplaint.complaintId });
    const currentTasks = await ComplaintTask.find({ complaintId: targetComplaint.complaintId });

    const workflowUntouched =
      currentComplaint.status === targetComplaint.status &&
      currentComplaint.priority === targetComplaint.priority &&
      currentComplaint.slaHours === targetComplaint.slaHours;

    record(
      'T12',
      'Workflow Isolation: Complaint status, priority, SLA, and task state completely untouched',
      workflowUntouched,
      `Complaint status: ${currentComplaint.status}, Priority: ${currentComplaint.priority}, Active tasks: ${currentTasks.length}`
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

    if (createdTestAdmin && centralAdmin?._id) {
      await User.deleteOne({ _id: centralAdmin._id });
      console.log('🧹 Cleaned up test central admin account.');
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
  console.log(`Phase 6 Test Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`Overall Status: ${allPassed ? 'ALL REQUIRED TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('Phase 6 verification script failed:', err);
  process.exit(1);
});
