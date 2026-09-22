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

module.exports = {
  getStatistics,
  getEscalations,
  getRecurringIssues,
};
