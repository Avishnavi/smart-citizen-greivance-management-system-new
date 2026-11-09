'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const USER_ROLES = [
  'citizen',
  'central_admin',
  'department_supervisor',
  'department_employee',
];

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a valid user role',
      },
      default: 'citizen',
      required: true,
      index: true,
    },
    // Associated Department for Supervisors and Employees
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    departmentName: {
      type: String,
      default: '',
    },
    designation: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    ward: {
      type: String,
      default: 'Ward 102',
    },
    zone: {
      type: String,
      default: 'Zone 8 (Anna Nagar)',
    },
    avatar: {
      type: String,
      default: '',
    },
    employeeId: {
      type: String,
      default: '',
      sparse: true,
      index: true,
    },
    citizenId: {
      type: String,
      default: '',
      sparse: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook: Hash password if modified
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password instance method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Expose allowed roles as static constant
UserSchema.statics.ROLES = USER_ROLES;

module.exports = mongoose.model('User', UserSchema);

