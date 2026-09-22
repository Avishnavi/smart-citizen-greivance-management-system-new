'use strict';

const mongoose = require('mongoose');

const OfficerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    employeeId: { type: String, required: true, unique: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    departmentName: { type: String, default: '' },
    designation: { type: String, default: 'Field Officer' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    assignedWards: [{ type: String }],
    activeComplaintCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

OfficerSchema.index({ departmentId: 1, active: 1 });

module.exports = mongoose.model('Officer', OfficerSchema);
