'use strict';

const Complaint = require('../models/Complaint');
const RecurringIssue = require('../models/RecurringIssue');
const Escalation = require('../models/Escalation');
const { getTopEscalations } = require('../services/escalationService');
const { getActiveRecurringIssues } = require('../services/recurringIssueService');

/**
 * GET /api/dashboard/statistics
 * Aggregate live platform metrics for the Citizen Dashboard
 */
async function getStatistics(req, res, next) {
  try {
    if (require('mongoose').connection.readyState !== 1) {
      const { MOCK_STATS } = require('../services/mockData');
      return res.json({ success: true, data: MOCK_STATS });
    }

    const [
      total,
      pendingCount,
      inProgressCount,
      resolvedCount,
      highPriorityCount,
      categoryStats,
      wardStats,
      recurringCount,
      escalationCount,
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({
        status: {
          $in: [
            'SUBMITTED',
            'UNDER_ANALYSIS',
            'CATEGORIZED',
            'PRIORITIZED',
            'ROUTED',
            'ASSIGNED',
            'Pending',
          ],
        },
      }),
      Complaint.countDocuments({
        status: {
          $in: ['IN_PROGRESS', 'In Progress', 'UNDER_VERIFICATION', 'RESOLUTION_SUBMITTED'],
        },
      }),
      Complaint.countDocuments({
        status: { $in: ['RESOLVED', 'Resolved', 'VERIFIED', 'CLOSED'] },
      }),
      Complaint.countDocuments({
        priority: { $in: ['HIGH', 'CRITICAL', 'High'] },
        status: { $nin: ['RESOLVED', 'Resolved', 'VERIFIED', 'CLOSED', 'REJECTED'] },
      }),
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Complaint.aggregate([
        { $group: { _id: '$location.ward', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      RecurringIssue.countDocuments({ status: { $in: ['active', 'under_review'] } }),
      Escalation.countDocuments({ escalationRisk: { $in: ['HIGH', 'CRITICAL'] } }),
    ]);

    const resolutionRate =
      total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalComplaints: total,
        pendingComplaints: pendingCount,
        inProgressComplaints: inProgressCount,
        resolvedComplaints: resolvedCount,
        highPriorityComplaints: highPriorityCount,
        resolutionRate,
        recurringIssuesActive: recurringCount,
        criticalEscalations: escalationCount,
        categoryBreakdown: categoryStats.map((c) => ({
          category: c._id || 'Other',
          count: c.count,
        })),
        wardBreakdown: wardStats.map((w) => ({
          ward: w._id || 'Unassigned',
          count: w.count,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/escalations
 * Get high/critical predicted escalations
 */
async function getEscalations(req, res, next) {
  try {
    const escalations = await getTopEscalations(10);
    res.json({ success: true, count: escalations.length, data: escalations });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/recurring-issues
 * Get active recurring issue clusters
 */
async function getRecurringIssues(req, res, next) {
  try {
    const recurring = await getActiveRecurringIssues(10);
    res.json({ success: true, count: recurring.length, data: recurring });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/sla-metrics
 * Aggregated SLA and Predictive Delay statistics for dashboard monitoring.
 */
async function getSlaMetrics(req, res, next) {
  try {
    const ComplaintTask = require('../models/ComplaintTask');
    const { calculateTaskSLA } = require('../services/slaMonitoringService');
    const { predictTaskDelay } = require('../services/predictiveDelayService');

    const filter = {};
    if (req.user?.role === 'department_supervisor' && req.user.departmentName) {
      filter.departmentName = req.user.departmentName;
    }

    const tasks = await ComplaintTask.find(filter);
    const now = new Date();

    let onTrack = 0;
    let atRisk = 0;
    let overdue = 0;
    let completedWithinSLA = 0;
    let completedAfterSLA = 0;
    let lowRisk = 0;
    let moderateRisk = 0;
    let highRisk = 0;

    for (const t of tasks) {
      const sla = calculateTaskSLA(t, now);
      if (sla.slaStatus === 'ON_TRACK') onTrack++;
      else if (sla.slaStatus === 'AT_RISK') atRisk++;
      else if (sla.slaStatus === 'OVERDUE') overdue++;
      else if (sla.slaStatus === 'COMPLETED_WITHIN_SLA') completedWithinSLA++;
      else if (sla.slaStatus === 'COMPLETED_AFTER_SLA') completedAfterSLA++;

      if (!['VERIFIED', 'COMPLETED'].includes(t.status)) {
        const delay = await predictTaskDelay(t, {}, now);
        if (delay.riskLevel === 'HIGH') highRisk++;
        else if (delay.riskLevel === 'MODERATE') moderateRisk++;
        else lowRisk++;
      }
    }

    const totalActive = onTrack + atRisk + overdue;
    const totalCompleted = completedWithinSLA + completedAfterSLA;
    const complianceRate = totalCompleted > 0 ? Math.round((completedWithinSLA / totalCompleted) * 100) : 100;

    // Escalations summary
    const escFilter = {};
    if (req.user?.role === 'department_supervisor' && req.user.departmentName) {
      escFilter.departmentName = req.user.departmentName;
    }
    const [totalEscalations, unacknowledgedEscalations] = await Promise.all([
      Escalation.countDocuments(escFilter),
      Escalation.countDocuments({ ...escFilter, isAcknowledged: false }),
    ]);

    res.json({
      success: true,
      data: {
        totalTasks: tasks.length,
        totalActive,
        totalCompleted,
        complianceRate,
        slaBreakdown: {
          onTrack,
          atRisk,
          overdue,
          completedWithinSLA,
          completedAfterSLA,
        },
        delayRiskBreakdown: {
          lowRisk,
          moderateRisk,
          highRisk,
        },
        escalations: {
          total: totalEscalations,
          unacknowledged: unacknowledgedEscalations,
        },
        evaluationMethod: 'feature_weighted_risk_baseline',
        timestamp: now,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/hotspots
 * Query and filter recurring issue hotspots with RBAC isolation.
 */
async function getHotspots(req, res, next) {
  try {
    const {
      status,
      category,
      ward,
      trend,
      limit = 50,
      page = 1,
    } = req.query;

    const filter = { isDeleted: { $ne: true } };

    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Citizens cannot access internal municipal hotspot intelligence.',
        });
      }
      if (req.user.role === 'department_supervisor' && req.user.departmentName) {
        filter.departmentName = req.user.departmentName;
      }
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        filter.status = { $in: ['DETECTED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'MONITORING', 'active', 'under_review'] };
      } else {
        filter.status = status;
      }
    }
    if (category && category !== 'all') filter.category = category;
    if (ward && ward !== 'all') filter.ward = ward;
    if (trend && trend !== 'all') filter['temporalTrend.classification'] = trend;

    const skip = (Number(page) - 1) * Number(limit);
    const [hotspots, total] = await Promise.all([
      RecurringIssue.find(filter)
        .sort({ updatedAt: -1, occurrenceCount: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RecurringIssue.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data: hotspots,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/hotspots/:id
 * Retrieve single hotspot details including associated complaint records.
 */
async function getHotspotById(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { hotspotId: id };

    const hotspot = await RecurringIssue.findOne(query);
    if (!hotspot) {
      return res.status(404).json({ success: false, message: 'Recurring issue hotspot not found.' });
    }

    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }
      if (
        req.user.role === 'department_supervisor' &&
        req.user.departmentName &&
        hotspot.departmentName &&
        hotspot.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Hotspot belongs to "${hotspot.departmentName}", but your department is "${req.user.departmentName}".`,
        });
      }
    }

    // Populate linked complaints
    const complaints = await Complaint.find({
      complaintId: { $in: hotspot.complaintIds },
    }).select('complaintId category subcategory description location status priority createdAt');

    res.json({
      success: true,
      data: {
        hotspot,
        complaints,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dashboard/hotspots/scan
 * Central Admin triggers spatial/temporal DBSCAN re-clustering scan.
 */
async function runHotspotScan(req, res, next) {
  try {
    if (req.user && req.user.role !== 'central_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Central Admin can trigger batch hotspot scans.',
      });
    }

    const { scanAndDetectAllHotspots } = require('../services/recurringIssueService');
    const result = await scanAndDetectAllHotspots(req.body);

    res.json({
      success: true,
      message: 'Geospatial DBSCAN scan completed successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/dashboard/hotspots/:id/status
 * Central Admin or Supervisor updates hotspot lifecycle status & preventive plan.
 */
async function updateHotspotStatusController(req, res, next) {
  try {
    const { id } = req.params;
    const { updateHotspotLifecycle } = require('../services/recurringIssueService');

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { hotspotId: id };
    const hotspot = await RecurringIssue.findOne(query);
    if (!hotspot) {
      return res.status(404).json({ success: false, message: 'Hotspot not found.' });
    }

    if (req.user) {
      if (req.user.role === 'citizen' || req.user.role === 'department_employee') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (
        req.user.role === 'department_supervisor' &&
        req.user.departmentName &&
        hotspot.departmentName &&
        hotspot.departmentName.toLowerCase() !== req.user.departmentName.toLowerCase()
      ) {
        return res.status(403).json({ success: false, message: 'Access denied for foreign department hotspot.' });
      }
    }

    const updated = await updateHotspotLifecycle(id, req.body, req.user);

    res.json({
      success: true,
      message: `Hotspot status updated to ${updated.status}.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/hotspot-metrics
 * Aggregated hotspot metrics for Central Admin dashboard overview.
 */
async function getHotspotMetrics(req, res, next) {
  try {
    const filter = { isDeleted: { $ne: true } };

    if (req.user) {
      if (req.user.role === 'citizen') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (req.user.role === 'department_supervisor' && req.user.departmentName) {
        filter.departmentName = req.user.departmentName;
      }
    }

    const [
      total,
      activeCount,
      underReviewCount,
      increasingCount,
      categoryBreakdown,
      wardBreakdown,
      trendBreakdown,
    ] = await Promise.all([
      RecurringIssue.countDocuments(filter),
      RecurringIssue.countDocuments({
        ...filter,
        status: { $in: ['DETECTED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'MONITORING', 'active', 'under_review'] },
      }),
      RecurringIssue.countDocuments({
        ...filter,
        status: 'UNDER_REVIEW',
      }),
      RecurringIssue.countDocuments({
        ...filter,
        'temporalTrend.classification': 'INCREASING',
      }),
      RecurringIssue.aggregate([
        { $match: filter },
        { $group: { _id: '$category', count: { $sum: 1 }, totalComplaints: { $sum: '$occurrenceCount' } } },
        { $sort: { count: -1 } },
      ]),
      RecurringIssue.aggregate([
        { $match: filter },
        { $group: { _id: '$ward', count: { $sum: 1 }, totalComplaints: { $sum: '$occurrenceCount' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      RecurringIssue.aggregate([
        { $match: filter },
        { $group: { _id: '$temporalTrend.classification', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalHotspots: total,
        activeHotspots: activeCount,
        underReviewHotspots: underReviewCount,
        increasingHotspots: increasingCount,
        categoryBreakdown: categoryBreakdown.map((c) => ({
          category: c._id || 'Other',
          hotspotCount: c.count,
          totalComplaints: c.totalComplaints,
        })),
        wardBreakdown: wardBreakdown.map((w) => ({
          ward: w._id || 'Unassigned',
          hotspotCount: w.count,
          totalComplaints: w.totalComplaints,
        })),
        trendBreakdown: trendBreakdown.map((t) => ({
          trend: t._id || 'STABLE',
          count: t.count,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatistics,
  getEscalations,
  getRecurringIssues,
  getSlaMetrics,
  getHotspots,
  getHotspotById,
  runHotspotScan,
  updateHotspotStatusController,
  getHotspotMetrics,
};
