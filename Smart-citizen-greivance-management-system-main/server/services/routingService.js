'use strict';

/**
 * Routing Service (M6 – Context-Aware Department Recommendation)
 * ─────────────────────────────────────────────────────────────────────────────
 * Recommends primary and supporting municipal departments based on:
 * - Category and subcategory jurisdiction mapping.
 * - Multi-department cross-cutting analysis (compound civic faults).
 * - Real-time department workload and active capacity.
 *
 * Guarantees:
 * - Strict human-in-the-loop: returns recommendations for Central Admin review.
 * - Never directly bypasses administrative approval or auto-assigns employees.
 * - If no active department is found, leaves recommendation UNRESOLVED for Central Admin.
 * - Does NOT assign an unrelated fallback department to unmapped or missing categories.
 * - Clearly explains why each primary or supporting department is recommended.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const Department = require('../models/Department');
const ComplaintTask = require('../models/ComplaintTask');
const { CATEGORY_DEPARTMENT_MAP } = require('./categorizationService');

/**
 * Identify genuine multi-department cross-cutting requirements.
 * @param {string} category - Primary complaint category
 * @param {string} text - Complaint description
 * @returns {Array<{ departmentName: string, reason: string }>}
 */
function identifySupportingDepartments(category, text) {
  const lower = (text || '').toLowerCase();
  const supporting = [];

  // Scenario 1: Road damage / pothole caused by or coupled with water pipeline leak
  if (category === 'Pothole' && (lower.includes('water') || lower.includes('pipe') || lower.includes('leak') || lower.includes('thanni'))) {
    supporting.push({
      departmentName: 'Water & Sewerage Board',
      reason: 'Underground water pipeline leak must be sealed and pressure-tested before permanent road asphalt resurfacing.',
    });
  }

  // Scenario 2: Fallen tree entangled with electric wires or lighting pole
  if (category === 'Tree Fall' && (lower.includes('wire') || lower.includes('electric') || lower.includes('pole') || lower.includes('light') || lower.includes('spark'))) {
    supporting.push({
      departmentName: 'Electricity & Lighting Department',
      reason: 'Electrical power lines entangled with tree branches require power isolation and line restoration.',
    });
  }

  // Scenario 3: Drainage / sewage overflow flooding into major traffic lane
  if (category === 'Drainage' && (lower.includes('road damage') || lower.includes('traffic') || lower.includes('congestion') || lower.includes('asphalt'))) {
    supporting.push({
      departmentName: 'Road Maintenance Department',
      reason: 'Road pavement restoration required after stagnant sewage extraction and desilting.',
    });
  }

  // Scenario 4: Water pipeline burst eroding road pavement
  if (category === 'Water Supply' && (lower.includes('road broken') || lower.includes('asphalt') || lower.includes('crater') || lower.includes('huge hole'))) {
    supporting.push({
      departmentName: 'Road Maintenance Department',
      reason: 'Road repair team required to fill roadway crater caused by high-pressure pipeline burst.',
    });
  }

  // Scenario 5: Garbage dump blocking drainage canal
  if (category === 'Garbage' && (lower.includes('drain') || lower.includes('canal') || lower.includes('gutter') || lower.includes('sewage'))) {
    supporting.push({
      departmentName: 'Water & Sewerage Board',
      reason: 'Stormwater drain inlet cleared of solid waste must be desilted to restore water flow.',
    });
  }

  // Scenario 6: Illegal construction encroaching on public road or pavement
  if (category === 'Illegal Construction' && (lower.includes('footpath') || lower.includes('road') || lower.includes('lane') || lower.includes('salai'))) {
    supporting.push({
      departmentName: 'Road Maintenance Department',
      reason: 'Clearance of unauthorized structure debris and pavement reconstruction after municipal enforcement.',
    });
  }

  return supporting;
}

/**
 * Recommend primary and supporting departments for a complaint.
 *
 * @param {string} category - Categorized civic issue
 * @param {string} text - Complaint description
 * @param {object} options - Optional context (subcategory, location)
 * @returns {Promise<object>} Recommendation payload for Central Admin
 */
async function recommendDepartments(category, text, options = {}) {
  // If category is Other or undefined, do NOT force an unrelated department!
  const primaryDeptName = (category && category !== 'Other')
    ? (CATEGORY_DEPARTMENT_MAP[category] || null)
    : null;

  let primaryDeptDoc = null;
  let isPrimaryActive = false;
  const isDbReady = mongoose.connection.readyState === 1;

  if (isDbReady && primaryDeptName) {
    try {
      primaryDeptDoc = await Department.findOne({ name: primaryDeptName });
      isPrimaryActive = Boolean(primaryDeptDoc && primaryDeptDoc.active !== false);
    } catch (err) {
      console.warn(`[routingService] Department lookup error for "${primaryDeptName}":`, err.message);
    }
  }

  // If department cannot be identified or is inactive in the database:
  // Leave recommendation unresolved and flag for Central Admin review (do NOT guess an unrelated fallback department!)
  if (!primaryDeptName || !primaryDeptDoc || !isPrimaryActive) {
    const unresolvedReason = !primaryDeptName
      ? `Complaint category "${category || 'Other'}" has no standard departmental mapping. Recommendation left unresolved for Central Admin review.`
      : `Mapped department "${primaryDeptName}" is inactive or missing from the database. Recommendation left unresolved for Central Admin review.`;

    return {
      status: 'unresolved',
      method: 'context_aware_rules',
      primaryDepartment: {
        departmentId: null,
        departmentName: null,
        reason: unresolvedReason,
        isActive: false,
        workloadCount: 0,
      },
      supportingDepartments: [],
      requiresMultiDept: false,
      needsAdminReview: true,
      recommendationSummary: `Department routing unresolved. Central Admin manual department assignment required.`,
    };
  }

  // Check department workload
  let primaryWorkloadCount = 0;
  if (isDbReady && primaryDeptDoc) {
    try {
      primaryWorkloadCount = await ComplaintTask.countDocuments({
        departmentId: primaryDeptDoc._id,
        status: { $in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS'] },
      });
    } catch (_) {
      primaryWorkloadCount = 0;
    }
  }

  // Identify supporting departments based on context
  const potentialSupporting = identifySupportingDepartments(category, text);
  const resolvedSupporting = [];

  for (const s of potentialSupporting) {
    if (s.departmentName === primaryDeptName) continue;

    let suppDeptDoc = null;
    if (isDbReady) {
      try {
        suppDeptDoc = await Department.findOne({ name: s.departmentName });
      } catch (_) {}
    }

    // Only include if department exists and is active
    if (suppDeptDoc && suppDeptDoc.active !== false) {
      resolvedSupporting.push({
        departmentId: suppDeptDoc._id,
        departmentName: s.departmentName,
        reason: s.reason,
        isActive: true,
      });
    }
  }

  const needsAdminReview = resolvedSupporting.length > 0;
  const routingReason = `Jurisdictional match for ${category}. Current active department task queue: ${primaryWorkloadCount}.`;

  return {
    status: 'recommended',
    method: 'context_aware_rules',
    primaryDepartment: {
      departmentId: primaryDeptDoc._id,
      departmentName: primaryDeptDoc.name,
      reason: routingReason,
      isActive: true,
      workloadCount: primaryWorkloadCount,
    },
    supportingDepartments: resolvedSupporting,
    requiresMultiDept: resolvedSupporting.length > 0,
    needsAdminReview,
    recommendationSummary: resolvedSupporting.length > 0
      ? `Multi-department response recommended: Primary [${primaryDeptDoc.name}] + Supporting [${resolvedSupporting.map((s) => s.departmentName).join(', ')}]. Awaiting Central Admin approval.`
      : `Primary department [${primaryDeptDoc.name}] recommended for direct resolution. Awaiting Central Admin approval.`,
  };
}

/**
 * Backward compatibility wrapper for existing callers.
 * Returns single routing object matching legacy contract.
 */
async function routeComplaint(category, text = '', options = {}) {
  const rec = await recommendDepartments(category, text, options);
  return {
    status: rec.status === 'unresolved' ? 'unresolved' : 'completed',
    departmentId: rec.primaryDepartment.departmentId,
    departmentName: rec.primaryDepartment.departmentName,
    routingReason: rec.primaryDepartment.reason,
    supportingDepartments: rec.supportingDepartments,
    requiresMultiDept: rec.requiresMultiDept,
    needsAdminReview: rec.needsAdminReview,
  };
}

module.exports = {
  recommendDepartments,
  routeComplaint,
  identifySupportingDepartments,
};
