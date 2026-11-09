'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const knowledgeController = require('../controllers/knowledgeController');

// GET /api/knowledge (Role-scoped: Citizens see public; Staff see department + public; Admin sees all)
router.get('/', optionalAuth, knowledgeController.getAllDocuments);

// POST /api/knowledge/retrieve (RAG Knowledge Retrieval for complaint assistance)
router.post('/retrieve', optionalAuth, knowledgeController.retrieveKnowledgeEndpoint);

// POST /api/knowledge/rechunk-all (Admin utility to re-index all chunks)
router.post(
  '/rechunk-all',
  authenticateToken,
  requireRole(['central_admin']),
  knowledgeController.rechunkAllEndpoint
);

// GET /api/knowledge/:id
router.get(
  '/:id',
  optionalAuth,
  [param('id').isMongoId().withMessage('Valid document ID is required'), validateRequest],
  knowledgeController.getDocumentById
);

// POST /api/knowledge (Central Admin or Supervisor creates SOP)
router.post(
  '/',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [
    body('title').trim().notEmpty().withMessage('Document title is required'),
    body('content').trim().notEmpty().withMessage('Document content is required'),
    validateRequest,
  ],
  knowledgeController.createDocument
);

// PUT /api/knowledge/:id (Central Admin or Supervisor updates SOP)
router.put(
  '/:id',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('id').isMongoId().withMessage('Valid document ID is required'), validateRequest],
  knowledgeController.updateDocument
);

// PATCH /api/knowledge/:id
router.patch(
  '/:id',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('id').isMongoId().withMessage('Valid document ID is required'), validateRequest],
  knowledgeController.updateDocument
);

// DELETE /api/knowledge/:id (Central Admin or Supervisor deletes SOP)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['central_admin', 'department_supervisor']),
  [param('id').isMongoId().withMessage('Valid document ID is required'), validateRequest],
  knowledgeController.deleteDocument
);

module.exports = router;

