'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const complaintController = require('../controllers/complaintController');

// POST /api/complaints
router.post(
  '/',
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('location.latitude').isNumeric().withMessage('Valid latitude is required'),
    body('location.longitude').isNumeric().withMessage('Valid longitude is required'),
    body('location.address').trim().notEmpty().withMessage('Address is required'),
    validateRequest,
  ],
  complaintController.createComplaint
);

// GET /api/complaints
router.get('/', complaintController.getAllComplaints);

// GET /api/complaints/:id
router.get(
  '/:id',
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintById
);

// GET /api/complaints/:id/timeline
router.get(
  '/:id/timeline',
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.getComplaintTimeline
);

// POST /api/complaints/:id/resolution
router.post(
  '/:id/resolution',
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

// POST /api/complaints/:id/feedback
router.post(
  '/:id/feedback',
  [
    param('id').trim().notEmpty().withMessage('Complaint ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    validateRequest,
  ],
  complaintController.submitCitizenFeedback
);

// POST /api/complaints/:id/upvote
router.post(
  '/:id/upvote',
  [param('id').trim().notEmpty().withMessage('Complaint ID is required'), validateRequest],
  complaintController.upvoteComplaint
);

module.exports = router;
