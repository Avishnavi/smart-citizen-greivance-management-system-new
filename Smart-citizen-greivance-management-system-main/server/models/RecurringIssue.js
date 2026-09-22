'use strict';

const mongoose = require('mongoose');

/**
 * RecurringIssue — proactive recurring-issue detection.
 * Research contribution: Location + Category + Time clustering.
 */
const RecurringIssueSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    ward: { type: String, required: true },
    zone: { type: String, default: '' },

    // Geographic center of the cluster
    centerLatitude: { type: Number },
    centerLongitude: { type: Number },
    radiusMeters: { type: Number, default: 500 },

    // Linked complaint IDs (the raw string IDs e.g. CMP-2026-001245)
    complaintIds: [{ type: String }],
    occurrenceCount: { type: Number, default: 0 },

    firstReportedAt: { type: Date },
    lastReportedAt: { type: Date },

    patternDescription: { type: String, default: '' },

    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },

    status: {
      type: String,
      enum: ['active', 'under_review', 'resolved', 'dismissed'],
      default: 'active',
    },

    // Whether authorities have been alerted
    authorityAlerted: { type: Boolean, default: false },
    alertedAt: { type: Date, default: null },
    alertRecipient: { type: String, default: '' },
  },
  { timestamps: true }
);

RecurringIssueSchema.index({ ward: 1, category: 1, status: 1 });

module.exports = mongoose.model('RecurringIssue', RecurringIssueSchema);
