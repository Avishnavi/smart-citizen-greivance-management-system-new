'use strict';

const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    // Which complaint categories this department handles
    categoryMappings: [{ type: String }],
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    headOfficerName: { type: String, default: '' },
    // Default SLA in hours
    slaHours: { type: Number, default: 72 },
    address: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', DepartmentSchema);
