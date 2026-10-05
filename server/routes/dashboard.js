'use strict';

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/statistics
router.get('/statistics', dashboardController.getStatistics);

// GET /api/dashboard/escalations
router.get('/escalations', dashboardController.getEscalations);

// GET /api/dashboard/recurring-issues
router.get('/recurring-issues', dashboardController.getRecurringIssues);

module.exports = router;
