'use strict';

/**
 * Recurring Issue and Hotspot Detection Service (Module 11)
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects recurring civic problems and geographical hotspots using:
 *  - Density-Based Spatial Clustering (DBSCAN) with Haversine distance.
 *  - Category-adapted spatial radius (epsilon).
 *  - Configurable observation windows (7, 30, 90 days).
 *  - Configurable occurrence thresholds (default: >= 3 complaints).
 *  - Temporal trend classification (INCREASING, DECREASING, STABLE, INSUFFICIENT_DATA).
 *  - Comprehensive hotspot lifecycle management (DETECTED, UNDER_REVIEW, ACTION_PLANNED,
 *    MONITORING, RESOLVED, REOPENED).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const RecurringIssue = require('../models/RecurringIssue');
const Complaint = require('../models/Complaint');
const { haversineDistance } = require('./duplicateDetectionService');
const { CATEGORY_DEPARTMENT_MAP } = require('./categorizationService');

/**
 * Category-adapted spatial interpretation.
 * Different civic faults exhibit distinct geographic dispersal characteristics.
 */
const CATEGORY_SPATIAL_PARAMS = {
  Pothole: { epsilonMeters: 600, minComplaints: 3, description: 'Road arterial corridor stretch' },
  'Water Supply': { epsilonMeters: 500, minComplaints: 3, description: 'Water distribution main pipeline' },
  Drainage: { epsilonMeters: 500, minComplaints: 3, description: 'Underground sewerage network / storm basin' },
  Streetlight: { epsilonMeters: 400, minComplaints: 3, description: 'Feeder circuit / street lighting sector' },
  Garbage: { epsilonMeters: 400, minComplaints: 3, description: 'Locality bin catchment / vacant plot dump' },
  Traffic: { epsilonMeters: 600, minComplaints: 3, description: 'Intersection / choke point junction' },
  'Stray Animals': { epsilonMeters: 500, minComplaints: 3, description: 'Pack territory / market precinct' },
  'Tree Fall': { epsilonMeters: 600, minComplaints: 3, description: 'Canopy corridor / wind-hazard stretch' },
  'Illegal Construction': { epsilonMeters: 400, minComplaints: 3, description: 'Zonal parcel / layout infringement' },
  'Air & Noise': { epsilonMeters: 500, minComplaints: 3, description: 'Industrial perimeter / commercial node' },
  Other: { epsilonMeters: 500, minComplaints: 3, description: 'General civic municipal radius' },
};

/**
 * Density-Based Spatial Clustering of Applications with Noise (DBSCAN)
 * Backend engine utilizing Haversine distance metrics.
 *
 * @param {Array<object>} complaints - List of complaint documents or objects
 * @param {number} epsilonMeters - Neighborhood proximity threshold in meters
 * @param {number} minPts - Minimum points required to form a dense core
 * @returns {{ clusters: Array<object>, noisePoints: Array<object>, totalPoints: number }}
 */
function runBackendDBSCAN(complaints, epsilonMeters = 500, minPts = 3) {
  const validPoints = (complaints || []).filter(
    (c) =>
      c.location &&
      typeof c.location.latitude === 'number' &&
      typeof c.location.longitude === 'number' &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
  );

  const n = validPoints.length;
  const visited = new Set();
  const pointClusterMap = new Map(); // id -> clusterIndex
  let currentClusterId = 0;

  const getNeighbors = (p) => {
    const neighbors = [];
    for (let i = 0; i < n; i++) {
      const other = validPoints[i];
      const dist = haversineDistance(
        p.location.latitude,
        p.location.longitude,
        other.location.latitude,
        other.location.longitude
      );
      if (dist <= epsilonMeters) {
        neighbors.push(other);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    const p = validPoints[i];
    const pId = p.complaintId || p.id || p._id?.toString() || String(i);
    if (visited.has(pId)) continue;
    visited.add(pId);

    const neighbors = getNeighbors(p);
    if (neighbors.length < minPts) {
      continue; // Noise point or border point evaluated later
    }

    currentClusterId++;
    pointClusterMap.set(pId, currentClusterId);

    const queue = [...neighbors];
    let qIdx = 0;
    while (qIdx < queue.length) {
      const q = queue[qIdx];
      qIdx++;
      const qId = q.complaintId || q.id || q._id?.toString() || `q_${qIdx}`;

      if (!visited.has(qId)) {
        visited.add(qId);
        const qNeighbors = getNeighbors(q);
        if (qNeighbors.length >= minPts) {
          for (const item of qNeighbors) {
            const itemId = item.complaintId || item.id || item._id?.toString();
            if (!queue.some((ex) => (ex.complaintId || ex.id || ex._id?.toString()) === itemId)) {
              queue.push(item);
            }
          }
        }
      }

      if (!pointClusterMap.has(qId)) {
        pointClusterMap.set(qId, currentClusterId);
      }
    }
  }

  // Group into clusters and identify noise points
  const clusterMap = new Map();
  const noisePoints = [];

  for (let i = 0; i < validPoints.length; i++) {
    const p = validPoints[i];
    const pId = p.complaintId || p.id || p._id?.toString() || String(i);
    const cId = pointClusterMap.get(pId);
    if (cId !== undefined) {
      if (!clusterMap.has(cId)) clusterMap.set(cId, []);
      clusterMap.get(cId).push(p);
    } else {
      noisePoints.push(p);
    }
  }

  const clusters = [];
  clusterMap.forEach((pts, clusterId) => {
    const avgLat = pts.reduce((s, p) => s + p.location.latitude, 0) / pts.length;
    const avgLng = pts.reduce((s, p) => s + p.location.longitude, 0) / pts.length;

    let maxDist = 0;
    for (const p of pts) {
      const d = haversineDistance(avgLat, avgLng, p.location.latitude, p.location.longitude);
      if (d > maxDist) maxDist = d;
    }
    const radiusMeters = Math.max(150, Math.round(maxDist + 50));

    // Majority ward detection
    const wardCounts = {};
    for (const p of pts) {
      const w = p.location?.ward;
      if (w) wardCounts[w] = (wardCounts[w] || 0) + 1;
    }
    let dominantWard = 'Unassigned';
    let maxWardCount = 0;
    for (const [w, count] of Object.entries(wardCounts)) {
      if (count > maxWardCount) {
        maxWardCount = count;
        dominantWard = w;
      }
    }

    clusters.push({
      clusterId,
      complaints: pts,
      points: pts,
      center: { latitude: avgLat, longitude: avgLng },
      centerLatitude: avgLat,
      centerLongitude: avgLng,
      radiusMeters,
      count: pts.length,
      density: pts.length,
      highPriorityCount: pts.filter(
        (p) => p.priority === 'High' || p.priority === 'HIGH' || p.priority === 'CRITICAL'
      ).length,
      ward: dominantWard,
    });
  });

  clusters.sort((a, b) => b.count - a.count);

  return {
    clusters,
    noisePoints,
    totalPoints: validPoints.length,
  };
}

/**
 * Calculate temporal trend metrics for a collection of complaints.
 * @param {Array<object>} clusterComplaints - Complaints belonging to cluster
 * @param {number} windowDays - Observation window in days (default: 30)
 * @param {Date} [referenceDate] - Current reference date
 * @returns {object} Temporal trend structure
 */
function calculateTemporalTrend(clusterComplaints, windowDays = 30, referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const currentWindowStart = new Date(now.getTime() - windowDays * 24 * 3600000);
  const previousWindowStart = new Date(now.getTime() - 2 * windowDays * 24 * 3600000);

  let currentPeriodCount = 0;
  let previousPeriodCount = 0;

  const dailyMap = {};
  const weeklyMap = {};
  const monthlyMap = {};

  for (const c of clusterComplaints) {
    const created = new Date(c.createdAt || now);
    if (created >= currentWindowStart && created <= now) {
      currentPeriodCount++;
    } else if (created >= previousWindowStart && created < currentWindowStart) {
      previousPeriodCount++;
    }

    // Format aggregations
    const dateStr = created.toISOString().slice(0, 10);
    dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;

    const monthStr = created.toISOString().slice(0, 7);
    monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + 1;

    // Approximate ISO week
    const weekYear = `${created.getFullYear()}-W${String(Math.ceil(created.getDate() / 7)).padStart(2, '0')}`;
    weeklyMap[weekYear] = (weeklyMap[weekYear] || 0) + 1;
  }

  let classification = 'STABLE';
  let percentageChange = 0;

  if (clusterComplaints.length < 3) {
    classification = 'INSUFFICIENT_DATA';
  } else if (previousPeriodCount === 0) {
    if (currentPeriodCount >= 3) {
      classification = 'INCREASING';
      percentageChange = 100;
    } else {
      classification = 'INSUFFICIENT_DATA';
    }
  } else {
    percentageChange = Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);
    if (percentageChange > 15) {
      classification = 'INCREASING';
    } else if (percentageChange < -15) {
      classification = 'DECREASING';
    } else {
      classification = 'STABLE';
    }
  }

  return {
    classification,
    currentPeriodCount,
    previousPeriodCount,
    percentageChange,
    dailyBreakdown: Object.entries(dailyMap).map(([date, count]) => ({ date, count })),
    weeklyBreakdown: Object.entries(weeklyMap).map(([week, count]) => ({ week, count })),
    monthlyBreakdown: Object.entries(monthlyMap).map(([month, count]) => ({ month, count })),
    calculatedAt: now,
  };
}

/**
 * Detect recurring issue when a single new complaint is submitted.
 * Seamlessly called by the workflow orchestrator.
 *
 * @param {object} newComplaint - New Complaint document
 * @param {object} [options] - Optional parameter overrides
 * @returns {Promise<object|null>} RecurringIssue document if pattern found
 */
async function detectRecurringIssue(newComplaint, options = {}) {
  const category = newComplaint.category || 'Other';
  const categoryParams = CATEGORY_SPATIAL_PARAMS[category] || CATEGORY_SPATIAL_PARAMS.Other;
  const epsilonMeters = options.epsilonMeters || categoryParams.epsilonMeters;
  const minComplaints = options.minComplaints || categoryParams.minComplaints;
  const windowDays = options.windowDays || 30;

  // Validate coordinates
  if (
    !newComplaint.location ||
    typeof newComplaint.location.latitude !== 'number' ||
    typeof newComplaint.location.longitude !== 'number'
  ) {
    return null;
  }

  const windowStart = new Date(Date.now() - windowDays * 24 * 3600000);

  // Find recent active complaints of the same category
  const recentSimilar = await Complaint.find({
    category,
    createdAt: { $gte: windowStart },
    complaintId: { $ne: newComplaint.complaintId },
    status: { $nin: ['CLOSED', 'REJECTED'] },
  });

  // Filter nearby complaints using Haversine
  const nearby = recentSimilar.filter((c) => {
    if (!c.location || typeof c.location.latitude !== 'number' || typeof c.location.longitude !== 'number') {
      return false;
    }
    const dist = haversineDistance(
      newComplaint.location.latitude,
      newComplaint.location.longitude,
      c.location.latitude,
      c.location.longitude
    );
    return dist <= epsilonMeters;
  });

  if (nearby.length + 1 < minComplaints) {
    return null; // Noise / isolated issue for now
  }

  const allClusterComplaints = [newComplaint, ...nearby];
  const avgLat = allClusterComplaints.reduce((s, c) => s + c.location.latitude, 0) / allClusterComplaints.length;
  const avgLng = allClusterComplaints.reduce((s, c) => s + c.location.longitude, 0) / allClusterComplaints.length;

  let maxDist = 0;
  for (const c of allClusterComplaints) {
    const d = haversineDistance(avgLat, avgLng, c.location.latitude, c.location.longitude);
    if (d > maxDist) maxDist = d;
  }
  const radiusMeters = Math.max(150, Math.round(maxDist + 50));

  const occurrenceCount = allClusterComplaints.length;
  const complaintIds = allClusterComplaints.map((c) => c.complaintId);
  const ward = newComplaint.location.ward || nearby.find((c) => c.location?.ward)?.location?.ward || 'Unassigned';
  const departmentName = CATEGORY_DEPARTMENT_MAP[category] || 'Public Health & Sanitation';

  const severity =
    occurrenceCount >= 8 ? 'CRITICAL'
    : occurrenceCount >= 5 ? 'HIGH'
    : occurrenceCount >= 3 ? 'MEDIUM'
    : 'LOW';

  const temporalTrend = calculateTemporalTrend(allClusterComplaints, windowDays);

  const patternDescription =
    `${occurrenceCount} complaints of category "${category}" clustered within ` +
    `${radiusMeters}m radius in ${ward} over the past ${windowDays} days. ` +
    `Spatial density indicates localized recurring infrastructure fault.`;

  // Search for an existing non-deleted recurring issue in this vicinity
  const openStatuses = ['DETECTED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'MONITORING', 'active', 'under_review'];
  const candidates = await RecurringIssue.find({
    category,
    status: { $in: openStatuses },
    isDeleted: { $ne: true },
  });

  let existing = null;
  for (const cand of candidates) {
    if (cand.centerLatitude && cand.centerLongitude) {
      const d = haversineDistance(avgLat, avgLng, cand.centerLatitude, cand.centerLongitude);
      if (d <= cand.radiusMeters + epsilonMeters * 0.5) {
        existing = cand;
        break;
      }
    }
  }

  if (existing) {
    // Update existing recurring issue without creating redundant record
    existing.centerLatitude = avgLat;
    existing.centerLongitude = avgLng;
    existing.radiusMeters = radiusMeters;
    existing.occurrenceCount = occurrenceCount;
    existing.lastReportedAt = new Date();
    existing.lastAnalysedAt = new Date();
    existing.severity = severity;
    existing.patternDescription = patternDescription;
    existing.temporalTrend = temporalTrend;
    existing.departmentName = departmentName;

    // Deduplicate complaintIds
    const idSet = new Set([...(existing.complaintIds || []), ...complaintIds]);
    existing.complaintIds = Array.from(idSet);

    // If it was resolved earlier, reopen it
    if (['RESOLVED', 'resolved'].includes(existing.status)) {
      existing.status = 'REOPENED';
      existing.adminActions.push({
        actionType: 'STATUS_CHANGE',
        notes: `Reopened due to ${occurrenceCount} new recurring complaints detected.`,
        previousStatus: 'RESOLVED',
        newStatus: 'REOPENED',
        performedByName: 'Automated Hotspot Engine',
        performedByRole: 'system',
      });
    }

    await existing.save();
    return existing;
  }

  // Create new RecurringIssue hotspot document
  const hotspotId = await RecurringIssue.generateHotspotId();
  const sortedDates = allClusterComplaints
    .map((c) => new Date(c.createdAt || Date.now()).getTime())
    .sort((a, b) => a - b);

  const newIssue = await RecurringIssue.create({
    hotspotId,
    category,
    subcategory: newComplaint.subcategory || '',
    departmentName,
    ward,
    zone: newComplaint.location.zone || '',
    centerLatitude: avgLat,
    centerLongitude: avgLng,
    radiusMeters,
    complaintIds,
    occurrenceCount,
    observationWindowDays: windowDays,
    clusteringMethod: 'DBSCAN_spatial_density',
    clusteringParams: {
      epsilonMeters,
      minComplaints,
    },
    temporalTrend,
    firstReportedAt: new Date(sortedDates[0]),
    lastReportedAt: new Date(sortedDates[sortedDates.length - 1]),
    lastAnalysedAt: new Date(),
    patternDescription,
    severity,
    status: 'DETECTED',
    adminActions: [
      {
        actionType: 'STATUS_CHANGE',
        notes: `Hotspot detected via DBSCAN spatial clustering (radius: ${radiusMeters}m, count: ${occurrenceCount}).`,
        previousStatus: 'NEW',
        newStatus: 'DETECTED',
        performedByName: 'Automated Hotspot Engine',
        performedByRole: 'system',
      },
    ],
  });

  return newIssue;
}

/**
 * Batch analysis across all recent complaints to discover geographical hotspots.
 * Triggered by Central Admin or recurring schedule.
 *
 * @param {object} options
 * @param {number} [options.windowDays=30] - Observation window in days
 * @param {number} [options.minComplaints=3] - Min complaints per cluster
 * @param {string} [options.category] - Filter to specific category if desired
 * @returns {Promise<object>} Analysis summary and detected hotspots
 */
async function scanAndDetectAllHotspots(options = {}) {
  const windowDays = options.windowDays || 30;
  const windowStart = new Date(Date.now() - windowDays * 24 * 3600000);

  const filter = {
    createdAt: { $gte: windowStart },
    status: { $nin: ['CLOSED', 'REJECTED'] },
    'location.latitude': { $exists: true, $ne: null },
    'location.longitude': { $exists: true, $ne: null },
  };

  if (options.category && options.category !== 'all') {
    filter.category = options.category;
  }

  const complaints = await Complaint.find(filter);

  // Group by category to ensure category-adapted clustering
  const byCategory = {};
  for (const c of complaints) {
    const cat = c.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  }

  const detectedHotspots = [];
  let totalNoisePoints = 0;

  for (const [cat, catComplaints] of Object.entries(byCategory)) {
    const catParams = CATEGORY_SPATIAL_PARAMS[cat] || CATEGORY_SPATIAL_PARAMS.Other;
    const epsilon = options.epsilonMeters || catParams.epsilonMeters;
    const minPts = options.minComplaints || catParams.minComplaints;

    const { clusters, noisePoints } = runBackendDBSCAN(catComplaints, epsilon, minPts);
    totalNoisePoints += noisePoints.length;

    for (const cluster of clusters) {
      const allClusterComplaints = cluster.complaints;
      const sortedDates = allClusterComplaints
        .map((c) => new Date(c.createdAt || Date.now()).getTime())
        .sort((a, b) => a - b);

      const ward =
        allClusterComplaints.find((c) => c.location?.ward)?.location?.ward || 'Unassigned';
      const departmentName = CATEGORY_DEPARTMENT_MAP[cat] || 'Public Health & Sanitation';

      const temporalTrend = calculateTemporalTrend(allClusterComplaints, windowDays);
      const complaintIds = allClusterComplaints.map((c) => c.complaintId);
      const occurrenceCount = allClusterComplaints.length;

      const severity =
        occurrenceCount >= 8 ? 'CRITICAL'
        : occurrenceCount >= 5 ? 'HIGH'
        : occurrenceCount >= 3 ? 'MEDIUM'
        : 'LOW';

      const patternDescription =
        `${occurrenceCount} complaints of category "${cat}" clustered within ` +
        `${cluster.radiusMeters}m radius in ${ward} over the past ${windowDays} days. ` +
        `DBSCAN spatial density cluster #${cluster.clusterId}.`;

      // Check existing hotspot record to avoid duplicate documents
      const existing = await RecurringIssue.findOne({
        category: cat,
        status: { $in: ['DETECTED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'MONITORING', 'active', 'under_review'] },
        centerLatitude: { $gte: cluster.centerLatitude - 0.005, $lte: cluster.centerLatitude + 0.005 },
        centerLongitude: { $gte: cluster.centerLongitude - 0.005, $lte: cluster.centerLongitude + 0.005 },
        isDeleted: { $ne: true },
      });

      if (existing) {
        existing.centerLatitude = cluster.centerLatitude;
        existing.centerLongitude = cluster.centerLongitude;
        existing.radiusMeters = cluster.radiusMeters;
        existing.occurrenceCount = occurrenceCount;
        existing.lastReportedAt = new Date(sortedDates[sortedDates.length - 1]);
        existing.lastAnalysedAt = new Date();
        existing.severity = severity;
        existing.temporalTrend = temporalTrend;
        existing.patternDescription = patternDescription;

        const idSet = new Set([...(existing.complaintIds || []), ...complaintIds]);
        existing.complaintIds = Array.from(idSet);
        await existing.save();
        detectedHotspots.push(existing);
      } else {
        const hotspotId = await RecurringIssue.generateHotspotId();
        const newHotspot = await RecurringIssue.create({
          hotspotId,
          clusterId: cluster.clusterId,
          category: cat,
          departmentName,
          ward,
          centerLatitude: cluster.centerLatitude,
          centerLongitude: cluster.centerLongitude,
          radiusMeters: cluster.radiusMeters,
          complaintIds,
          occurrenceCount,
          observationWindowDays: windowDays,
          clusteringMethod: 'DBSCAN_spatial_density',
          clusteringParams: { epsilonMeters: epsilon, minComplaints: minPts },
          temporalTrend,
          firstReportedAt: new Date(sortedDates[0]),
          lastReportedAt: new Date(sortedDates[sortedDates.length - 1]),
          lastAnalysedAt: new Date(),
          patternDescription,
          severity,
          status: 'DETECTED',
          adminActions: [
            {
              actionType: 'STATUS_CHANGE',
              notes: `Batch scan detected hotspot #${cluster.clusterId} with ${occurrenceCount} complaints.`,
              previousStatus: 'NEW',
              newStatus: 'DETECTED',
              performedByName: 'Batch Hotspot Scanner',
              performedByRole: 'system',
            },
          ],
        });
        detectedHotspots.push(newHotspot);
      }
    }
  }

  return {
    totalComplaintsScanned: complaints.length,
    clustersIdentified: detectedHotspots.length,
    noiseComplaintsPreserved: totalNoisePoints,
    hotspots: detectedHotspots,
    scannedAt: new Date(),
  };
}

/**
 * Update hotspot lifecycle state with administrative action audit.
 * @param {string} hotspotIdOrMongoId
 * @param {object} payload - { status, notes, actionPlan }
 * @param {object} user - User document initiating action
 * @returns {Promise<object>} Updated RecurringIssue document
 */
async function updateHotspotLifecycle(hotspotIdOrMongoId, payload = {}, user = null) {
  const idStr = hotspotIdOrMongoId?.toString() || '';
  const query =
    mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24
      ? { _id: idStr }
      : { hotspotId: idStr };

  const issue = await RecurringIssue.findOne(query);
  if (!issue) {
    throw new Error(`Recurring issue hotspot "${hotspotIdOrMongoId}" not found.`);
  }

  const previousStatus = issue.status;
  if (payload.status) {
    issue.status = payload.status;
  }
  if (payload.proposedAction) {
    issue.preventiveActionPlan = payload.proposedAction.trim();
  } else if (payload.actionPlan) {
    issue.preventiveActionPlan = payload.actionPlan.trim();
  }

  const actionEntry = {
    actionType:
      payload.actionType ||
      (payload.proposedAction || payload.actionPlan
        ? 'PREVENTIVE_PLAN_ASSIGNED'
        : 'STATUS_CHANGE'),
    notes: payload.notes || `Status transition from ${previousStatus} to ${issue.status}`,
    actionPlan: payload.proposedAction || payload.actionPlan || issue.preventiveActionPlan || '',
    previousStatus,
    newStatus: issue.status,
    performedBy: user?._id || (mongoose.Types.ObjectId.isValid(payload.performedBy) ? payload.performedBy : null),
    performedByName: user?.name || payload.performedBy || 'Central Admin',
    performedByRole: user?.role || payload.performedByRole || 'central_admin',
    timestamp: new Date(),
  };

  issue.adminActions.push(actionEntry);
  issue.lastAnalysedAt = new Date();
  await issue.save();

  return issue;
}

/**
 * Get active recurring issues for dashboard and landing views.
 */
async function getActiveRecurringIssues(limit = 10) {
  return RecurringIssue.find({
    status: { $in: ['DETECTED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'MONITORING', 'active', 'under_review'] },
    isDeleted: { $ne: true },
  })
    .sort({ severity: -1, occurrenceCount: -1 })
    .limit(limit);
}

module.exports = {
  haversineDistance,
  CATEGORY_SPATIAL_PARAMS,
  runBackendDBSCAN,
  calculateTemporalTrend,
  detectRecurringIssue,
  scanAndDetectAllHotspots,
  updateHotspotLifecycle,
  getActiveRecurringIssues,
};
