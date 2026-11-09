'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const complaintController = require('../controllers/complaintController');
const chatController = require('../controllers/chatController');

// POST /api/complaints (Public submission with optional user association)
router.post(
  '/',
  optionalAuth,
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('location.latitude').optional().isNumeric().withMessage('Valid latitude is required'),
    body('location.longitude').optional().isNumeric().withMessage('Valid longitude is required'),
    validateRequest,
  ],
  complaintController.createComplaint
);

// GET /api/complaints (Optional auth: scoped by role if authenticated)
router.get('/', optionalAuth, complaintController.getAllComplaints);

// GET /api/complaints/:id (Public ticket tracking with privacy sanitation)
router.get(
  '/:id',
  optionalAuth,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintById
);

// PATCH /api/complaints/:id (Protected: Central Admin, Department Supervisor, Department Employee)
router.patch(
  '/:id',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.updateComplaint
);

// GET /api/complaints/:id/timeline (Public timeline tracking for citizens)
router.get(
  '/:id/timeline',
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintTimeline
);

// POST /api/complaints/:id/resolution (Protected: Staff only)
router.post(
  '/:id/resolution',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor', 'department_employee']),
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    body('resolutionNotes')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Resolution notes must be at least 10 characters'),
    validateRequest,
  ],
  complaintController.submitResolution
);

// POST /api/complaints/:id/feedback (Citizen submits post-resolution satisfaction)
router.post(
  '/:id/feedback',
  optionalAuth,
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    validateRequest,
  ],
  complaintController.submitCitizenFeedback
);

// POST /api/complaints/:id/upvote (Community upvoting)
router.post(
  '/:id/upvote',
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.upvoteComplaint
);

// POST /api/complaints/:id/approve (Central Admin reviews, approves/rejects, & creates tasks)
router.post(
  '/:id/approve',
  authenticateToken,
  requireRole(['central_admin']),
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.approveComplaintRouting
);

router.post(
  '/:id/approve-routing',
  authenticateToken,
  requireRole(['central_admin']),
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.approveComplaintRouting
);

// POST /api/complaints/:id/close (Final overall complaint closure - Central Admin only)
router.post(
  '/:id/close',
  authenticateToken,
  requireRole(['central_admin']),
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.closeComplaint
);

// POST /api/complaints/:id/reopen (Citizen or Admin requests review / reopens complaint)
router.post(
  '/:id/reopen',
  optionalAuth,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.reopenComplaint
);

// POST /api/complaints/:id/clarification (Citizen responds to clarification request)
router.post(
  '/:id/clarification',
  optionalAuth,
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    body().custom((value, { req }) => {
      const text = req.body.clarificationText || req.body.responseNotes;
      if (!text || typeof text !== 'string' || text.trim().length < 5) {
        throw new Error('Clarification response must be at least 5 characters');
      }
      return true;
    }),
    validateRequest,
  ],
  complaintController.respondToClarification
);

// GET /api/complaints/:id/tasks (Department tasks for this complaint)
router.get(
  '/:id/tasks',
  optionalAuth,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintTasks
);

// GET /api/complaints/:id/knowledge (Grounded knowledge & SOP retrieval for complaint)
router.get(
  '/:id/knowledge',
  optionalAuth,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintKnowledge
);

// ─── Official Department Chat Endpoints ─────────────────────────────────────

// GET /api/complaints/:id/departments (List associated departments for chat)
router.get(
  '/:id/departments',
  authenticateToken,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  chatController.getComplaintDepartments
);

// GET /api/complaints/:id/departments/:deptId/messages (Get department conversation)
router.get(
  '/:id/departments/:deptId/messages',
  authenticateToken,
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    param('deptId').trim().notEmpty().withMessage('Department ID is required'),
    validateRequest,
  ],
  chatController.getDepartmentMessages
);

// POST /api/complaints/:id/departments/:deptId/messages (Send department message/internal note)
router.post(
  '/:id/departments/:deptId/messages',
  authenticateToken,
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    param('deptId').trim().notEmpty().withMessage('Department ID is required'),
    body('message').trim().notEmpty().withMessage('Message text is required'),
    validateRequest,
  ],
  chatController.postDepartmentMessage
);

// GET /api/complaints/:id/messages (General & Legacy complaint messages)
router.get(
  '/:id/messages',
  authenticateToken,
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  chatController.getComplaintMessages
);

module.exports = router;
