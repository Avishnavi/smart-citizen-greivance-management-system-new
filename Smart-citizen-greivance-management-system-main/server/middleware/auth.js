'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_citizen_jwt_super_secret_key_2026_rbac';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT token for a user.
 * @param {object} user - User document
 * @returns {string} Signed JWT
 */
function generateToken(user) {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
    departmentName: user.departmentName || '',
    citizenId: user.citizenId || '',
    employeeId: user.employeeId || '',
    name: user.name,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Middleware: Verify JWT and attach authenticated user to req.user.
 * Fails with 401 if token is missing, or 403 if invalid / user inactive.
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Invalid authentication token.',
      });
    }

    // Retrieve active user from database
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or was removed.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'User account has been deactivated. Contact municipal administration.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Optional authentication.
 * If a valid token is provided, attaches req.user.
 * If no token or invalid token, sets req.user = null and continues without error.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-passwordHash');
      req.user = (user && user.active) ? user : null;
    } catch {
      req.user = null;
    }

    next();
  } catch {
    req.user = null;
    next();
  }
}

/**
 * Middleware factory: Enforce role-based access.
 * @param {string|string[]} allowedRoles - Role or array of roles permitted
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for this resource.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of the following roles: [${roles.join(', ')}]. Your role is "${req.user.role}".`,
      });
    }

    next();
  };
}

/**
 * Middleware: Enforce department boundary.
 * - Central Admin has municipality-wide access (bypass).
 * - Department Supervisor and Employee can only access resources matching their department.
 */
function requireDepartment(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  // Central Admin has municipality-wide override
  if (req.user.role === 'central_admin') {
    return next();
  }

  // Determine requested department from params, query, or body
  const targetDeptId = req.params.departmentId || req.query.departmentId || req.body.departmentId;
  const targetDeptName = req.params.department || req.query.department || req.body.department;

  if (targetDeptId && req.user.departmentId) {
    if (req.user.departmentId.toString() !== targetDeptId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access resources for your assigned department.',
      });
    }
  } else if (targetDeptName && req.user.departmentName) {
    if (req.user.departmentName.toLowerCase() !== targetDeptName.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access resources for your assigned department.',
      });
    }
  }

  next();
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireRole,
  requireDepartment,
};

