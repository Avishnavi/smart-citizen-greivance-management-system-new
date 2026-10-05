'use strict';

/**
 * Recurring Issue Detection Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research contribution: Proactive Recurring-Issue Detection using
 * Location + Category + Time clustering.
 *
 * Current state: Haversine-based spatial + temporal cluster detection.
 * Integration point: Replace with DBSCAN/k-means clustering when ML layer added.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RecurringIssue = require('../models/RecurringIssue');
const Complaint = require('../models/Complaint');
const { haversineDistance } = require('./duplicateDetectionService');

const CLUSTER_RADIUS_METERS = 600;
const MIN_OCCURRENCES_FOR_PATTERN = 3;
const TIME_WINDOW_DAYS = 30;

/**
 * Detect recurring issues by clustering new complaint against existing ones.
 * Called after every new complaint is submitted.
 *
 * @param {object} newComplaint - New Complaint document
 * @returns {Promise<object|null>} RecurringIssue document if pattern found
 */
async function detectRecurringIssue(newComplaint) {
  const timeWindowStart = new Date();
  timeWindowStart.setDate(timeWindowStart.getDate() - TIME_WINDOW_DAYS);

  // Find recent complaints in the same category and ward
  const recentSimilar = await Complaint.find({
    category: newComplaint.category,
    'location.ward': newComplaint.location.ward,
    createdAt: { $gte: timeWindowStart },
    complaintId: { $ne: newComplaint.complaintId },
    status: { $nin: ['CLOSED', 'REJECTED'] },
  });

  // Filter by geographic proximity
  const nearby = recentSimilar.filter((c) => {
    const dist = haversineDistance(
      newComplaint.location.latitude,
      newComplaint.location.longitude,
      c.location.latitude,
      c.location.longitude
    );
    return dist <= CLUSTER_RADIUS_METERS;
  });

  if (nearby.length + 1 < MIN_OCCURRENCES_FOR_PATTERN) {
    return null; // Not enough occurrences to form a pattern
  }

  // Calculate cluster center
  const allInCluster = [newComplaint, ...nearby];
  const avgLat = allInCluster.reduce((s, c) => s + c.location.latitude, 0) / allInCluster.length;
  const avgLng = allInCluster.reduce((s, c) => s + c.location.longitude, 0) / allInCluster.length;

  const complaintIds = allInCluster.map((c) => c.complaintId);
  const occurrenceCount = allInCluster.length;

  const severity =
    occurrenceCount >= 8 ? 'CRITICAL'
    : occurrenceCount >= 5 ? 'HIGH'
    : occurrenceCount >= 3 ? 'MEDIUM'
    : 'LOW';

  const patternDescription =
    `${occurrenceCount} complaints of category "${newComplaint.category}" reported ` +
    `within ${CLUSTER_RADIUS_METERS}m radius in ${newComplaint.location.ward} ` +
    `over the past ${TIME_WINDOW_DAYS} days. Recurring infrastructure issue suspected.`;

  // Upsert recurring issue document
  const recurringIssue = await RecurringIssue.findOneAndUpdate(
    {
      category: newComplaint.category,
      ward: newComplaint.location.ward,
      status: { $in: ['active', 'under_review'] },
    },
    {
      $set: {
        category: newComplaint.category,
        ward: newComplaint.location.ward,
        zone: newComplaint.location.zone || '',
        centerLatitude: avgLat,
        centerLongitude: avgLng,
        occurrenceCount,
        lastReportedAt: new Date(),
        patternDescription,
        severity,
        status: 'active',
      },
      $addToSet: { complaintIds: { $each: complaintIds } },
      $setOnInsert: { firstReportedAt: new Date() },
    },
    { upsert: true, new: true }
  );

  return recurringIssue;
}

/**
 * Get active recurring issues for dashboard.
 */
async function getActiveRecurringIssues(limit = 10) {
  return RecurringIssue.find({ status: { $in: ['active', 'under_review'] } })
    .sort({ severity: -1, occurrenceCount: -1 })
    .limit(limit);
}

module.exports = { detectRecurringIssue, getActiveRecurringIssues };
