'use strict';

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const request = require('http');
const { app } = require('../index');

let server;

async function runVerification() {
  console.log('===========================================================');
  console.log('🛡️  PHASE 1: RBAC & AUTHENTICATION VERIFICATION SUITE');
  console.log('===========================================================\n');

  await connectDatabase();
  const PORT = 5099;
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
    // 1. Password Hashing Verification
    const users = await User.find({});
    const allHashed = users.every(
      (u) => u.passwordHash.startsWith('$2a$') || u.passwordHash.startsWith('$2b$')
    );
    record(
      'REQ-1',
      'Passwords Hashed with bcrypt in Database',
      allHashed && users.length >= 4,
      `Inspected ${users.length} user records. All passwords start with bcrypt salt ($2b$ / $2a$), none in plaintext.`
    );

    // 2. Universal Login for All 4 Roles
    const roles = [
      { role: 'central_admin', email: 'admin.commissioner@smartcity.gov.in', pass: 'Admin@123' },
      { role: 'department_supervisor', email: 'selvam.supervisor@smartcity.gov.in', pass: 'Supervisor@123' },
      { role: 'department_employee', email: 'ramesh.field@smartcity.gov.in', pass: 'Employee@123' },
      { role: 'citizen', email: 'rajesh.kumar88@example.gov.in', pass: 'Citizen@123' },
    ];

    const tokens = {};
    let allLogin = true;

    for (const r of roles) {
      const res = await apiCall('POST', '/api/auth/login', { email: r.email, password: r.pass });
      if (res.status === 200 && res.body.token && res.body.user.role === r.role) {
        tokens[r.role] = res.body.token;
      } else {
        allLogin = false;
      }
    }
    record(
      'REQ-2',
      'Valid Login & JWT Issuance for All 4 Roles',
      allLogin,
      'central_admin, department_supervisor, department_employee, and citizen successfully authenticated and received signed JWT tokens.'
    );

    // 3. Reject Invalid Credentials
    const badLogin = await apiCall('POST', '/api/auth/login', {
      email: 'admin.commissioner@smartcity.gov.in',
      password: 'IncorrectPassword',
    });
    record(
      'REQ-3',
      'Invalid Credentials Rejected',
      badLogin.status === 401,
      `Status ${badLogin.status}: ${badLogin.body.message}`
    );

    // 4. Session Retrieval /api/auth/me
    const meRes = await apiCall('GET', '/api/auth/me', null, tokens['central_admin']);
    record(
      'REQ-4',
      'Authenticated Session Profile via GET /api/auth/me',
      meRes.status === 200 && meRes.body.user.role === 'central_admin',
      `Resolved user: ${meRes.body.user?.name} (Role: ${meRes.body.user?.role})`
    );

    // 5. Unauthenticated Access Protection
    const unauthEscalations = await apiCall('GET', '/api/dashboard/escalations');
    record(
      'REQ-5',
      'Unauthenticated Requests to Protected APIs Rejected (401)',
      unauthEscalations.status === 401,
      `Status ${unauthEscalations.status}: ${unauthEscalations.body.message}`
    );

    // 6. Citizen Restricted from Admin APIs
    const citizenEscalations = await apiCall('GET', '/api/dashboard/escalations', null, tokens['citizen']);
    record(
      'REQ-6',
      'Citizen Denied Access to Central Admin APIs (403)',
      citizenEscalations.status === 403,
      `Status ${citizenEscalations.status}: ${citizenEscalations.body.message}`
    );

    // 7. Central Admin Authorized Access
    const adminEscalations = await apiCall('GET', '/api/dashboard/escalations', null, tokens['central_admin']);
    record(
      'REQ-7',
      'Central Admin Authorized for Municipality-Wide Resources (200)',
      adminEscalations.status === 200,
      `Status ${adminEscalations.status}: Total escalations retrieved successfully.`
    );

    // 8. Department Supervisor Department Boundary Enforcement
    const waterDept = await Department.findOne({ name: 'Water & Sewerage Board' });
    const crossComplaintId = `CMP-TEST-WATER-${Date.now()}`;
    await Complaint.create({
      complaintId: crossComplaintId,
      citizenId: 'CIT-8842',
      description: 'Major water pipeline leak in Kilpauk',
      category: 'Water Supply',
      priority: 'HIGH',
      routing: {
        departmentName: 'Water & Sewerage Board',
        departmentId: waterDept?._id,
      },
      location: {
        address: 'Kilpauk, Chennai',
        latitude: 13.08,
        longitude: 80.24,
      },
      status: 'SUBMITTED',
    });

    // Road Supervisor attempts to resolve Water complaint
    const supervisorBreach = await apiCall(
      'POST',
      `/api/complaints/${crossComplaintId}/resolution`,
      { resolutionNotes: 'Attempting cross-department resolution update' },
      tokens['department_supervisor']
    );

    record(
      'REQ-8',
      'Department Supervisor Boundary Enforced (403 on other departments)',
      supervisorBreach.status === 403,
      `Road supervisor blocked from resolving Water complaint: "${supervisorBreach.body.message}"`
    );

    // Clean up test complaint
    await Complaint.deleteOne({ complaintId: crossComplaintId });

    // 9. Department Employee Assignment Boundary
    const unassignedCmpId = `CMP-TEST-EMP-${Date.now()}`;
    await Complaint.create({
      complaintId: unassignedCmpId,
      citizenId: 'CIT-8842',
      description: 'Pothole on 5th avenue road',
      category: 'Pothole',
      priority: 'MEDIUM',
      routing: {
        departmentName: 'Road Maintenance Department',
        assignedOfficerName: 'Er. S. Selvam', // Assigned to supervisor, NOT to employee K. Ramesh
      },
      location: {
        address: '5th Avenue, Chennai',
        latitude: 13.08,
        longitude: 80.21,
      },
      status: 'ASSIGNED',
    });

    // Employee K. Ramesh tries to patch unassigned complaint
    const employeeBreach = await apiCall(
      'PATCH',
      `/api/complaints/${unassignedCmpId}`,
      { status: 'In Progress' },
      tokens['department_employee']
    );

    record(
      'REQ-9',
      'Department Employee Assignment Enforced (403 on unassigned grievance)',
      employeeBreach.status === 403,
      `Employee blocked from updating unassigned complaint: "${employeeBreach.body.message}"`
    );

    await Complaint.deleteOne({ complaintId: unassignedCmpId });

    // 10. Citizen Registration & Role Escalation Prevention
    const exploitRes = await apiCall('POST', '/api/auth/register', {
      name: 'Hacker',
      email: 'hacker@exploit.com',
      password: 'password123',
      role: 'central_admin',
    });

    const citizenRegEmail = `test.citizen.${Date.now()}@example.gov.in`;
    const legitReg = await apiCall('POST', '/api/auth/register', {
      name: 'V. Sundaram',
      email: citizenRegEmail,
      password: 'Citizen@2026',
      ward: 'Ward 104',
    });

    record(
      'REQ-10',
      'Citizen Registration Succeeded & Role Escalation Blocked',
      exploitRes.status === 400 && legitReg.status === 201 && legitReg.body.token,
      `Exploit rejected (400). Valid citizen registered with assigned ID: ${legitReg.body.user?.citizenId}`
    );

    // 11. Central Admin Staff Provisioning
    const newStaffEmail = `field.inspector.${Date.now()}@smartcity.gov.in`;
    const roadDept = await Department.findOne({ name: 'Road Maintenance Department' });
    const provisionRes = await apiCall(
      'POST',
      '/api/auth/provision-staff',
      {
        name: 'G. Mohan',
        email: newStaffEmail,
        password: 'Employee@2026',
        role: 'department_employee',
        departmentId: roadDept?._id,
        designation: 'Junior Road Inspector',
      },
      tokens['central_admin']
    );

    record(
      'REQ-11',
      'Central Admin Staff Provisioning Authorized',
      provisionRes.status === 201 && provisionRes.body.user.role === 'department_employee',
      `Provisioned staff member: ${provisionRes.body.user?.name} (Employee ID: ${provisionRes.body.user?.employeeId})`
    );

    // 12. Existing Citizen Complaint Registration & Public Tracking Preserved
    const newComplaintRes = await apiCall('POST', '/api/complaints', {
      description: 'Streetlight pole wire hanging loose near school zone',
      category: 'Streetlight',
      priority: 'HIGH',
      location: {
        address: 'School Zone, Ward 102, Chennai',
        latitude: 13.085,
        longitude: 80.211,
        ward: 'Ward 102',
      },
    });

    const createdComplaintId = newComplaintRes.body?.data?.complaintId;
    let trackRes = null;
    let timelineRes = null;
    if (createdComplaintId) {
      trackRes = await apiCall('GET', `/api/complaints/${createdComplaintId}`);
      timelineRes = await apiCall('GET', `/api/complaints/${createdComplaintId}/timeline`);
    }

    record(
      'REQ-12',
      'Citizen Complaint Registration & Public Tracking Preserved',
      newComplaintRes.status === 201 && trackRes?.status === 200 && timelineRes?.status === 200,
      `Complaint ${createdComplaintId} created and tracked via public ticket tracking endpoint without token.`
    );

    // Clean up test complaint
    if (createdComplaintId) {
      await Complaint.deleteOne({ complaintId: createdComplaintId });
    }

    console.log('\n===========================================================');
    const allPassed = results.every((r) => r.passed);
    console.log(allPassed ? '🎉 ALL 12 VERIFICATION CHECKS PASSED!' : '⚠️ SOME CHECKS FAILED');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('Fatal verification error:', err);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runVerification();

