'use strict';

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

// GET /api/dashboard/statistics (Public civic statistics for landing & dashboards)
router.get('/statistics', optionalAuth, dashboardController.getStatistics);

// GET /api/dashboard/escalations (Protected: Central Admin & Department Supervisors only)
router.get(
  '/escalations',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getEscalations
);

// GET /api/dashboard/recurring-issues (Protected: Central Admin & Department Supervisors only)
router.get(
  '/recurring-issues',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getRecurringIssues
);

// GET /api/dashboard/sla-metrics (Protected: Central Admin & Department Supervisors only)
router.get(
  '/sla-metrics',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getSlaMetrics
);

// GET /api/dashboard/hotspots (Protected: Central Admin & Department Supervisors only)
router.get(
  '/hotspots',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getHotspots
);

// GET /api/dashboard/hotspot-metrics (Protected: Central Admin & Department Supervisors only)
router.get(
  '/hotspot-metrics',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getHotspotMetrics
);

// GET /api/dashboard/hotspots/:id (Protected: Central Admin & Department Supervisors only)
router.get(
  '/hotspots/:id',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.getHotspotById
);

// POST /api/dashboard/hotspots/scan (Protected: Central Admin only)
router.post(
  '/hotspots/scan',
  authenticateToken,
  requireRole(['central_admin']),
  dashboardController.runHotspotScan
);

// PATCH /api/dashboard/hotspots/:id/status (Protected: Central Admin & Department Supervisors only)
router.patch(
  '/hotspots/:id/status',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  dashboardController.updateHotspotStatusController
);

module.exports = router;
