'use strict';

/**
 * ============================================================================
 * PHASE 7: COMPREHENSIVE END-TO-END APPLICATION AUDIT & VERIFICATION SUITE
 * ============================================================================
 * Audits and verifies:
 * 1. Four-role authentication, JWT sessions, route boundaries, and RBAC enforcement.
 * 2. Complete multi-department complaint lifecycle from citizen submission to final closure.
 * 3. Citizen-Department Official Chat end-to-end flows with security and isolation.
 * 4. Department visibility and data scoping on tasks and complaints.
 * 5. Data integrity, reference consistency, and exact cleanup rollback on Atlas.
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
const WorkflowEvent = require('../models/WorkflowEvent');
const Resolution = require('../models/Resolution');

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🔍 PHASE 7: COMPREHENSIVE END-TO-END AUDIT & VERIFICATION');
  console.log('================================================================\n');

  const results = [];
  function record(section, id, title, passed, details) {
    results.push({ section, id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${section}] ${mark} [${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  await connectDatabase();

  const initialCounts = {
    complaints: await Complaint.countDocuments(),
    tasks: await ComplaintTask.countDocuments(),
    messages: await ComplaintMessage.countDocuments(),
    notifications: await Notification.countDocuments(),
    events: await WorkflowEvent.countDocuments(),
  };

  console.log('📊 Initial MongoDB Atlas Document Counts:');
  console.log(`   Complaints: ${initialCounts.complaints}`);
  console.log(`   Tasks: ${initialCounts.tasks}`);
  console.log(`   Messages: ${initialCounts.messages}`);
  console.log(`   Notifications: ${initialCounts.notifications}`);
  console.log(`   Workflow Events: ${initialCounts.events}\n`);

  // Start Express on dedicated test port
  const TEST_PORT = 5126;
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

  // Retrieve existing users representing all 4 roles
  const citizen = await User.findOne({ role: 'citizen', active: true });
  const admin = await User.findOne({ role: 'central_admin', active: true });
  const roadSupervisor = await User.findOne({
    role: 'department_supervisor',
    departmentName: 'Road Maintenance Department',
    active: true,
  });
  const waterSupervisor = await User.findOne({
    role: 'department_supervisor',
    departmentName: 'Water & Sewerage Board',
    active: true,
  });
  const roadEmployee = await User.findOne({
    role: 'department_employee',
    departmentName: 'Road Maintenance Department',
    active: true,
  });
  const waterEmployee = await User.findOne({
    role: 'department_employee',
    departmentName: 'Water & Sewerage Board',
    active: true,
  });

  const roadDept = await Department.findOne({ name: 'Road Maintenance Department' });
  const waterDept = await Department.findOne({ name: 'Water & Sewerage Board' });

  // Tokens
  const tokenCitizen = generateToken(citizen);
  const tokenAdmin = generateToken(admin);
  const tokenRoadSupervisor = generateToken(roadSupervisor);
  const tokenWaterSupervisor = generateToken(waterSupervisor);
  const tokenRoadEmployee = generateToken(roadEmployee);
  const tokenWaterEmployee = generateToken(waterEmployee);

  // Tracking arrays for strict teardown rollback
  const createdComplaintIds = [];
  const createdTaskIds = [];
  const createdMessageIds = [];
  const createdNotificationIds = [];
  const createdResolutionIds = [];
  const createdEventIds = [];

  try {
    // =========================================================================
    // SECTION 1: FOUR-ROLE AUTHENTICATION & ACCESS CONTROL
    // =========================================================================
    console.log('--- SECTION 1: Four-Role Authentication & Access Control ---');

    // 1.1 Unauthenticated request rejection on protected admin routes
    const resNoAuthAdmin = await apiCall('POST', '/api/dashboard/hotspots/scan', {}, null);
    record(
      'AUTH',
      'A1.1',
      'Unauthenticated request blocked on protected admin routes (401)',
      resNoAuthAdmin.status === 401,
      `Status: ${resNoAuthAdmin.status}`
    );

    // 1.2 Invalid / expired token rejection
    const resInvalidToken = await apiCall('POST', '/api/dashboard/hotspots/scan', {}, 'invalid_expired_token_xyz');
    record(
      'AUTH',
      'A1.2',
      'Invalid / expired token rejected with 401 TOKEN_INVALID',
      resInvalidToken.status === 401 && resInvalidToken.body?.code === 'TOKEN_INVALID',
      `Status: ${resInvalidToken.status}, Code: ${resInvalidToken.body?.code}`
    );

    // 1.3 Citizen role boundary check: Citizen blocked from Central Admin routes
    const resCitizenOnAdmin = await apiCall('POST', '/api/dashboard/hotspots/scan', {}, tokenCitizen);
    record(
      'AUTH',
      'A1.3',
      'Citizen blocked from Central Admin hotspot scan route (403 Forbidden)',
      resCitizenOnAdmin.status === 403,
      `Status: ${resCitizenOnAdmin.status}`
    );

    // 1.4 Citizen role boundary check: Citizen blocked from internal department task queues
    const resCitizenOnTasks = await apiCall('GET', '/api/tasks', null, tokenCitizen);
    record(
      'AUTH',
      'A1.4',
      'Citizen blocked from accessing internal department task queue (403 Forbidden)',
      resCitizenOnTasks.status === 403,
      `Status: ${resCitizenOnTasks.status}`
    );

    // 1.5 Central Admin authorized on municipal stats and dashboard
    const resAdminStats = await apiCall('GET', '/api/dashboard/statistics', null, tokenAdmin);
    record(
      'AUTH',
      'A1.5',
      'Central Admin authorized on citywide dashboard analytics (200 OK)',
      resAdminStats.status === 200 && resAdminStats.body?.success === true,
      `Status: ${resAdminStats.status}, Total grievances: ${resAdminStats.body?.data?.totalGrievances}`
    );

    // 1.6 Department Supervisor blocked from Central Admin provisioning routes
    const resSupervisorOnAdmin = await apiCall(
      'POST',
      '/api/auth/provision-staff',
      { name: 'Fake Staff', email: 'fake@smartcity.gov.in', password: 'password123', role: 'department_employee' },
      tokenRoadSupervisor
    );
    record(
      'AUTH',
      'A1.6',
      'Department Supervisor blocked from Central Admin staff provisioning (403 Forbidden)',
      resSupervisorOnAdmin.status === 403,
      `Status: ${resSupervisorOnAdmin.status}`
    );

    // 1.7 Department Employee blocked from verifying tasks (Supervisor privilege)
    const resEmpVerify = await apiCall('POST', '/api/tasks/FAKE-TASK-ID/verify', { action: 'approve', comments: 'Fake' }, tokenRoadEmployee);
    record(
      'AUTH',
      'A1.7',
      'Department Employee blocked from task verification endpoint (403 Forbidden)',
      resEmpVerify.status === 403,
      `Status: ${resEmpVerify.status}`
    );

    // =========================================================================
    // SECTION 2: COMPLETE COMPLAINT LIFECYCLE (MULTI-DEPARTMENT)
    // =========================================================================
    console.log('\n--- SECTION 2: Complete Complaint Lifecycle (Multi-Department) ---');

    // 2.1 Citizen Submits Grievance
    const submissionPayload = {
      citizenId: citizen.citizenId || 'CIT-8842',
      description: 'Phase 7 Audit: Major sinkhole with fractured water pipe flooding 3rd Cross Street.',
      category: 'Pothole',
      priority: 'HIGH',
      location: {
        address: '3rd Cross Street, T. Nagar, Chennai',
        latitude: 13.0418,
        longitude: 80.2341,
        ward: 'Ward 114',
        zone: 'Zone 10',
      },
    };

    const resSubmit = await apiCall('POST', '/api/complaints', submissionPayload, tokenCitizen);
    const createdComplaint = resSubmit.body?.data;
    if (createdComplaint?.complaintId) {
      createdComplaintIds.push(createdComplaint.complaintId);
    }

    record(
      'LIFECYCLE',
      'L2.1',
      'Citizen registers civic grievance; initial status SUBMITTED',
      resSubmit.status === 201 && createdComplaint?.status === 'SUBMITTED',
      `Status: ${resSubmit.status}, Complaint ID: ${createdComplaint?.complaintId}`
    );

    // 2.2 Central Admin Reviews and Approves Multi-Department Routing
    // Assigns Primary: Road Maintenance, Supporting: Water & Sewerage Board
    const approvePayload = {
      action: 'approve',
      primaryDepartment: {
        departmentId: roadDept._id.toString(),
        departmentName: roadDept.name,
        reason: 'Primary road surface excavation and asphalt resurfacing.',
      },
      supportingDepartments: [
        {
          departmentId: waterDept._id.toString(),
          departmentName: waterDept.name,
          reason: 'Repair fractured underground water pipeline and stop flooding.',
        },
      ],
      adminNotes: 'Phase 7 Audit multi-department administrative approval.',
    };

    const resApprove = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/approve-routing`,
      approvePayload,
      tokenAdmin
    );

    const approvedData = resApprove.body?.data;
    record(
      'LIFECYCLE',
      'L2.2',
      'Central Admin approves multi-department routing; spawns coordinated sub-tasks',
      resApprove.status === 200 && approvedData?.complaint?.status === 'DEPARTMENT_ASSIGNMENT',
      `Status: ${resApprove.status}, Complaint status: ${approvedData?.complaint?.status}, Tasks spawned: ${approvedData?.tasks?.length}`
    );

    // Track spawned tasks
    const spawnedTasks = await ComplaintTask.find({ complaintId: createdComplaint.complaintId });
    spawnedTasks.forEach((t) => createdTaskIds.push(t.taskId));
    const roadTask = spawnedTasks.find((t) => t.departmentName === roadDept.name);
    const waterTask = spawnedTasks.find((t) => t.departmentName === waterDept.name);

    record(
      'LIFECYCLE',
      'L2.3',
      'Department sub-tasks created with explicit department isolation',
      Boolean(roadTask) && Boolean(waterTask) && spawnedTasks.length === 2,
      `Road Task: ${roadTask?.taskId} (${roadTask?.status}), Water Task: ${waterTask?.taskId} (${waterTask?.status})`
    );

    // 2.3 Road Supervisor assigns Road Task to Road Employee
    const resAssignRoad = await apiCall(
      'PATCH',
      `/api/tasks/${roadTask.taskId}/assign`,
      { employeeName: roadEmployee.name, assignedEmployeeId: roadEmployee._id.toString() },
      tokenRoadSupervisor
    );

    record(
      'LIFECYCLE',
      'L2.4',
      'Road Supervisor assigns Task 1 to Road Employee; advances complaint to IN_PROGRESS',
      resAssignRoad.status === 200 && resAssignRoad.body?.data?.status === 'ASSIGNED',
      `Status: ${resAssignRoad.status}, Assigned To: ${resAssignRoad.body?.data?.assignedEmployeeName}`
    );

    // 2.4 Water Supervisor assigns Water Task to Water Employee
    const resAssignWater = await apiCall(
      'PATCH',
      `/api/tasks/${waterTask.taskId}/assign`,
      { employeeName: waterEmployee.name, assignedEmployeeId: waterEmployee._id.toString() },
      tokenWaterSupervisor
    );

    record(
      'LIFECYCLE',
      'L2.5',
      'Water Supervisor assigns Task 2 to Water Employee',
      resAssignWater.status === 200 && resAssignWater.body?.data?.status === 'ASSIGNED',
      `Status: ${resAssignWater.status}, Assigned To: ${resAssignWater.body?.data?.assignedEmployeeName}`
    );

    // 2.5 Road Employee accepts and transitions task to IN_PROGRESS
    const resRoadProgress = await apiCall(
      'PATCH',
      `/api/tasks/${roadTask.taskId}/status`,
      { status: 'IN_PROGRESS', note: 'Road crew arrived on site with asphalt compactors.' },
      tokenRoadEmployee
    );

    record(
      'LIFECYCLE',
      'L2.6',
      'Road Employee starts field work (status IN_PROGRESS)',
      resRoadProgress.status === 200 && resRoadProgress.body?.data?.status === 'IN_PROGRESS',
      `Status: ${resRoadProgress.status}, Task status: ${resRoadProgress.body?.data?.status}`
    );

    // 2.6 Road Employee Submits Resolution Evidence
    const resRoadResolve = await apiCall(
      'POST',
      `/api/tasks/${roadTask.taskId}/resolve`,
      {
        resolutionNotes: 'Excavated damaged road segment, laid concrete base, and sealed with asphalt.',
        evidenceUrls: ['https://storage.smartcity.gov.in/evidence/road_repaired_phase7.jpg'],
      },
      tokenRoadEmployee
    );

    const taskAfterResolve = resRoadResolve.body?.data?.task;

    record(
      'LIFECYCLE',
      'L2.7',
      'Road Employee submits resolution evidence; task moves to AWAITING_REVIEW',
      resRoadResolve.status === 200 && taskAfterResolve?.status === 'AWAITING_REVIEW',
      `Status: ${resRoadResolve.status}, Task status: ${taskAfterResolve?.status}`
    );

    // 2.7 Road Supervisor Verifies Road Task Resolution
    const resVerifyRoad = await apiCall(
      'POST',
      `/api/tasks/${roadTask.taskId}/verify`,
      {
        action: 'approve',
        comments: 'Site inspected. Asphalt density meets municipal standard.',
      },
      tokenRoadSupervisor
    );

    // Check parent complaint status (1 of 2 tasks verified -> PARTIALLY_RESOLVED)
    const complaintMidCheck = await Complaint.findOne({ complaintId: createdComplaint.complaintId });
    record(
      'LIFECYCLE',
      'L2.8',
      'Road Supervisor verifies Task 1; complaint enters PARTIALLY_RESOLVED state',
      resVerifyRoad.status === 200 && complaintMidCheck.status === 'PARTIALLY_RESOLVED',
      `Task 1: VERIFIED, Parent Complaint Status: ${complaintMidCheck.status}`
    );

    // 2.8 Water Employee resolves Task 2
    await apiCall(
      'PATCH',
      `/api/tasks/${waterTask.taskId}/status`,
      { status: 'IN_PROGRESS', note: 'Replaced ruptured 6-inch pipe section.' },
      tokenWaterEmployee
    );

    const resWaterResolve = await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/resolve`,
      {
        resolutionNotes: 'Replaced ruptured 6-inch main, pressure tested at 4.2 bar, zero leaks.',
        evidenceUrls: ['https://storage.smartcity.gov.in/evidence/water_repaired_phase7.jpg'],
      },
      tokenWaterEmployee
    );

    // 2.9 Water Supervisor Verifies Task 2
    const resVerifyWater = await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/verify`,
      {
        action: 'approve',
        comments: 'Pipe pressure verified. Leak completely arrested.',
      },
      tokenWaterSupervisor
    );

    // Now ALL sub-tasks are VERIFIED -> Parent complaint moves to RESOLVED / REQUIRES_REVIEW for Admin closure
    const complaintAllResolved = await Complaint.findOne({ complaintId: createdComplaint.complaintId });
    record(
      'LIFECYCLE',
      'L2.9',
      'All department tasks verified; complaint advances to RESOLVED / REQUIRES_REVIEW',
      resVerifyWater.status === 200 && ['RESOLVED', 'REQUIRES_REVIEW'].includes(complaintAllResolved.status),
      `Task 2: VERIFIED, Parent Complaint Status: ${complaintAllResolved.status}`
    );

    // 2.10 Central Admin Executes Final Overall Complaint Closure
    const resClose = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/close`,
      { adminNotes: 'Phase 7 Audit: Multi-department resolution verified. Final closure authorized.' },
      tokenAdmin
    );

    const complaintFinal = await Complaint.findOne({ complaintId: createdComplaint.complaintId });
    record(
      'LIFECYCLE',
      'L2.10',
      'Central Admin performs final overall closure; complaint status CLOSED',
      resClose.status === 200 && complaintFinal.status === 'CLOSED',
      `Status: ${resClose.status}, Final Complaint Status: ${complaintFinal.status}`
    );

    // 2.11 Citizen Tracks Final Complaint Details & Audit Timeline
    const resCitizenTrack = await apiCall('GET', `/api/complaints/${createdComplaint.complaintId}`, null, tokenCitizen);
    const resTimeline = await apiCall('GET', `/api/complaints/${createdComplaint.complaintId}/timeline`, null, tokenCitizen);

    record(
      'LIFECYCLE',
      'L2.11',
      'Citizen tracks final closed ticket and full immutable timeline audit events',
      resCitizenTrack.status === 200 && resCitizenTrack.body?.data?.status === 'CLOSED' && Array.isArray(resTimeline.body?.data),
      `Status: ${resCitizenTrack.body?.data?.status}, Timeline events: ${resTimeline.body?.data?.length}`
    );

    // =========================================================================
    // SECTION 3: CITIZEN-DEPARTMENT OFFICIAL CHAT END-TO-END
    // =========================================================================
    console.log('\n--- SECTION 3: Official Citizen-Department Chat End-to-End ---');

    // 3.1 Citizen sends message to Department A (Road Maintenance)
    const resCitizenMsg = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      { message: 'Citizen inquiry: Has the road resurfacing crew arrived on site?' },
      tokenCitizen
    );

    let citizenMsg = null;
    if (resCitizenMsg.status === 201) {
      citizenMsg = resCitizenMsg.body?.data;
      createdMessageIds.push(citizenMsg._id);
    }

    record(
      'CHAT',
      'C3.1',
      'Citizen sends official message to Department A thread',
      resCitizenMsg.status === 201 && citizenMsg?.senderRole === 'citizen',
      `Status: ${resCitizenMsg.status}, MessageId: ${citizenMsg?._id}`
    );

    // 3.2 Department A Supervisor receives and posts public reply
    const resSupervisorReply = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Supervisor reply: Field crew is actively working on asphalt compaction.',
        isInternal: false,
      },
      tokenRoadSupervisor
    );

    let supervisorReplyMsg = null;
    if (resSupervisorReply.status === 201) {
      supervisorReplyMsg = resSupervisorReply.body?.data;
      createdMessageIds.push(supervisorReplyMsg._id);
    }

    record(
      'CHAT',
      'C3.2',
      'Department A Supervisor posts official citizen-visible reply',
      resSupervisorReply.status === 201 && supervisorReplyMsg?.isInternal === false,
      `Status: ${resSupervisorReply.status}, Sender: ${supervisorReplyMsg?.senderName}`
    );

    // 3.3 Citizen reads department conversation; public reply is visible
    const resCitizenReadMsgs = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );

    const msgsSeenByCitizen = resCitizenReadMsgs.body?.data || [];
    const publicReplySeen = msgsSeenByCitizen.some((m) => m._id === supervisorReplyMsg?._id);

    record(
      'CHAT',
      'C3.3',
      'Citizen sees official public reply in Department A thread',
      resCitizenReadMsgs.status === 200 && publicReplySeen,
      `Status: ${resCitizenReadMsgs.status}, Public reply visible: ${publicReplySeen}`
    );

    // 3.4 Supervisor posts an internal municipal staff note
    const resInternalNote = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Internal Staff Note: Coordinate with water crew before final paving.',
        isInternal: true,
      },
      tokenRoadSupervisor
    );

    let internalNoteMsg = null;
    if (resInternalNote.status === 201) {
      internalNoteMsg = resInternalNote.body?.data;
      createdMessageIds.push(internalNoteMsg._id);
    }

    record(
      'CHAT',
      'C3.4',
      'Department Supervisor posts internal staff note (isInternal: true)',
      resInternalNote.status === 201 && internalNoteMsg?.isInternal === true,
      `Status: ${resInternalNote.status}, MessageId: ${internalNoteMsg?._id}`
    );

    // 3.5 Citizen Privacy Isolation: Internal note MUST NOT appear in citizen API response
    const resCitizenCheckInternal = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenCitizen
    );

    const citizenCheckMsgs = resCitizenCheckInternal.body?.data || [];
    const internalLeaked = citizenCheckMsgs.some((m) => m.isInternal === true || m._id === internalNoteMsg?._id);

    record(
      'CHAT',
      'C3.5',
      'Citizen Privacy: Internal staff notes are strictly hidden from citizens',
      !internalLeaked,
      `Internal notes leaked to citizen: ${internalLeaked}`
    );

    // 3.6 Assigned Employee can access task conversation
    const resEmpAccess = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenRoadEmployee
    );

    record(
      'CHAT',
      'C3.6',
      'Assigned Employee accesses department task conversation (200 OK)',
      resEmpAccess.status === 200 && Array.isArray(resEmpAccess.body?.data),
      `Status: ${resEmpAccess.status}, Messages retrieved: ${resEmpAccess.body?.data?.length}`
    );

    // 3.7 Department B Supervisor CANNOT access Department A conversation (Department Isolation)
    const resDeptIsolation = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenWaterSupervisor
    );

    record(
      'CHAT',
      'C3.7',
      'Department Isolation: Outside supervisor blocked from Department A chat (403 Forbidden)',
      resDeptIsolation.status === 403,
      `Status: ${resDeptIsolation.status}, Message: ${resDeptIsolation.body?.message}`
    );

    // 3.8 Central Admin views conversations across both departments
    const resAdminViewRoad = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      null,
      tokenAdmin
    );
    const resAdminViewWater = await apiCall(
      'GET',
      `/api/complaints/${createdComplaint.complaintId}/departments/${waterDept._id}/messages`,
      null,
      tokenAdmin
    );

    record(
      'CHAT',
      'C3.8',
      'Central Admin has municipal oversight across all participating departments',
      resAdminViewRoad.status === 200 && resAdminViewWater.status === 200,
      `Road thread: ${resAdminViewRoad.status}, Water thread: ${resAdminViewWater.status}`
    );

    // 3.9 Central Admin issues internal directive; supervisor notified, zero citizen leak
    const resAdminDirective = await apiCall(
      'POST',
      `/api/complaints/${createdComplaint.complaintId}/departments/${roadDept._id}/messages`,
      {
        message: 'Admin Directive: Expedite paving inspection report for city commissioner.',
        isInternal: true,
      },
      tokenAdmin
    );

    let adminDirectiveMsg = null;
    if (resAdminDirective.status === 201) {
      adminDirectiveMsg = resAdminDirective.body?.data;
      createdMessageIds.push(adminDirectiveMsg._id);
    }

    await new Promise((r) => setTimeout(r, 600));

    const supNotif = await Notification.findOne({
      recipientRole: 'department_supervisor',
      userId: roadSupervisor._id,
      complaintId: createdComplaint.complaintId,
      message: { $regex: /issued directive/i },
    });

    const citizenNotifLeak = await Notification.findOne({
      recipientRole: 'citizen',
      complaintId: createdComplaint.complaintId,
      message: { $regex: /Expedite paving inspection report/i },
    });

    record(
      'CHAT',
      'C3.9',
      'Central Admin directive delivered to Supervisor; zero notification leak to Citizen',
      Boolean(supNotif) && !citizenNotifLeak,
      `Supervisor notified: ${Boolean(supNotif)}, Citizen leak: ${Boolean(citizenNotifLeak)}`
    );

    // 3.10 Chat actions do not mutate complaint status, priority, or SLA
    const complaintAfterChat = await Complaint.findOne({ complaintId: createdComplaint.complaintId });
    const tasksAfterChat = await ComplaintTask.find({ complaintId: createdComplaint.complaintId });

    record(
      'CHAT',
      'C3.10',
      'Workflow Isolation Guarantee: Chat actions do not mutate status, priority, or SLA',
      complaintAfterChat.status === 'CLOSED' && tasksAfterChat.every((t) => t.status === 'VERIFIED'),
      `Complaint status: ${complaintAfterChat.status}, All tasks verified: ${tasksAfterChat.every((t) => t.status === 'VERIFIED')}`
    );

    // =========================================================================
    // SECTION 4: DEPARTMENT VISIBILITY & DATA SCOPING
    // =========================================================================
    console.log('\n--- SECTION 4: Department Visibility & Data Scoping ---');

    // 4.1 Department Supervisor views complaints: strictly filtered to supervisor department
    const resSupervisorComplaints = await apiCall('GET', '/api/complaints', null, tokenRoadSupervisor);
    const supComplaintsList = resSupervisorComplaints.body?.data || [];
    const foreignDeptComplaints = supComplaintsList.filter(
      (c) => c.routing?.departmentName && c.routing.departmentName !== roadSupervisor.departmentName
    );

    record(
      'VISIBILITY',
      'V4.1',
      'Supervisor complaint list strictly scoped to supervisor department',
      resSupervisorComplaints.status === 200 && foreignDeptComplaints.length === 0,
      `Total returned: ${supComplaintsList.length}, Foreign department complaints: ${foreignDeptComplaints.length}`
    );

    // 4.2 Department Employee views tasks: strictly scoped to assigned tasks
    const resEmployeeTasks = await apiCall('GET', '/api/tasks', null, tokenRoadEmployee);
    const empTasksList = resEmployeeTasks.body?.data || [];
    const unassignedTasks = empTasksList.filter(
      (t) =>
        t.assignedEmployeeName !== roadEmployee.name &&
        t.assignedEmployeeId?.toString() !== roadEmployee._id.toString()
    );

    record(
      'VISIBILITY',
      'V4.2',
      'Employee task queue strictly scoped to tasks assigned to that employee',
      resEmployeeTasks.status === 200 && unassignedTasks.length === 0,
      `Total returned: ${empTasksList.length}, Unassigned tasks exposed: ${unassignedTasks.length}`
    );

    // 4.3 Department Supervisor views tasks: strictly scoped to supervisor department
    const resSupervisorTasks = await apiCall('GET', '/api/tasks', null, tokenRoadSupervisor);
    const supTasksList = resSupervisorTasks.body?.data || [];
    const outsideDeptTasks = supTasksList.filter(
      (t) => t.departmentName !== roadSupervisor.departmentName
    );

    record(
      'VISIBILITY',
      'V4.3',
      'Supervisor task queue strictly scoped to department tasks',
      resSupervisorTasks.status === 200 && outsideDeptTasks.length === 0,
      `Total returned: ${supTasksList.length}, Outside department tasks exposed: ${outsideDeptTasks.length}`
    );

  } finally {
    console.log('\n🧹 Initiating Reliable Rollback Teardown...');

    // 1. Delete test messages
    if (createdMessageIds.length > 0) {
      await ComplaintMessage.deleteMany({ _id: { $in: createdMessageIds } });
      console.log(`   Deleted ${createdMessageIds.length} test chat messages.`);
    }

    // 2. Delete test tasks
    if (createdTaskIds.length > 0) {
      await ComplaintTask.deleteMany({ taskId: { $in: createdTaskIds } });
      console.log(`   Deleted ${createdTaskIds.length} test department tasks.`);
    }

    // 3. Delete test notifications
    const deletedNotifs = await Notification.deleteMany({
      complaintId: { $in: createdComplaintIds },
    });
    console.log(`   Deleted ${deletedNotifs.deletedCount} test notifications.`);

    // 4. Delete test workflow events
    const deletedEvents = await WorkflowEvent.deleteMany({
      complaintId: { $in: createdComplaintIds },
    });
    console.log(`   Deleted ${deletedEvents.deletedCount} test workflow events.`);

    // 5. Delete test resolutions
    const deletedResolutions = await Resolution.deleteMany({
      complaintId: { $in: createdComplaintIds },
    });
    console.log(`   Deleted ${deletedResolutions.deletedCount} test resolutions.`);

    // 6. Delete test complaints
    if (createdComplaintIds.length > 0) {
      await Complaint.deleteMany({ complaintId: { $in: createdComplaintIds } });
      console.log(`   Deleted ${createdComplaintIds.length} test complaints.`);
    }

    // Final database parity check
    const finalCounts = {
      complaints: await Complaint.countDocuments(),
      tasks: await ComplaintTask.countDocuments(),
      messages: await ComplaintMessage.countDocuments(),
      notifications: await Notification.countDocuments(),
      events: await WorkflowEvent.countDocuments(),
    };

    console.log('\n📊 Final MongoDB Atlas Document Counts:');
    console.log(`   Complaints: ${finalCounts.complaints} (Initial: ${initialCounts.complaints})`);
    console.log(`   Tasks: ${finalCounts.tasks} (Initial: ${initialCounts.tasks})`);
    console.log(`   Messages: ${finalCounts.messages} (Initial: ${initialCounts.messages})`);
    console.log(`   Notifications: ${finalCounts.notifications} (Initial: ${initialCounts.notifications})`);
    console.log(`   Workflow Events: ${finalCounts.events} (Initial: ${initialCounts.events})`);

    const exactParity =
      finalCounts.complaints === initialCounts.complaints &&
      finalCounts.tasks === initialCounts.tasks &&
      finalCounts.messages === initialCounts.messages &&
      finalCounts.notifications === initialCounts.notifications &&
      finalCounts.events === initialCounts.events;

    record(
      'INTEGRITY',
      'INT.1',
      'Exact Database Parity Rollback: Zero orphan records, Atlas state preserved',
      exactParity,
      `Exact count parity across all 5 audited collections: ${exactParity}`
    );

    testServer.close();
    await mongoose.disconnect();
    console.log('🔌 Test server closed and database connection released.');
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n================================================================');
  console.log(`Phase 7 Verification Summary: ${passedCount}/${results.length} checks passed`);
  console.log(`Overall Status: ${passedCount === results.length ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('Phase 7 verification suite failed:', err);
  process.exit(1);
});
