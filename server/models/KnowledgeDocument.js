'use strict';

const mongoose = require('mongoose');

/**
 * KnowledgeDocument — RAG knowledge base.
 * Stores departmental procedures, resolution guidelines, SLA policies, and citizen charters.
 */
const KnowledgeDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    department: { type: String, required: true, trim: true, index: true },
    content: { type: String, required: true },
    source: { type: String, default: 'Municipal Corporation Manual', trim: true },
    documentType: {
      type: String,
      enum: ['procedure', 'guideline', 'sla_policy', 'resolution_standard', 'escalation_rule', 'civic_info'],
      default: 'guideline',
    },
    applicableCategories: [{ type: String, index: true }],
    applicableSubcategories: [{ type: String }],
    version: { type: String, default: '1.0' },
    approvalStatus: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    isPublic: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    recommendedActions: [{ type: String }],
    precautions: [{ type: String }],
    tags: [{ type: String }],
    approvedBy: { type: String, default: 'Central Admin' },
    approvedAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: 'Central Admin' },
    // Embedding vector — populated when embedding service is connected
    embedding: { type: [Number], default: null },
    embeddingModel: { type: String, default: null },
  },
  { timestamps: true }
);

KnowledgeDocumentSchema.index({ department: 1, applicableCategories: 1 });
KnowledgeDocumentSchema.index({ department: 1, active: 1, approvalStatus: 1, isDeleted: 1 });
KnowledgeDocumentSchema.index({ isPublic: 1, active: 1, approvalStatus: 1, isDeleted: 1 });

module.exports = mongoose.model('KnowledgeDocument', KnowledgeDocumentSchema);
