'use strict';

const mongoose = require('mongoose');

/**
 * WorkflowEvent — immutable audit trail.
 * Every status change, AI step, assignment, etc. creates a new event document.
 * Events are NEVER updated after creation.
 */
const WorkflowEventSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        'COMPLAINT_SUBMITTED',
        'LLM_ANALYSIS_STARTED',
        'LLM_ANALYSIS_COMPLETED',
        'LLM_ANALYSIS_FAILED',
        'CATEGORY_ASSIGNED',
        'DUPLICATE_CHECK_STARTED',
        'DUPLICATE_CHECK_COMPLETED',
        'PRIORITY_PREDICTED',
        'DEPARTMENT_ROUTED',
        'OFFICER_ASSIGNED',
        'STATUS_CHANGED',
        'STATUS_UPDATED',
        'PROGRESS_NOTE_ADDED',
        'RESOLUTION_SUBMITTED',
        'RESOLUTION_VERIFICATION_STARTED',
        'RESOLUTION_VERIFICATION_COMPLETED',
        'ESCALATION_RISK_UPDATED',
        'RECURRING_ISSUE_FLAGGED',
        'CITIZEN_FEEDBACK_SUBMITTED',
        'COMPLAINT_CLOSED',
        'COMPLAINT_REJECTED',
        'SYSTEM_NOTE',
      ],
    },

    // Who performed this action
    actor: {
      type: { type: String, enum: ['citizen', 'officer', 'admin', 'system', 'ai'], default: 'system' },
      id: { type: String, default: 'system' },
      name: { type: String, default: 'System' },
    },

    // Lifecycle transition
    previousStatus: { type: String, default: null },
    newStatus: { type: String, default: null },

    // Human-readable event description
    description: { type: String, required: true },

    // Arbitrary additional data for this event
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    // Events are immutable — disable updates
    strict: true,
  }
);

WorkflowEventSchema.index({ complaintId: 1, createdAt: 1 });

module.exports = mongoose.model('WorkflowEvent', WorkflowEventSchema);
