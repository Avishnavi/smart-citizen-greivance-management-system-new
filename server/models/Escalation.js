'use strict';

const mongoose = require('mongoose');

/**
 * Escalation — predictive escalation tracking.
 * Research contribution: Predictive Escalation service.
 */
const EscalationSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    taskId: { type: String, default: null, index: true },
    complaintCategory: { type: String, default: '' },
    departmentName: { type: String, default: '' },
    ward: { type: String, default: '' },

    triggerCondition: {
      type: String,
      enum: ['SLA_BREACH', 'APPROACHING_BREACH_75', 'PREDICTED_DELAY_HIGH', 'ADMIN_MANUAL', 'REWORK_EXCESSIVE'],
      default: 'SLA_BREACH',
    },
    recipientRole: {
      type: String,
      enum: ['department_employee', 'department_supervisor', 'central_admin', 'all'],
      default: 'department_supervisor',
    },

    escalationRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    escalationLevel: { type: Number, default: 0 },

    // Inputs used for prediction
    elapsedHours: { type: Number },
    expectedResolutionHours: { type: Number },
    priority: { type: String },
    currentStatus: { type: String },

    // Prediction output
    predictedDelayHours: { type: Number, default: null },
    reasons: [{ type: String }],
    recommendedAction: { type: String, default: '' },

    // Status of the prediction service
    predictionStatus: {
      type: String,
      enum: ['pending', 'completed', 'model_not_configured'],
      default: 'pending',
    },

    // Whether action was taken or resolved
    actionTaken: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },

    // Acknowledgment lifecycle
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedByName: { type: String, default: '' },

    // Whether a supervisor has been notified
    supervisorNotified: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },

    assessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

EscalationSchema.index({ escalationRisk: 1, assessedAt: -1 });
EscalationSchema.index({ complaintId: 1, taskId: 1 });

module.exports = mongoose.model('Escalation', EscalationSchema);
