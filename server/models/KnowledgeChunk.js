'use strict';

const mongoose = require('mongoose');

/**
 * KnowledgeChunk — segmented passage from a KnowledgeDocument for RAG retrieval.
 * Preserves parent-document reference, chunk sequence index, section headings, and vector embeddings.
 */
const KnowledgeChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgeDocument',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    sectionHeading: {
      type: String,
      default: '',
      trim: true,
    },
    pageReference: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: '',
      index: true,
      trim: true,
    },
    applicableCategories: [
      {
        type: String,
        index: true,
      },
    ],
    applicableSubcategories: [
      {
        type: String,
      },
    ],
    documentType: {
      type: String,
      default: 'guideline',
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    recommendedActions: [
      {
        type: String,
      },
    ],
    precautions: [
      {
        type: String,
      },
    ],
    tokenCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      default: null,
    },
    embeddingModel: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

KnowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
KnowledgeChunkSchema.index({ department: 1, applicableCategories: 1 });
KnowledgeChunkSchema.index({ active: 1, isDeleted: 1, approvalStatus: 1 });
KnowledgeChunkSchema.index({ isPublic: 1, active: 1, isDeleted: 1 });

module.exports = mongoose.model('KnowledgeChunk', KnowledgeChunkSchema);
