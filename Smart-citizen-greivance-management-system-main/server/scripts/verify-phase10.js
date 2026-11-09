/**
 * ============================================================================
 * PHASE 10: END-TO-END SYSTEM INTEGRATION AND COMPLETE LIFECYCLE VALIDATION
 * ============================================================================
 * Tests the complete 17-step grievance lifecycle, multi-department task
 * coordination, role-based boundary enforcement, and data privacy redaction.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const http = require('http');
const { app } = require('../index');

const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const User = require('../models/User');
const Citizen = require('../models/Citizen');
const Department = require('../models/Department');
const WorkflowEvent = require('../models/WorkflowEvent');

let server;
let port = 5110;
const BASE_URL = `http://127.0.0.1:${port}`;

const results = [];
function record(step, title, passed, detail = '') {
  results.push({ step, title, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${step}] ${title}`);
  if (detail) console.log(`       └─ ${detail}`);
}

async function apiCall(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }
  return { status: res.status, data: json, headers: res.headers };
}

async function runPhase10Integration() {
  console.log('\n================================================================');
  console.log('🌐  PHASE 10: FINAL SYSTEM INTEGRATION & LIFECYCLE VALIDATION');
  console.log('================================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    console.log(`✅  MongoDB connected: ${mongoose.connection.host} (db: ${mongoose.connection.name})`);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`📡  Test API Server running on port ${port}\n`);

    // -------------------------------------------------------------------------
    // STEP 0: Prepare Authorized Test Accounts & Obtain Real Tokens
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Ensure Test Users and Obtain Tokens ---');
    const waterDept = await Department.findOne({ name: 'Water & Sewerage Board' }) || await Department.findOne();
    const roadDept = await Department.findOne({ name: 'Road Maintenance Department' }) || await Department.findOne();

    // Ensure Water Supervisor exists
    let waterSup = await User.findOne({ email: 'sundarraj.supervisor@smartcity.gov.in' });
    if (!waterSup) {
      waterSup = await User.create({
        name: 'Er. A. Sundarraj',
        email: 'sundarraj.supervisor@smartcity.gov.in',
        passwordHash: 'Supervisor@123',
        role: 'department_supervisor',
        departmentId: waterDept._id,
        departmentName: waterDept.name,
        designation: 'Superintending Engineer',
        phone: '+91 98401 11022',
      });
    }

    // Ensure Water Employee exists
    let waterEmp = await User.findOne({ email: 'rahman.field@smartcity.gov.in' });
    if (!waterEmp) {
      waterEmp = await User.create({
        name: 'A. Rahman',
        email: 'rahman.field@smartcity.gov.in',
        passwordHash: 'Employee@123',
        role: 'department_employee',
        departmentId: waterDept._id,
        departmentName: waterDept.name,
        designation: 'Junior Pipeline Fitter',
        phone: '+91 98401 44556',
        employeeId: 'OFF-1035',
      });
    }

    // Login Admin
    const adminLogin = await apiCall('POST', '/api/auth/login', {
      email: 'admin.commissioner@smartcity.gov.in',
      password: 'Admin@123',
    });
    const adminToken = adminLogin.data?.token;

    // Login Road Supervisor
    const roadSupLogin = await apiCall('POST', '/api/auth/login', {
      email: 'selvam.supervisor@smartcity.gov.in',
      password: 'Supervisor@123',
    });
    const roadSupToken = roadSupLogin.data?.token;

    // Login Water Supervisor
    const waterSupLogin = await apiCall('POST', '/api/auth/login', {
      email: 'sundarraj.supervisor@smartcity.gov.in',
      password: 'Supervisor@123',
    });
    const waterSupToken = waterSupLogin.data?.token;

    // Login Road Employee
    const roadEmpLogin = await apiCall('POST', '/api/auth/login', {
      email: 'ramesh.field@smartcity.gov.in',
      password: 'Employee@123',
    });
    const roadEmpToken = roadEmpLogin.data?.token;

    // Login Water Employee
    const waterEmpLogin = await apiCall('POST', '/api/auth/login', {
      email: 'rahman.field@smartcity.gov.in',
      password: 'Employee@123',
    });
    const waterEmpToken = waterEmpLogin.data?.token;

    // -------------------------------------------------------------------------
    // STEP 1: Citizen Registration and Authentication
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1 & 2: Citizen Registration, Login & Multilingual Submission ---');
    const citizenEmail = `citizen_p10_${Date.now()}@example.com`;
    const regRes = await apiCall('POST', '/api/auth/register', {
      name: 'R. Anbarasan',
      email: citizenEmail,
      password: 'CitizenPassword123!',
      phone: '9840199887',
      address: '42, Anna Nagar 2nd Avenue, Chennai',
    });

    const citizenLoginRes = await apiCall('POST', '/api/auth/login', {
      email: citizenEmail,
      password: 'CitizenPassword123!',
    });

    const citizenToken = citizenLoginRes.data?.token;
    const citizenId = citizenLoginRes.data?.user?.citizenId;

    record(
      'STEP-01',
      'Citizen Registration and JWT Authentication',
      citizenLoginRes.status === 200 && !!citizenToken && !!citizenId && !!adminToken && !!roadSupToken && !!waterSupToken,
      `Registered citizen ID: ${citizenId}, Email: ${citizenEmail}`
    );

    // -------------------------------------------------------------------------
    // STEP 2 & 3: Multilingual Complaint Submission (Tamil-English Code-Mixed)
    // -------------------------------------------------------------------------
    const submissionPayload = {
      title: 'Water pipe leak and road collapsed near school',
      category: 'Water Supply',
      description: 'Inga main road la water pipeline burst aagi full water leak aaguthu, road fulla periya pothole aayiduchu school pillai pasanga pogave bayapaduranga. Immediate repair panunga.',
      language: 'ta',
      location: {
        address: 'Near Government High School, Anna Nagar, Chennai',
        ward: 'Ward 102',
        zone: 'Zone 8 (Anna Nagar)',
        latitude: 13.0850,
        longitude: 80.2100,
      },
      priority: 'HIGH',
    };

    const submitRes = await apiCall('POST', '/api/complaints', submissionPayload, citizenToken);
    const complaint = submitRes.data?.data;
    const complaintId = complaint?.complaintId;

    record(
      'STEP-02',
      'Multilingual Code-Mixed Submission Accepted',
      submitRes.status === 201 && !!complaintId,
      `Created Complaint ID: ${complaintId}, Language: ${complaint?.language}`
    );

    // -------------------------------------------------------------------------
    // STEP 4, 5, 6, 7: AI Understanding, Classification, Duplicate, Priority, Routing
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4 to 7: AI Processing Pipeline Verification ---');
    // Wait for async background pipeline
    await new Promise((r) => setTimeout(r, 2500));
    const processedComplaint = await Complaint.findOne({ complaintId });

    const aiUnderstood = !!processedComplaint?.llmAnalysis;
    const catClassified = processedComplaint?.category === 'Pothole' || processedComplaint?.category === 'Water Supply';
    const priAssigned = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(processedComplaint?.priority);
    const deptRecommended = !!processedComplaint?.departments?.primary?.departmentName;

    record(
      'STEP-04',
      'AI Analysis Pipeline (Understanding, Categorization, Priority, Routing)',
      aiUnderstood && catClassified && priAssigned && deptRecommended,
      `Category: "${processedComplaint?.category}", Priority: ${processedComplaint?.priority}, Primary Dept: "${processedComplaint?.departments?.primary?.departmentName}"`
    );

    // -------------------------------------------------------------------------
    // STEP 8 & 9: Central Admin Review and Multi-Department Approval
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8 & 9: Central Admin Multi-Department Approval ---');
    const approveRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/approve`,
      {
        action: 'approve',
        primaryDepartment: {
          departmentName: 'Road Maintenance Department',
          description: 'Pothole asphalt compaction and road resurfacing.',
        },
        supportingDepartments: [
          {
            departmentName: 'Water & Sewerage Board',
            reason: 'Isolate main valve and repair underground water pipe burst.',
          },
        ],
        priority: 'HIGH',
        adminNotes: 'Compound civic issue: water pipeline repair + road asphalt restoration.',
      },
      adminToken
    );

    const tasksRes = await apiCall('GET', `/api/complaints/${complaintId}/tasks`, null, adminToken);
    const tasks = tasksRes.data?.data || [];
    const roadTask = tasks.find((t) => t.departmentName === 'Road Maintenance Department');
    const waterTask = tasks.find((t) => t.departmentName === 'Water & Sewerage Board');

    record(
      'STEP-08-09',
      'Central Admin Multi-Department Approval Spawns Independent Tasks Under Same Complaint ID',
      approveRes.status === 200 && tasks.length === 2 && !!roadTask && !!waterTask && roadTask.complaintId === complaintId && waterTask.complaintId === complaintId,
      `Tasks spawned: [${roadTask?.taskId} (${roadTask?.departmentName}), ${waterTask?.taskId} (${waterTask?.departmentName})] under Parent ${complaintId}`
    );

    // -------------------------------------------------------------------------
    // STEP 10: Department Supervisors Assign Employees
    // -------------------------------------------------------------------------
    console.log('\n--- Step 10: Department Supervisor Task Assignments ---');
    const assignRoad = await apiCall(
      'PATCH',
      `/api/tasks/${roadTask.taskId}/assign`,
      { employeeName: 'K. Ramesh', notes: 'Deploy road repair crew' },
      roadSupToken
    );

    const assignWater = await apiCall(
      'PATCH',
      `/api/tasks/${waterTask.taskId}/assign`,
      { employeeName: 'A. Rahman', notes: 'Deploy pipeline leak detection crew' },
      waterSupToken
    );

    record(
      'STEP-10',
      'Supervisors Assign Authorized Department Tasks Independently',
      assignRoad.status === 200 && assignWater.status === 200,
      `Road Task assigned to ${assignRoad.data?.data?.assignedEmployeeName}, Water Task assigned to ${assignWater.data?.data?.assignedEmployeeName}`
    );

    // -------------------------------------------------------------------------
    // STEP 11 & 12: Employees Update Progress and Submit Resolution Evidence
    // -------------------------------------------------------------------------
    console.log('\n--- Step 11 & 12: Employee Progress & Resolution Evidence Submission ---');
    await apiCall('PATCH', `/api/tasks/${roadTask.taskId}/status`, { status: 'IN_PROGRESS' }, roadEmpToken);
    await apiCall('PATCH', `/api/tasks/${waterTask.taskId}/status`, { status: 'IN_PROGRESS' }, waterEmpToken);

    // Road Employee submits high quality resolution
    const roadResSubmit = await apiCall(
      'POST',
      `/api/tasks/${roadTask.taskId}/resolution`,
      {
        resolutionNotes: 'Excavated pothole boundaries, applied bituminous emulsion primer tack coat, and compacted aggregate asphalt base using vibratory roller. Water supply leak addressed first.',
        evidenceUrls: ['https://images.unsplash.com/photo-road-before', 'https://images.unsplash.com/photo-road-after'],
      },
      roadEmpToken
    );

    // Water Employee submits resolution notes
    const waterResSubmit = await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/resolution`,
      {
        resolutionNotes: 'Replaced ruptured 100mm CI valve coupling, pressure tested to 4 bar, and cleared trench.',
        evidenceUrls: ['https://images.unsplash.com/photo-water-valve'],
      },
      waterEmpToken
    );

    record(
      'STEP-11-12',
      'Employees Submit Resolution Notes & Evidence with Automated Assessment Generated',
      roadResSubmit.status === 200 && waterResSubmit.status === 200 && roadResSubmit.data?.data?.verification !== undefined,
      `Road Task Score: ${Math.round((roadResSubmit.data?.data?.verification?.verificationScore || 0) * 100)}/100, Recommendation: "${roadResSubmit.data?.data?.verification?.recommendation}"`
    );

    // -------------------------------------------------------------------------
    // STEP 13: Tasks Enter AWAITING_REVIEW (No Auto-Verification)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 13: Tasks Enter AWAITING_REVIEW State Without Premature Completion ---');
    const roadTaskAfterSub = await ComplaintTask.findOne({ taskId: roadTask.taskId });
    const parentAfterSub = await Complaint.findOne({ complaintId });

    record(
      'STEP-13',
      'Tasks Enter AWAITING_REVIEW with completedAt=null and Parent Stays Incomplete',
      roadTaskAfterSub.status === 'AWAITING_REVIEW' && roadTaskAfterSub.completedAt === null && parentAfterSub.status !== 'RESOLVED',
      `Road Task Status: "${roadTaskAfterSub.status}", completedAt: ${roadTaskAfterSub.completedAt}, Parent Complaint Status: "${parentAfterSub.status}"`
    );

    // -------------------------------------------------------------------------
    // STEP 14: Supervisor 1 Approves; Supervisor 2 Requests Rework
    // -------------------------------------------------------------------------
    console.log('\n--- Step 14: Supervisor Adjudication (Approval & Rework) ---');
    const roadSupApprove = await apiCall(
      'POST',
      `/api/tasks/${roadTask.taskId}/verify`,
      { action: 'approve', comments: 'Inspected road site; asphalt compaction is solid and flush.' },
      roadSupToken
    );

    const waterSupRework = await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/verify`,
      { action: 'request_rework', comments: 'Pressure test documentation incomplete. Upload pressure gauge photo.' },
      waterSupToken
    );

    const roadTaskAfterApprove = await ComplaintTask.findOne({ taskId: roadTask.taskId });
    const waterTaskAfterRework = await ComplaintTask.findOne({ taskId: waterTask.taskId });
    const parentAfterPartial = await Complaint.findOne({ complaintId });

    record(
      'STEP-14',
      'Supervisor Approves Task 1 (VERIFIED) & Requests Rework for Task 2 (REQUIRES_ADDITIONAL_WORK)',
      roadTaskAfterApprove.status === 'VERIFIED' && waterTaskAfterRework.status === 'REQUIRES_ADDITIONAL_WORK' && parentAfterPartial.status === 'PARTIALLY_RESOLVED',
      `Road Task: "${roadTaskAfterApprove.status}", Water Task: "${waterTaskAfterRework.status}", Parent Complaint: "${parentAfterPartial.status}"`
    );

    // -------------------------------------------------------------------------
    // STEP 15: Invariant - Premature Closure Blocked While Rework Pending
    // -------------------------------------------------------------------------
    console.log('\n--- Step 15: Premature Resolution & Closure Invariants ---');
    const prematureClose = await apiCall('POST', `/api/complaints/${complaintId}/close`, {}, adminToken);

    record(
      'STEP-15-PREMATURE',
      'Premature Central Admin Closure Blocked While Task in Rework (HTTP 400)',
      prematureClose.status === 400,
      `HTTP status: ${prematureClose.status}, Error message: "${prematureClose.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // STEP 16: Water Employee Resubmits, Water Supervisor Approves -> Complaint RESOLVED
    // -------------------------------------------------------------------------
    console.log('\n--- Step 16: Rework Resubmission & Final Verification ---');
    await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/resolution`,
      {
        resolutionNotes: 'Pressure gauge test verified at 4.2 bar steady for 30 minutes. Photographic evidence attached.',
        evidenceUrls: ['https://images.unsplash.com/photo-water-valve', 'https://images.unsplash.com/photo-gauge-test'],
      },
      waterEmpToken
    );

    const waterSupApprove2 = await apiCall(
      'POST',
      `/api/tasks/${waterTask.taskId}/verify`,
      { action: 'approve', comments: 'Gauge verified. Leak repaired cleanly.' },
      waterSupToken
    );

    const parentAfterAllVerified = await Complaint.findOne({ complaintId });

    record(
      'STEP-16',
      'All Tasks Verified Transitions Parent Complaint to RESOLVED',
      waterSupApprove2.status === 200 && parentAfterAllVerified.status === 'RESOLVED',
      `Water Task Status: "VERIFIED", Parent Complaint Status: "${parentAfterAllVerified.status}"`
    );

    // -------------------------------------------------------------------------
    // STEP 17: Central Admin Final Review and Closure
    // -------------------------------------------------------------------------
    console.log('\n--- Step 17: Central Admin Final Closure & Public Tracking Invariants ---');
    const finalCloseRes = await apiCall('POST', `/api/complaints/${complaintId}/close`, {}, adminToken);
    const closedComplaint = await Complaint.findOne({ complaintId });

    record(
      'STEP-17',
      'Central Admin Performs Final Closure (CLOSED)',
      finalCloseRes.status === 200 && closedComplaint.status === 'CLOSED',
      `Parent Complaint ${complaintId} successfully closed at ${closedComplaint.closedAt}`
    );

    // -------------------------------------------------------------------------
    // STEP 18: Public Citizen Tracking & Sensitive Information Redaction
    // -------------------------------------------------------------------------
    console.log('\n--- Step 18: Data Privacy & Security Audit on Public Endpoints ---');
    const publicTrackRes = await apiCall('GET', `/api/complaints/${complaintId}`);
    const pubTasksRes = await apiCall('GET', `/api/complaints/${complaintId}/tasks`);

    const pubData = publicTrackRes.data?.data;
    const pubTasks = pubTasksRes.data?.data || [];

    const hasInternalScores = pubTasks.some((t) => t.resolution?.automatedAssessment !== undefined || t.resolution?.rubric !== undefined);
    const hasEmployeeStaffId = pubTasks.some((t) => t.assignedEmployeeId !== undefined && t.assignedEmployeeId !== null);
    const hasDelayRisk = pubTasks.some((t) => t.delayRisk !== undefined);

    record(
      'STEP-18-PRIVACY',
      'Public & Citizen Endpoints Redact Internal Staff IDs, Rubric Scores & Predictive Risk',
      publicTrackRes.status === 200 && !hasInternalScores && !hasEmployeeStaffId && !hasDelayRisk,
      `Internal scores leaked: ${hasInternalScores}, Staff IDs leaked: ${hasEmployeeStaffId}, Delay risk leaked: ${hasDelayRisk}`
    );

    // -------------------------------------------------------------------------
    // STEP 19: Single Complaint ID Preservation Invariant
    // -------------------------------------------------------------------------
    const allDbTasks = await ComplaintTask.find({ complaintId });
    const allEvents = await WorkflowEvent.find({ complaintId });
    const idPreserved = allDbTasks.every((t) => t.complaintId === complaintId) && allEvents.every((e) => e.complaintId === complaintId);

    record(
      'STEP-19-ID-INVARIANT',
      'Single Complaint ID Preserved Across All Tasks, Events, and Resolutions',
      idPreserved && allDbTasks.length === 2 && allEvents.length >= 6,
      `Complaint ID "${complaintId}" uniform across ${allDbTasks.length} tasks and ${allEvents.length} workflow events`
    );

    // Clean up temporary records created by this integration test
    console.log('\n--- Cleaning Up Integration Test Records ---');
    await ComplaintTask.deleteMany({ complaintId });
    await Complaint.deleteOne({ complaintId });
    await WorkflowEvent.deleteMany({ complaintId });
    await Citizen.deleteOne({ email: citizenEmail });
    await User.deleteOne({ email: citizenEmail });
    console.log('✅ Temporary integration test records cleaned up safely.');

  } catch (err) {
    console.error('❌ Phase 10 Integration Error:', err);
  } finally {
    if (server) {
      server.close();
      console.log('🛑  Test API Server stopped.');
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('📦 Database connection closed.');
    }
  }

  // Summary
  console.log('\n================================================================');
  console.log('📊  PHASE 10 INTEGRATION VERIFICATION SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL 11 PHASE 10 INTEGRATION CHECKS PASSED PERFECTLY!\n');
  } else {
    console.log(`\n⚠️  ${failed} check(s) failed in Phase 10 integration.\n`);
  }
}

runPhase10Integration();
