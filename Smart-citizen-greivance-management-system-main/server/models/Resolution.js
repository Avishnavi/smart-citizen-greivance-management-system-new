'use strict';

const mongoose = require('mongoose');

const ResolutionSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    officerName: { type: String, default: '' },
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
      enum: ['ai', 'officer', 'supervisor', 'pending'],
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resolution', ResolutionSchema);
