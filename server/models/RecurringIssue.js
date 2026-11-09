'use strict';

const mongoose = require('mongoose');

const AdminActionSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: ['STATUS_CHANGE', 'NOTE_ADDED', 'PREVENTIVE_PLAN_ASSIGNED', 'MONITORING_SCHEDULED'],
      required: true,
    },
    notes: { type: String, default: '' },
    actionPlan: { type: String, default: '' },
    previousStatus: { type: String },
    newStatus: { type: String },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String, default: 'Central Admin' },
    performedByRole: { type: String, default: 'central_admin' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * RecurringIssue — proactive recurring-issue and hotspot detection.
 * Research contribution: Location + Category + Time DBSCAN clustering.
 */
const RecurringIssueSchema = new mongoose.Schema(
  {
    hotspotId: {
      type: String,
      sparse: true,
      index: true,
    },
    clusterId: {
      type: Number,
      default: 1,
    },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, default: '' },
    departmentName: { type: String, default: '', index: true },
    ward: { type: String, default: 'Unassigned', index: true },
    zone: { type: String, default: '' },

    // Geographic center & spread of the cluster
    centerLatitude: { type: Number },
    centerLongitude: { type: Number },
    radiusMeters: { type: Number, default: 500 },

    // Linked complaint IDs (the raw string IDs e.g. CMP-2026-001245)
    complaintIds: [{ type: String }],
    occurrenceCount: { type: Number, default: 0 },

    observationWindowDays: { type: Number, default: 30 },
    clusteringMethod: { type: String, default: 'DBSCAN_spatial_density' },
    clusteringParams: {
      epsilonMeters: { type: Number, default: 500 },
      minComplaints: { type: Number, default: 3 },
    },

    // Temporal trend metrics
    temporalTrend: {
      classification: {
        type: String,
        enum: ['INCREASING', 'DECREASING', 'STABLE', 'INSUFFICIENT_DATA'],
        default: 'STABLE',
      },
      currentPeriodCount: { type: Number, default: 0 },
      previousPeriodCount: { type: Number, default: 0 },
      percentageChange: { type: Number, default: 0 },
      dailyBreakdown: [{ date: String, count: Number }],
      weeklyBreakdown: [{ week: String, count: Number }],
      monthlyBreakdown: [{ month: String, count: Number }],
      calculatedAt: { type: Date, default: Date.now },
    },

    firstReportedAt: { type: Date },
    lastReportedAt: { type: Date },
    lastAnalysedAt: { type: Date, default: Date.now },

    patternDescription: { type: String, default: '' },
    preventiveActionPlan: { type: String, default: '' },

    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },

    status: {
      type: String,
      enum: [
        'DETECTED',
        'UNDER_REVIEW',
        'ACTION_PLANNED',
        'MONITORING',
        'RESOLVED',
        'REOPENED',
        'active',
        'under_review',
        'resolved',
        'dismissed',
      ],
      default: 'DETECTED',
      index: true,
    },

    // Administrative audit trail
    adminActions: [AdminActionSchema],

    // Whether authorities have been alerted
    authorityAlerted: { type: Boolean, default: false },
    alertedAt: { type: Date, default: null },
    alertRecipient: { type: String, default: '' },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RecurringIssueSchema.index({ ward: 1, category: 1, status: 1 });
RecurringIssueSchema.index({ status: 1, severity: 1 });
RecurringIssueSchema.index({ centerLatitude: 1, centerLongitude: 1 });
RecurringIssueSchema.index({ departmentName: 1, status: 1 });

RecurringIssueSchema.statics.generateHotspotId = async function () {
  const count = await this.countDocuments();
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, '0');
  return `HOT-${year}-${seq}`;
};

module.exports = mongoose.model('RecurringIssue', RecurringIssueSchema);
