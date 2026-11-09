/**
 * ============================================================================
 * PHASE 11: COMPLETE APPLICATION AUDIT AND ROLE-BASED FUNCTIONAL VERIFICATION
 * ============================================================================
 * Tests:
 * 1. Citizen Clarification Loop (Admin Requests -> Citizen Responds -> Review)
 * 2. Multi-Role RBAC & Authorization Invariants (Citizen, Admin, Supervisor, Employee)
 * 3. Supervisor Task Adjudication (Review & Verify, Rework vs Auto-verify Invariants)
 * 4. Central Admin Official Municipal Closure & Invariants
 * 5. Knowledge / SOP Document Management & Re-Indexing Endpoints
 * 6. Public Tracking Redaction & Data Privacy
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
const KnowledgeDocument = require('../models/KnowledgeDocument');
const KnowledgeChunk = require('../models/KnowledgeChunk');

let server;
let port = 5111;
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
  return { status: res.status, ok: res.ok, data: json };
}

async function runPhase11AuditSuite() {
  console.log('\n================================================================');
  console.log('🔍  PHASE 11: APPLICATION AUDIT & ROLE-BASED FUNCTIONAL SUITE');
  console.log('================================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅  MongoDB connected successfully');
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`📡  Audit Test Server running on port ${port}\n`);

    // --- Step 0: Ensure Test Users and Obtain Tokens ---
    const timestamp = Date.now();
    const citizenEmail = `audit_citizen_${timestamp}@example.com`;
    const otherCitizenEmail = `audit_other_${timestamp}@example.com`;

    // 1. Register Primary Citizen
    await apiCall('POST', '/api/auth/register', {
      name: 'R. Soundararajan',
      email: citizenEmail,
      phone: '9840112233',
      ward: 'Ward 102',
      zone: 'Zone 8 (Anna Nagar)',
      password: 'CitizenPassword123!',
    });
    const citizenLogin = await apiCall('POST', '/api/auth/login', {
      email: citizenEmail,
      password: 'CitizenPassword123!',
    });
    const citizenToken = citizenLogin.data?.token;
    const citizenId = citizenLogin.data?.user?.citizenId;

    // 2. Register Secondary Citizen for Isolation Testing
    await apiCall('POST', '/api/auth/register', {
      name: 'M. Kavitha',
      email: otherCitizenEmail,
      phone: '9840223344',
      ward: 'Ward 105',
      zone: 'Zone 8 (Anna Nagar)',
      password: 'CitizenPassword123!',
    });
    const otherLogin = await apiCall('POST', '/api/auth/login', {
      email: otherCitizenEmail,
      password: 'CitizenPassword123!',
    });
    const otherCitizenToken = otherLogin.data?.token;

    // 3. Ensure Staff Accounts Exist
    const roadDept = (await Department.findOne({ name: 'Road Maintenance Department' })) || (await Department.findOne());
    let roadSup = await User.findOne({ email: 'selvam.supervisor@smartcity.gov.in' });
    if (!roadSup) {
      roadSup = await User.create({
        name: 'Er. S. Selvam',
        email: 'selvam.supervisor@smartcity.gov.in',
        passwordHash: 'Supervisor@123',
        role: 'department_supervisor',
        departmentId: roadDept._id,
        departmentName: roadDept.name,
        designation: 'Assistant Executive Engineer',
        phone: '+91 98401 22334',
      });
    }

    let roadEmp = await User.findOne({ email: 'ramesh.field@smartcity.gov.in' });
    if (!roadEmp) {
      roadEmp = await User.create({
        name: 'K. Ramesh',
        email: 'ramesh.field@smartcity.gov.in',
        passwordHash: 'Employee@123',
        role: 'department_employee',
        departmentId: roadDept._id,
        departmentName: roadDept.name,
        designation: 'Road Maintenance Assistant',
        phone: '+91 98401 33445',
        employeeId: 'OFF-1034',
      });
    }

    // 4. Staff Logins
    const adminLogin = await apiCall('POST', '/api/auth/login', {
      email: 'admin.commissioner@smartcity.gov.in',
      password: 'Admin@123',
    });
    const adminToken = adminLogin.data?.token;

    const supLogin = await apiCall('POST', '/api/auth/login', {
      email: 'selvam.supervisor@smartcity.gov.in',
      password: 'Supervisor@123',
    });
    const supervisorToken = supLogin.data?.token;

    const empLogin = await apiCall('POST', '/api/auth/login', {
      email: 'ramesh.field@smartcity.gov.in',
      password: 'Employee@123',
    });
    const employeeToken = empLogin.data?.token;
    const employeeId = empLogin.data?.user?.employeeId || roadEmp.employeeId || 'OFF-1034';

    record(
      'AUDIT-00',
      'Multi-Role Authentication Handshake Successful',
      Boolean(citizenToken && otherCitizenToken && adminToken && supervisorToken && employeeToken),
      'Tokens acquired for citizen, secondary citizen, central_admin, supervisor, and employee.'
    );

    // =========================================================================
    // SECTION 1: CITIZEN CLARIFICATION WORKFLOW AUDIT
    // =========================================================================
    console.log('\n--- Section 1: Clarification Workflow & Lifecycle Invariants ---');

    // 1. Citizen submits a grievance
    const complaintRes = await apiCall(
      'POST',
      '/api/complaints',
      {
        title: 'Road damage near intersection requiring clarification testing',
        category: 'Pothole',
        description: 'Deep dangerous pothole near signal requiring immediate road patch work and clarification validation.',
        language: 'en',
        location: {
          address: 'North Usman Road, T. Nagar, Chennai',
          ward: 'Ward 102',
          zone: 'Zone 8 (Anna Nagar)',
          latitude: 13.0418,
          longitude: 80.2341,
        },
        priority: 'HIGH',
      },
      citizenToken
    );

    const complaint = complaintRes.data?.data;
    const complaintId = complaint?.complaintId;

    // Wait for async background AI pipeline
    await new Promise((r) => setTimeout(r, 2500));

    // 2. Central Admin requests clarification
    const clarReqRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/approve`,
      {
        action: 'request_clarification',
        adminNotes: 'Please provide landmark details and approximate depth of the pothole.',
      },
      adminToken
    );

    const checkClarState = await apiCall('GET', `/api/complaints/${complaintId}`, null, citizenToken);
    const clarComplaint = checkClarState.data?.data;
    const isClarState =
      clarComplaint?.status === 'CLARIFICATION_REQUIRED' &&
      clarComplaint?.adminApproval?.status === 'clarification_required';

    record(
      'AUDIT-01',
      'Central Admin Can Request Clarification on Complaint',
      clarReqRes.status === 200 && isClarState,
      `Complaint ${complaintId} entered CLARIFICATION_REQUIRED state. Reason: "${clarComplaint?.adminApproval?.adminNotes}"`
    );

    // 3. Unauthorized access checks on clarification endpoint
    const unauthClarRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/clarification`,
      { clarificationText: 'Unauthenticated attempt at providing notes' },
      null
    );
    record(
      'AUDIT-02',
      'Unauthenticated Citizen Blocked from Clarification Submission (HTTP 401)',
      unauthClarRes.status === 401,
      `Status: ${unauthClarRes.status}, Message: "${unauthClarRes.data?.message}"`
    );

    const wrongCitizenClarRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/clarification`,
      { clarificationText: 'Attempting to clarify someone elses ticket' },
      otherCitizenToken
    );
    record(
      'AUDIT-03',
      'Cross-Citizen Clarification Submission Blocked (HTTP 403)',
      wrongCitizenClarRes.status === 403,
      `Status: ${wrongCitizenClarRes.status}, Message: "${wrongCitizenClarRes.data?.message}"`
    );

    // 4. Authorized Citizen submits clarification response
    const validClarRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/clarification`,
      {
        clarificationText: 'Opposite to Saravana Stores, depth is roughly 8 inches with exposed ballast.',
        additionalImageUrls: ['https://example.com/pothole-depth-evidence.jpg'],
      },
      citizenToken
    );

    const postClarCheck = await apiCall('GET', `/api/complaints/${complaintId}`, null, adminToken);
    const postClarComplaint = postClarCheck.data?.data;
    const returnedToReview =
      postClarComplaint?.status === 'AWAITING_ADMIN_REVIEW' &&
      postClarComplaint?.clarificationResponse?.responseNotes?.includes('Saravana Stores');

    record(
      'AUDIT-04',
      'Citizen Successfully Submits Clarification & Returns Complaint to Admin Review',
      validClarRes.status === 200 && returnedToReview,
      `Status: ${postClarComplaint?.status}, Approval State: ${postClarComplaint?.adminApproval?.status}, Notes: "${postClarComplaint?.clarificationResponse?.responseNotes}"`
    );

    // 5. Invariant: Submitting clarification when complaint is NOT in CLARIFICATION_REQUIRED fails (400)
    const invalidStateClarRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/clarification`,
      { clarificationText: 'Attempting clarification when already returned to review' },
      citizenToken
    );
    record(
      'AUDIT-05',
      'Clarification Submission Blocked in Non-Clarification State (HTTP 400)',
      invalidStateClarRes.status === 400,
      `Status: ${invalidStateClarRes.status}, Message: "${invalidStateClarRes.data?.message}"`
    );

    // =========================================================================
    // SECTION 2: END-TO-END WORKFLOW, SUPERVISOR VERIFICATION & CLOSURE
    // =========================================================================
    console.log('\n--- Section 2: Task Progression, Supervisor Adjudication & Official Closure ---');

    // Admin approves complaint and spawns task
    const approveRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/approve`,
      {
        action: 'approve',
        adminNotes: 'Clarification reviewed and approved for immediate patching.',
        primaryDepartment: {
          departmentName: 'Road Maintenance Department',
          description: 'Pothole asphalt compaction and road resurfacing.',
        },
        priority: 'HIGH',
      },
      adminToken
    );

    // Supervisor assigns task to employee
    const taskListRes = await apiCall('GET', `/api/complaints/${complaintId}/tasks`, null, adminToken);
    const taskId = taskListRes.data?.data?.[0]?.taskId;

    await apiCall(
      'PATCH',
      `/api/tasks/${taskId}/assign`,
      {
        employeeName: 'K. Ramesh',
        assignedEmployeeId: employeeId,
        instructions: 'Repair pothole using cold-mix bitumen with proper compaction.',
      },
      supervisorToken
    );

    // Employee accepts and submits resolution
    await apiCall('PATCH', `/api/tasks/${taskId}/status`, { status: 'IN_PROGRESS' }, employeeToken);

    const submitRes = await apiCall(
      'POST',
      `/api/tasks/${taskId}/resolution`,
      {
        resolutionNotes: 'Square-cut pothole cavity, cleared debris, applied tack coat, filled with asphalt mix and rolled with compactor.',
        evidenceUrls: ['https://example.com/road-fixed-before.jpg', 'https://example.com/road-fixed-after.jpg'],
      },
      employeeToken
    );

    // Check task status is AWAITING_REVIEW (never auto-verified)
    const taskAfterSubmit = await apiCall('GET', `/api/tasks/${taskId}`, null, supervisorToken);
    const taskObj = taskAfterSubmit.data?.data?.task;
    const awaitingReview = taskObj?.status === 'AWAITING_REVIEW';
    const rec = submitRes.data?.data?.verification?.recommendation;
    const score = Math.round((submitRes.data?.data?.verification?.verificationScore || 0) * 100);

    record(
      'AUDIT-06',
      'Resolution Submission Enters AWAITING_REVIEW (Automated Engine Advisory Only)',
      awaitingReview && rec === 'APPROVE_RECOMMENDED',
      `Task status: ${taskObj?.status}, Score: ${score}%, Rec: "${rec}"`
    );

    // Invariant: Premature closure blocked while task is unverified
    const prematureCloseRes = await apiCall('POST', `/api/complaints/${complaintId}/close`, {}, adminToken);
    record(
      'AUDIT-07',
      'Central Admin Closure Blocked While Task Remains Unverified (HTTP 400)',
      prematureCloseRes.status === 400,
      `Status: ${prematureCloseRes.status}, Error: "${prematureCloseRes.data?.message}"`
    );

    // Supervisor verifies task
    const verifyRes = await apiCall(
      'POST',
      `/api/tasks/${taskId}/verify`,
      {
        action: 'approve',
        comments: 'High quality compaction observed in evidence photo. Work approved.',
      },
      supervisorToken
    );

    const verifiedCheck = await apiCall('GET', `/api/tasks/${taskId}`, null, supervisorToken);
    const parentComplaintCheck = await apiCall('GET', `/api/complaints/${complaintId}`, null, adminToken);

    record(
      'AUDIT-08',
      'Supervisor Officially Verifies Task & Parent Complaint Advances to RESOLVED',
      verifyRes.status === 200 &&
        verifiedCheck.data?.data?.task?.status === 'VERIFIED' &&
        parentComplaintCheck.data?.data?.status === 'RESOLVED',
      `Task Status: ${verifiedCheck.data?.data?.task?.status}, Parent Complaint Status: ${parentComplaintCheck.data?.data?.status}`
    );

    // RBAC: Employee cannot execute official municipal closure
    const empCloseRes = await apiCall('POST', `/api/complaints/${complaintId}/close`, {}, employeeToken);
    record(
      'AUDIT-09',
      'Employee Blocked from Performing Municipal Complaint Closure (HTTP 403)',
      empCloseRes.status === 403,
      `Status: ${empCloseRes.status}`
    );

    // Central Admin performs official municipal closure
    const adminCloseRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/close`,
      { remarks: 'All repairs inspected, verified by department supervisor, ticket officially closed.' },
      adminToken
    );

    const finalComplaintCheck = await apiCall('GET', `/api/complaints/${complaintId}`, null, citizenToken);
    const isOfficiallyClosed =
      finalComplaintCheck.data?.data?.status === 'CLOSED' &&
      Boolean(finalComplaintCheck.data?.data?.closedAt);

    record(
      'AUDIT-10',
      'Central Admin Executes Official Municipal Complaint Closure (CLOSED)',
      adminCloseRes.status === 200 && isOfficiallyClosed,
      `Final Status: ${finalComplaintCheck.data?.data?.status}, Closed At: ${finalComplaintCheck.data?.data?.closedAt}`
    );

    // =========================================================================
    // SECTION 3: KNOWLEDGE & SOP MANAGEMENT AUDIT
    // =========================================================================
    console.log('\n--- Section 3: Knowledge / SOP Management & Re-Indexing Endpoints ---');

    // Central Admin retrieves knowledge documents
    const listDocsRes = await apiCall('GET', '/api/knowledge', null, adminToken);
    record(
      'AUDIT-11',
      'Central Admin Can Retrieve Full Municipal Knowledge & SOP Document Catalog',
      listDocsRes.status === 200 && Array.isArray(listDocsRes.data?.data),
      `Total Documents Retrieved: ${listDocsRes.data?.data?.length}`
    );

    // Central Admin triggers atomic re-chunking
    const rechunkRes = await apiCall('POST', '/api/knowledge/rechunk-all', {}, adminToken);
    record(
      'AUDIT-12',
      'Central Admin Can Trigger Full Atomic Re-Chunking Across Knowledge Base',
      rechunkRes.status === 200 && rechunkRes.data?.data?.documentsProcessed >= 0,
      `Re-chunked: ${rechunkRes.data?.data?.documentsProcessed} documents, Total Chunks: ${rechunkRes.data?.data?.totalChunksCreated}`
    );

    // RBAC: Citizen cannot trigger re-chunking
    const citizenRechunkRes = await apiCall('POST', '/api/knowledge/rechunk-all', {}, citizenToken);
    record(
      'AUDIT-13',
      'Citizen Denied Access to Knowledge Administration APIs (HTTP 403)',
      citizenRechunkRes.status === 403,
      `Status: ${citizenRechunkRes.status}`
    );

    // =========================================================================
    // SECTION 4: PRIVACY & SENSITIVE DATA REDACTION AUDIT
    // =========================================================================
    console.log('\n--- Section 4: Public Tracking & Data Privacy Redaction ---');

    const publicTrackRes = await apiCall('GET', `/api/complaints/${complaintId}`);
    const pubTasksRes = await apiCall('GET', `/api/complaints/${complaintId}/tasks`);
    const pubTasks = pubTasksRes.data?.data || [];

    const hasInternalScores = pubTasks.some((t) => t.resolution?.automatedAssessment !== undefined || t.resolution?.rubric !== undefined);
    const hasEmployeeStaffId = pubTasks.some((t) => t.assignedEmployeeId !== undefined && t.assignedEmployeeId !== null);
    const hasDelayRisk = pubTasks.some((t) => t.delayRisk !== undefined);

    record(
      'AUDIT-14',
      'Public Complaint Tracking Redacts Staff IDs & Internal Risk Assessment Rubrics',
      publicTrackRes.status === 200 && !hasInternalScores && !hasEmployeeStaffId && !hasDelayRisk,
      `Public status: ${publicTrackRes.status}, Internal scores redacted: ${!hasInternalScores}, Staff IDs hidden: ${!hasEmployeeStaffId}, Delay risk hidden: ${!hasDelayRisk}`
    );

    // Citizen feedback after closure
    const feedbackRes = await apiCall(
      'POST',
      `/api/complaints/${complaintId}/feedback`,
      {
        rating: 5,
        comments: 'Prompt response and excellent asphalt repair quality. Thank you!',
      },
      citizenToken
    );

    record(
      'AUDIT-15',
      'Citizen Can Provide Feedback on Closed Complaint',
      feedbackRes.status === 200,
      `Status: ${feedbackRes.status}, Message: "${feedbackRes.data?.message}"`
    );

    // --- Cleanup test records safely ---
    console.log('\n--- Cleaning Up Audit Test Records ---');
    await ComplaintTask.deleteMany({ complaintId });
    await Complaint.deleteOne({ complaintId });
    await WorkflowEvent.deleteMany({ complaintId });
    await Citizen.deleteOne({ email: citizenEmail });
    await Citizen.deleteOne({ email: otherCitizenEmail });
    await User.deleteOne({ email: citizenEmail });
    await User.deleteOne({ email: otherCitizenEmail });
    console.log('✅ Temporary audit test records cleaned up safely.');

  } catch (err) {
    console.error('❌ Phase 11 Audit Error:', err);
  } finally {
    if (server) {
      server.close();
      console.log('🛑  Audit Test Server stopped.');
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('📦 Database connection closed.');
    }
  }

  // Summary
  console.log('\n================================================================');
  console.log('📊  PHASE 11 AUDIT & FUNCTIONAL VERIFICATION SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL 15 PHASE 11 AUDIT CHECKS PASSED PERFECTLY!\n');
  } else {
    console.log(`\n⚠️  ${failed} check(s) failed in Phase 11 audit.\n`);
  }
}

runPhase11AuditSuite();
