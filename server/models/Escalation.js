'use strict';

const mongoose = require('mongoose');

/**
 * Escalation — predictive escalation tracking.
 * Research contribution: Predictive Escalation service.
 */
const EscalationSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    complaintCategory: { type: String, default: '' },
    ward: { type: String, default: '' },

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

    // Whether a supervisor has been notified
    supervisorNotified: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },

    assessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

EscalationSchema.index({ escalationRisk: 1, assessedAt: -1 });

module.exports = mongoose.model('Escalation', EscalationSchema);
