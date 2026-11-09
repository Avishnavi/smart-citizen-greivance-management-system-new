'use strict';

const mongoose = require('mongoose');

const TASK_STATUSES = [
  'PENDING',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'SUBMITTED_FOR_VERIFICATION',
  'REQUIRES_REVIEW',
  'AWAITING_REVIEW',
  'INSUFFICIENT_EVIDENCE',
  'REQUIRES_ADDITIONAL_WORK',
  'VERIFIED',
  'COMPLETED',
  'REJECTED',
  'ESCALATED',
  'REOPENED',
];

const TaskAssignmentHistorySchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String, required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supervisorName: { type: String, default: '' },
    assignedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    action: {
      type: String,
      enum: ['initial_assignment', 'reassignment', 'delegation'],
      default: 'initial_assignment',
    },
  },
  { _id: true }
);

const ProgressNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, default: 'Department Staff' },
    authorRole: { type: String, default: 'department_employee' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TaskResolutionSchema = new mongoose.Schema(
  {
    resolutionNotes: { type: String, default: '' },
    evidenceUrls: [{ type: String }],
    actionsTaken: [{ type: String }],
    submittedAt: { type: Date },
    submittedBy: { type: String, default: '' },
    submittedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'requires_review', 'insufficient_evidence', 'rejected'],
      default: 'pending',
    },
    verificationScore: { type: Number, default: 0 },
    verificationReason: { type: String, default: '' },
    verifiedAt: { type: Date },
    verifierType: { type: String, default: 'ai' }, // 'ai' or 'supervisor' or 'admin'

    // Multi-factor automated assessment breakdown (M12)
    automatedAssessment: {
      overallScore: { type: Number, default: 0 },
      factorScores: {
        descriptionCompleteness: { score: Number, max: Number, details: String },
        taskRelevance: { score: Number, max: Number, details: String },
        evidenceAvailability: { score: Number, max: Number, details: String },
        checklistCompliance: { score: Number, max: Number, details: String },
        sopAlignment: { score: Number, max: Number, details: String },
      },
      evidenceCompleteness: { type: String, default: 'insufficient' },
      taskRelevance: { type: String, default: 'moderate' },
      missingRequirements: [{ type: String }],
      identifiedInconsistencies: [{ type: String }],
      recommendation: { type: String, default: 'HUMAN_REVIEW_REQUIRED' },
      explanation: { type: String, default: '' },
      sopGuidance: {
        references: [{ type: mongoose.Schema.Types.Mixed }],
        applicablePrecautions: [{ type: String }],
        disclaimer: { type: String, default: '' },
      },
      method: { type: String, default: 'evidence_based_multidimensional_rubric' },
    },

    // Department Supervisor Human Verification
    supervisorReview: {
      decision: {
        type: String,
        enum: ['approved', 'verified', 'requires_additional_work', 'rejected', 'pending', 'VERIFIED', 'APPROVED', 'REQUIRES_ADDITIONAL_WORK', 'REJECTED'],
        default: 'pending',
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedByName: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
      comments: { type: String, default: '' },
      reworkRequirements: [{ type: String }],
    },
  },
  { _id: false }
);

const ComplaintTaskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    complaintId: {
      type: String,
      required: true,
      index: true,
    },
    complaintRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      index: true,
    },
    taskType: {
      type: String,
      enum: ['primary', 'supporting'],
      default: 'primary',
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    departmentName: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'PENDING_ASSIGNMENT',
      index: true,
    },
    assignedSupervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedSupervisorName: {
      type: String,
      default: '',
    },
    assignedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedEmployeeName: {
      type: String,
      default: '',
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    slaHours: {
      type: Number,
      default: 72,
    },
    slaDeadline: {
      type: Date,
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    slaStatus: {
      type: String,
      enum: ['ON_TRACK', 'AT_RISK', 'OVERDUE', 'COMPLETED_WITHIN_SLA', 'COMPLETED_AFTER_SLA'],
      default: 'ON_TRACK',
      index: true,
    },
    delayRisk: {
      riskLevel: {
        type: String,
        enum: ['LOW', 'MODERATE', 'HIGH'],
        default: 'LOW',
      },
      riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      contributingFactors: [{ type: String }],
      recommendedAction: { type: String, default: '' },
      predictedAt: { type: Date, default: null },
      scoringMethod: { type: String, default: 'feature_weighted_risk_baseline' },
      predictionStatus: { type: String, default: 'preliminary_rule_based' },
    },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    pauseHistory: [
      {
        pausedAt: { type: Date, default: Date.now },
        resumedAt: { type: Date, default: null },
        pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        pausedByName: { type: String, default: '' },
        reason: { type: String, default: '' },
        pausedDurationMs: { type: Number, default: 0 },
      },
    ],
    progressNotes: [ProgressNoteSchema],
    assignmentHistory: [TaskAssignmentHistorySchema],
    resolution: {
      type: TaskResolutionSchema,
      default: () => ({}),
    },
    resolutionHistory: [TaskResolutionSchema],
    resolutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resolution',
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ComplaintTaskSchema.index({ complaintId: 1, departmentName: 1 });
ComplaintTaskSchema.index({ departmentName: 1, status: 1 });
ComplaintTaskSchema.index({ assignedEmployeeId: 1, status: 1 });
ComplaintTaskSchema.index({ assignedSupervisorId: 1, status: 1 });
ComplaintTaskSchema.index({ slaDeadline: 1, status: 1 });

/**
 * Generate unique task ID: TSK-<complaintId>-<sequence>
 */
ComplaintTaskSchema.statics.generateTaskId = async function (complaintId, sequence = 1) {
  const cleanCmp = complaintId.replace('CMP-', '');
  const seqStr = String(sequence).padStart(2, '0');
  return `TSK-${cleanCmp}-${seqStr}`;
};

module.exports = mongoose.model('ComplaintTask', ComplaintTaskSchema);

