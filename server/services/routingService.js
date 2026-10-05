'use strict';

/**
 * Routing Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes a complaint to the appropriate department and officer.
 * Uses deterministic category→department mapping.
 * Integration point: Add ML-based routing for multi-department complaints.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Department = require('../models/Department');
const Officer = require('../models/Officer');
const { CATEGORY_DEPARTMENT_MAP } = require('./categorizationService');

/**
 * Find the best department for a given complaint category.
 * @param {string} category
 * @returns {Promise<object|null>} Department document or null
 */
async function findDepartmentForCategory(category) {
  const deptName = CATEGORY_DEPARTMENT_MAP[category] || CATEGORY_DEPARTMENT_MAP['Other'];
  const dept = await Department.findOne({ name: deptName, active: true });
  return dept;
}

/**
 * Find the least-loaded officer in a department.
 * @param {mongoose.Types.ObjectId} departmentId
 * @returns {Promise<object|null>} Officer document or null
 */
async function findAvailableOfficer(departmentId) {
  const officer = await Officer.findOne({ departmentId, active: true })
    .sort({ activeComplaintCount: 1 }) // Least loaded first
    .limit(1);
  return officer;
}

/**
 * Route a complaint: find department, find officer, return routing info.
 * @param {string} category
 * @returns {Promise<object>} Routing result
 */
async function routeComplaint(category) {
  const dept = await findDepartmentForCategory(category);

  if (!dept) {
    return {
      status: 'pending',
      departmentId: null,
      departmentName: CATEGORY_DEPARTMENT_MAP[category] || 'Public Health & Sanitation',
      assignedOfficerId: null,
      assignedOfficerName: 'Unassigned',
      routingReason: `Department for "${category}" not found in database. Routing pending.`,
    };
  }

  const officer = await findAvailableOfficer(dept._id);

  // Increment active complaint count for selected officer
  if (officer) {
    await Officer.findByIdAndUpdate(officer._id, { $inc: { activeComplaintCount: 1 } });
  }

  return {
    status: 'completed',
    departmentId: dept._id,
    departmentName: dept.name,
    assignedOfficerId: officer?._id || null,
    assignedOfficerName: officer?.name || 'Unassigned — Queued for next available officer',
    routingReason: `Auto-routed based on category "${category}" → department mapping.`,
  };
}

module.exports = { routeComplaint, findDepartmentForCategory, findAvailableOfficer };
