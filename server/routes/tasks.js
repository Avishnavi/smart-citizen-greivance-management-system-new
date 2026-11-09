'use strict';

const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticateToken, requireRole } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

// GET /api/tasks (Protected: Staff & Central Admin)
router.get(
  '/',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  taskController.getAllTasks
);

// GET /api/tasks/:taskId
router.get(
  '/:taskId',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.getTaskById
);

// PATCH & POST /api/tasks/:taskId/assign (Supervisor or Central Admin assigns employee)
router.all(
  '/:taskId/assign',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [
    param('taskId').trim().notEmpty().withMessage('Task ID is required'),
    body().custom((value, { req }) => {
      if (!req.body.employeeName && !req.body.employeeId && !req.body.assignedEmployeeId) {
        throw new Error('Employee name or employee ID is required');
      }
      return true;
    }),
    validateRequest,
  ],
  taskController.assignTask
);

// PATCH /api/tasks/:taskId/status (Employee accepts or updates task progress)
router.patch(
  '/:taskId/status',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [
    param('taskId').trim().notEmpty().withMessage('Task ID is required'),
    body('status').trim().notEmpty().withMessage('Status is required'),
    validateRequest,
  ],
  taskController.updateTaskStatus
);

// POST /api/tasks/:taskId/resolution & /api/tasks/:taskId/resolve (Employee submits resolution evidence)
router.post(
  ['/:taskId/resolution', '/:taskId/resolve'],
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [
    param('taskId').trim().notEmpty().withMessage('Task ID is required'),
    body().custom((value, { req }) => {
      const notes = req.body.resolutionNotes || req.body.notes;
      if (!notes || typeof notes !== 'string' || notes.trim().length < 10) {
        throw new Error('Resolution notes must be at least 10 characters');
      }
      return true;
    }),
    validateRequest,
  ],
  taskController.submitTaskResolution
);

// POST /api/tasks/:taskId/verify (Supervisor or Central Admin verifies resolution)
router.post(
  '/:taskId/verify',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [
    param('taskId').trim().notEmpty().withMessage('Task ID is required'),
    body('action')
      .isIn(['approve', 'request_rework', 'reject'])
      .withMessage('Valid action is required (approve, request_rework, reject)'),
    body('comments').trim().notEmpty().withMessage('Supervisor review comment/reason is mandatory'),
    validateRequest,
  ],
  taskController.verifyTaskResolutionController
);

// GET /api/tasks/:taskId/knowledge (Protected: Grounded knowledge & SOP for task)
router.get(
  '/:taskId/knowledge',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.getTaskKnowledge
);

// GET /api/tasks/:taskId/sla (Protected: SLA countdown and predictive delay estimation)
router.get(
  '/:taskId/sla',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.getTaskSLA
);

// POST /api/tasks/:taskId/pause-sla & /api/tasks/:taskId/pause (Protected: Supervisor or Admin pauses SLA)
router.post(
  ['/:taskId/pause-sla', '/:taskId/pause'],
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.pauseTaskSLAController
);

// POST /api/tasks/:taskId/resume-sla & /api/tasks/:taskId/resume (Protected: Supervisor or Admin resumes SLA)
router.post(
  ['/:taskId/resume-sla', '/:taskId/resume'],
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.resumeTaskSLAController
);

// POST /api/tasks/:taskId/escalate (Protected: Supervisor or Admin triggers escalation)
router.post(
  '/:taskId/escalate',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('taskId').trim().notEmpty().withMessage('Task ID is required'), validateRequest],
  taskController.escalateTask
);

// PATCH /api/tasks/escalations/:escalationId/acknowledge (Protected: Acknowledge escalation)
router.patch(
  '/escalations/:escalationId/acknowledge',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('escalationId').trim().notEmpty().withMessage('Escalation ID is required'), validateRequest],
  taskController.acknowledgeEscalation
);

module.exports = router;

