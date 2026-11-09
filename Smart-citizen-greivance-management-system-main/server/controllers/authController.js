'use strict';

const User = require('../models/User');
const Citizen = require('../models/Citizen');
const Department = require('../models/Department');
const Officer = require('../models/Officer');
const { generateToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Public registration for citizens only.
 */
async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      role = 'citizen',
      phone = '',
      ward = 'Ward 102',
      zone = 'Zone 8 (Anna Nagar)',
      address = '',
      preferredLanguage = 'English',
    } = req.body;

    // Security Rule: Public registration is strictly for Citizens
    if (role && role !== 'citizen') {
      return res.status(400).json({
        success: false,
        message: 'Public registration is only permitted for Citizens. Privileged municipal roles must be provisioned by an administrator.',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // Generate unique Citizen ID
    const count = await Citizen.countDocuments();
    const citizenId = `CIT-${String(8840 + count + 1).padStart(4, '0')}`;

    // Create User account (pre-save hook hashes password)
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: password, // Will be hashed in pre-save hook
      role: 'citizen',
      phone: (phone || '').trim(),
      ward: (ward || 'Ward 102').trim(),
      zone: (zone || 'Zone 8 (Anna Nagar)').trim(),
      citizenId,
      active: true,
    });
    await user.save();

    // Create or link Citizen profile
    let citizenProfile = await Citizen.findOne({ citizenId });
    if (!citizenProfile) {
      citizenProfile = await Citizen.create({
        citizenId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: address.trim() || 'Residential Address, Chennai',
        ward: user.ward,
        zone: user.zone,
        preferredLanguage,
        totalComplaints: 0,
        active: true,
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Citizen account registered successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        citizenId: user.citizenId,
        phone: user.phone,
        ward: user.ward,
        zone: user.zone,
      },
      profile: citizenProfile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Universal login for all 4 roles.
 */
async function login(req, res, next) {
  try {
    const { identifier, email, password } = req.body;
    const loginId = (email || identifier || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email / user identifier and password are required.',
      });
    }

    // Search by email, employeeId, or citizenId
    const query = {
      $or: [
        { email: loginId.toLowerCase() },
        { employeeId: loginId },
        { citizenId: loginId },
      ],
    };

    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email, user ID, or password.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact municipal administration.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email, user ID, or password.',
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    // Fetch associated profile information
    let profile = null;
    if (user.role === 'citizen' && user.citizenId) {
      profile = await Citizen.findOne({ citizenId: user.citizenId });
    }

    res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        designation: user.designation,
        citizenId: user.citizenId,
        employeeId: user.employeeId,
        phone: user.phone,
        ward: user.ward,
        zone: user.zone,
        avatar: user.avatar,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Retrieve the current authenticated user session profile.
 */
async function getMe(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    let profile = null;
    if (user.role === 'citizen' && user.citizenId) {
      profile = await Citizen.findOne({ citizenId: user.citizenId });
    } else if (
      (user.role === 'department_supervisor' || user.role === 'department_employee') &&
      user.departmentId
    ) {
      profile = await Department.findById(user.departmentId);
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        designation: user.designation,
        citizenId: user.citizenId,
        employeeId: user.employeeId,
        phone: user.phone,
        ward: user.ward,
        zone: user.zone,
        avatar: user.avatar,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Acknowledge logout.
 */
async function logout(req, res) {
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * POST /api/auth/provision-staff
 * Central Admin creates Department Supervisor or Department Employee accounts.
 */
async function provisionStaff(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      role,
      departmentId,
      departmentName,
      designation = 'Department Officer',
      phone = '',
      assignedWards = ['Ward 101', 'Ward 102'],
    } = req.body;

    if (!['department_supervisor', 'department_employee'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Provisioned role must be either "department_supervisor" or "department_employee".',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required for staff provisioning.',
      });
    }

    // Verify department exists
    let dept = null;
    if (departmentId) {
      dept = await Department.findById(departmentId);
    } else if (departmentName) {
      dept = await Department.findOne({ name: departmentName });
    }

    if (!dept) {
      return res.status(400).json({
        success: false,
        message: 'A valid department must be specified for staff accounts.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An account with email ${normalizedEmail} already exists.`,
      });
    }

    const count = await Officer.countDocuments();
    const employeeId = `OFF-${String(1020 + count + 1)}`;

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: password,
      role,
      departmentId: dept._id,
      departmentName: dept.name,
      designation: designation.trim(),
      phone: phone.trim(),
      employeeId,
      active: true,
    });
    await user.save();

    // Create Officer record in Officer collection for backward compatibility
    await Officer.create({
      name: user.name,
      employeeId,
      departmentId: dept._id,
      departmentName: dept.name,
      designation: user.designation,
      email: user.email,
      phone: user.phone,
      assignedWards,
      activeComplaintCount: 0,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: `${role === 'department_supervisor' ? 'Supervisor' : 'Employee'} account provisioned successfully.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        designation: user.designation,
        employeeId: user.employeeId,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  logout,
  provisionStaff,
};

