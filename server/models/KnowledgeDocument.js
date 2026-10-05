'use strict';

const mongoose = require('mongoose');

/**
 * KnowledgeDocument — RAG knowledge base.
 * Stores departmental procedures, resolution guidelines, SLA policies.
 */
const KnowledgeDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    department: { type: String, required: true },
    content: { type: String, required: true },
    source: { type: String, default: 'Municipal Corporation Manual' },
    documentType: {
      type: String,
      enum: ['procedure', 'guideline', 'sla_policy', 'resolution_standard', 'escalation_rule', 'civic_info'],
      default: 'guideline',
    },
    applicableCategories: [{ type: String }],
    version: { type: String, default: '1.0' },
    active: { type: Boolean, default: true },
    // Embedding vector — populated when embedding service is connected
    embedding: { type: [Number], default: null },
    embeddingModel: { type: String, default: null },
  },
  { timestamps: true }
);

KnowledgeDocumentSchema.index({ department: 1, applicableCategories: 1 });

module.exports = mongoose.model('KnowledgeDocument', KnowledgeDocumentSchema);
