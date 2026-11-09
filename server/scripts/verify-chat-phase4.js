'use strict';

/**
 * verify-chat-phase4.js
 * Verification Suite for Phase 4: Citizen Official Department Chat UI & Backend Contract.
 *
 * Verifies all 10 required test scenarios:
 * 1. Citizen can open their own complaint chat.
 * 2. Correct departments appear for a multi-department complaint.
 * 3. Switching departments loads the correct conversation.
 * 4. Citizen can send a message and see it appear.
 * 5. Message remains visible after page refresh.
 * 6. Internal messages never appear.
 * 7. Unauthorized complaint access is handled correctly.
 * 8. Empty conversations display correctly.
 * 9. API errors do not break complaint tracking.
 * 10. Existing complaint tracking functions still work.
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

async function runVerification() {
  console.log('================================================================');
  console.log('🏛️  PHASE 4: CITIZEN DEPARTMENT CHAT INTEGRATION VERIFICATION');
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
  console.log(`Initial Atlas ComplaintMessage count: ${initialMsgCount}`);

  // Fetch real entities
  const targetComplaint = await Complaint.findOne({ complaintId: 'CMP-2026-001248' });
  const citizenOwner = await User.findOne({ citizenId: targetComplaint.citizenId });
  const roadSupervisor = await User.findOne({ role: 'department_supervisor', active: true });

  // Create ephemeral foreign citizen
  const foreignCitizen = await User.create({
    name: 'Unauthorized Citizen Test',
    email: `foreign.citizen.${Date.now()}@example.com`,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    role: 'citizen',
    citizenId: 'CIT-FOREIGN-9999',
    active: true,
  });

  // Tokens
  const tokenCitizen = generateToken(citizenOwner);
  const tokenForeign = generateToken(foreignCitizen);
  const tokenSupervisor = generateToken(roadSupervisor);

  // Start Express on test port
  const TEST_PORT = 5123;
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
    // ─── 1. Citizen can open their own complaint chat ─────────────────────────
    const res1 = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments`,
      null,
      tokenCitizen
    );
    record(
      'T1',
      'Citizen can open their own complaint chat & list departments',
      res1.status === 200 && res1.body.success === true && Array.isArray(res1.body.data),
      `HTTP ${res1.status}, found ${res1.body.data?.length} departments for ${targetComplaint.complaintId}`
    );

    const depts = res1.body.data || [];
    const roadDept = depts.find((d) => d.departmentName.includes('Road') || d.code === 'RMD') || depts[0];
    const secondDept = depts.find((d) => d.departmentId !== roadDept?.departmentId);

    // ─── 2. Correct departments appear for a multi-department complaint ──────
    const hasMultipleDepts = depts.length >= 2;
    const hasPrimaryFlag = depts.some((d) => d.isPrimary === true);
    record(
      'T2',
      'Correct departments appear for a multi-department complaint',
      hasMultipleDepts && hasPrimaryFlag,
      `Associated departments: ${depts.map((d) => `${d.departmentName} (${d.isPrimary ? 'Primary' : 'Supporting'})`).join(', ')}`
    );

    // ─── 3. Switching departments loads the correct conversation ─────────────
    const resRoadMsgs = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      null,
      tokenCitizen
    );
    const resSecondMsgs = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${secondDept.departmentId}/messages`,
      null,
      tokenCitizen
    );

    record(
      'T3',
      'Switching departments loads the correct isolated conversation',
      resRoadMsgs.status === 200 &&
      resSecondMsgs.status === 200 &&
      resRoadMsgs.body.department.id === roadDept.departmentId &&
      resSecondMsgs.body.department.id === secondDept.departmentId,
      `Dept 1 (${roadDept.departmentName}): ${resRoadMsgs.body.data?.length} msgs, Dept 2 (${secondDept.departmentName}): ${resSecondMsgs.body.data?.length} msgs`
    );

    // ─── 4. Citizen can send a message and see it appear ─────────────────────
    const uniqueText = `Phase 4 Citizen test inquiry at ${Date.now()}`;
    const resPost = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      {
        message: uniqueText,
        attachments: ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7'],
      },
      tokenCitizen
    );
    const newMsgId = resPost.body.data?._id;
    if (newMsgId) createdMessageIds.push(newMsgId);

    record(
      'T4',
      'Citizen can send a message and see it created (201)',
      resPost.status === 201 &&
      resPost.body.success === true &&
      resPost.body.data?.message === uniqueText &&
      resPost.body.data?.senderRole === 'citizen' &&
      resPost.body.data?.attachments?.length === 1,
      `HTTP ${resPost.status}, id=${newMsgId}, senderRole=${resPost.body.data?.senderRole}`
    );

    // ─── 5. Message remains visible after page refresh (subsequent GET) ──────
    const resRefresh = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      null,
      tokenCitizen
    );
    const foundSentMsg = resRefresh.body.data?.find((m) => m._id === newMsgId);
    record(
      'T5',
      'Message remains persistent and visible after page refresh',
      resRefresh.status === 200 && Boolean(foundSentMsg),
      `Persisted message found: "${foundSentMsg?.message?.substring(0, 45)}..."`
    );

    // ─── 6. Internal messages never appear to citizen ────────────────────────
    // Post internal staff note as supervisor
    const resStaffNote = await apiCall(
      'POST',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      {
        message: 'SUPERVISOR CONFIDENTIAL: Internal engineering note on road sub-base.',
        isInternal: true,
      },
      tokenSupervisor
    );
    const staffNoteId = resStaffNote.body.data?._id;
    if (staffNoteId) createdMessageIds.push(staffNoteId);

    // Citizen queries messages
    const resCitizenCheck = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      null,
      tokenCitizen
    );
    const citizenSawNote = resCitizenCheck.body.data?.some(
      (m) => m._id === staffNoteId || m.isInternal === true
    );
    record(
      'T6',
      'Internal staff messages never appear in citizen chat view',
      resCitizenCheck.status === 200 && citizenSawNote === false,
      `Internal staff note present in citizen response: ${citizenSawNote}`
    );

    // ─── 7. Unauthorized complaint access is handled correctly (403) ─────────
    const resUnauth = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/${roadDept.departmentId}/messages`,
      null,
      tokenForeign
    );
    record(
      'T7',
      'Unauthorized complaint access is securely rejected (403 Forbidden)',
      resUnauth.status === 403 && resUnauth.body.success === false,
      `HTTP ${resUnauth.status}, message="${resUnauth.body.message}"`
    );

    // ─── 8. Empty conversations display correctly ────────────────────────────
    record(
      'T8',
      'Empty conversations return valid clean empty data array',
      resSecondMsgs.status === 200 && Array.isArray(resSecondMsgs.body.data),
      `HTTP ${resSecondMsgs.status}, message count=${resSecondMsgs.body.data?.length}`
    );

    // ─── 9. API errors do not break complaint tracking ───────────────────────
    // Request with non-existent department ID
    const resBadDept = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/departments/6aee0c71d6a3ba8a4e375999/messages`,
      null,
      tokenCitizen
    );
    record(
      'T9',
      'API errors return clean structured responses without crashing server',
      resBadDept.status === 400 || resBadDept.status === 404,
      `HTTP ${resBadDept.status}, message="${resBadDept.body.message}"`
    );

    // ─── 10. Existing complaint tracking functions still work ────────────────
    const resTracking = await apiCall('GET', `/api/complaints/${targetComplaint.complaintId}`);
    const resTimeline = await apiCall('GET', `/api/complaints/${targetComplaint.complaintId}/timeline`);

    const trackingIntact =
      resTracking.status === 200 &&
      resTracking.body.success === true &&
      resTracking.body.data?.complaintId === targetComplaint.complaintId &&
      resTimeline.status === 200 &&
      Array.isArray(resTimeline.body.data);

    record(
      'T10',
      'Existing complaint tracking, details, and timeline endpoints remain fully functional',
      trackingIntact,
      `Tracking status: HTTP ${resTracking.status}, Timeline events: ${resTimeline.body.data?.length}`
    );

    // ─── Supplemental: Legacy messages endpoint ──────────────────────────────
    const resLegacy = await apiCall(
      'GET',
      `/api/complaints/${targetComplaint.complaintId}/messages?legacyOnly=true`,
      null,
      tokenCitizen
    );
    record(
      'SUP1',
      'Legacy / Archived messages endpoint accessible for archived inquiries drawer',
      resLegacy.status === 200 && Array.isArray(resLegacy.body.data),
      `Found ${resLegacy.body.data?.length} archived messages for ticket`
    );

  } finally {
    // Rollback test records
    if (createdMessageIds.length > 0) {
      await ComplaintMessage.deleteMany({ _id: { $in: createdMessageIds } });
      console.log(`\n🧹 Cleaned up ${createdMessageIds.length} test messages.`);
    }

    if (foreignCitizen?._id) {
      await User.deleteOne({ _id: foreignCitizen._id });
      console.log('🧹 Cleaned up test foreign citizen user.');
    }

    const finalMsgCount = await ComplaintMessage.countDocuments();
    console.log(`Final Atlas ComplaintMessage count: ${finalMsgCount} (Initial: ${initialMsgCount})`);
    record(
      'CLEANUP',
      'Live database records preserved with zero corruption',
      finalMsgCount === initialMsgCount,
      `Initial: ${initialMsgCount}, Final: ${finalMsgCount}`
    );

    testServer.close();
    await mongoose.disconnect();
    console.log('🔌 Test server closed and database disconnected.');
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`Phase 4 Test Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`Overall Status: ${allPassed ? 'ALL 10 REQUIRED TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('Phase 4 verification script failed:', err);
  process.exit(1);
});
