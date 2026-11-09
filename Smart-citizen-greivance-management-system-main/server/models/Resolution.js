'use strict';

const mongoose = require('mongoose');

const ResolutionSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    taskId: { type: String, default: null, index: true },
    taskRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplaintTask', default: null, index: true },
    officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    officerName: { type: String, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    employeeName: { type: String, default: '' },
    departmentName: { type: String, default: '' },

    // What the officer reported
    resolutionNotes: { type: String, required: true },
    actionsTaken: [{ type: String }],
    evidenceUrls: [{ type: String }],

    // RAG knowledge used
    knowledgeDocumentsUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeDocument' }],

    // Verification result — populated by resolutionVerificationService
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'requires_review', 'insufficient_evidence', 'failed'],
      default: 'pending',
    },
    verificationScore: { type: Number, min: 0, max: 1, default: null },
    verificationReason: { type: String, default: '' },
    verifierType: {
      type: String,
      enum: ['ai', 'officer', 'supervisor', 'pending', 'pending_supervisor_review'],
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },

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

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ResolutionSchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model('Resolution', ResolutionSchema);
