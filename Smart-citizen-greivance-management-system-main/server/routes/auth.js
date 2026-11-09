'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticateToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');

// POST /api/auth/register (Citizens only)
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    validateRequest,
  ],
  authController.register
);

// POST /api/auth/login (All roles)
router.post(
  '/login',
  [
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  authController.login
);

// GET /api/auth/me (Current session)
router.get('/me', authenticateToken, authController.getMe);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// POST /api/auth/provision-staff (Central Admin only)
router.post(
  '/provision-staff',
  [
    authenticateToken,
    requireRole(['central_admin']),
    body('name').trim().notEmpty().withMessage('Staff name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role')
      .isIn(['department_supervisor', 'department_employee'])
      .withMessage('Role must be department_supervisor or department_employee'),
    validateRequest,
  ],
  authController.provisionStaff
);

module.exports = router;

