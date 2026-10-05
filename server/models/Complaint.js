'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const LocationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  ward: { type: String, default: '' },
  zone: { type: String, default: '' },
  landmark: { type: String, default: '' },
}, { _id: false });

const DuplicateAnalysisSchema = new mongoose.Schema({
  isDuplicate: { type: Boolean, default: false },
  duplicateComplaintIds: [{ type: String }],
  similarityScore: { type: Number, default: 0 },
  distanceMeters: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'checked', 'confirmed_duplicate', 'confirmed_new'],
    default: 'pending',
  },
}, { _id: false });

const RoutingSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  departmentName: { type: String, default: '' },
  assignedOfficerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  assignedOfficerName: { type: String, default: '' },
  routingReason: { type: String, default: '' },
  routedAt: { type: Date },
}, { _id: false });

const LLMAnalysisSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'not_configured'],
    default: 'pending',
  },
  summary: { type: String },
  issueType: { type: String },
  affectedService: { type: String },
  urgencyIndicators: [{ type: String }],
  extractedLocation: { type: String },
  extractedEntities: [{ type: String }],
  confidence: { type: Number },
  provider: { type: String, default: null }, // e.g., 'openai', 'gemini', null
  processedAt: { type: Date },
}, { _id: false });

// ─── 12-Stage Status Lifecycle ───────────────────────────────────────────────

const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'Under Review',
  'UNDER_ANALYSIS',
  'CATEGORIZED',
  'PRIORITIZED',
  'ROUTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLUTION_SUBMITTED',
  'UNDER_VERIFICATION',
  'VERIFIED',
  'CLOSED',
  'REQUIRES_REVIEW',
  'REJECTED',
  'Pending',
  'In Progress',
  'Resolved',
  'Rejected',
];

// ─── Main Complaint Schema ───────────────────────────────────────────────────

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    citizenId: {
      type: String,
      required: true,
      index: true,
    },

    // Input
    originalText: { type: String, default: '' },
    language: { type: String, default: 'English' },
    inputType: {
      type: String,
      enum: ['text', 'voice', 'image', 'text+voice', 'text+image', 'voice+image', 'text+voice+image'],
      default: 'text',
    },
    hasVoice: { type: Boolean, default: false },
    voiceUrl: { type: String },
    voiceDuration: { type: Number },
    imageUrls: [{ type: String }],

    // Structured complaint content
    description: { type: String, required: true },

    // Location
    location: { type: LocationSchema, required: true },

    // AI Analysis
    llmAnalysis: { type: LLMAnalysisSchema, default: () => ({ status: 'pending' }) },

    // Classification
    category: {
      type: String,
      enum: [
        'Pothole', 'Water Supply', 'Drainage', 'Streetlight',
        'Garbage', 'Traffic', 'Stray Animals', 'Tree Fall',
        'Illegal Construction', 'Air & Noise', 'Other',
      ],
      default: 'Other',
    },
    subcategory: { type: String, default: '' },
    categorizationStatus: {
      type: String,
      enum: ['pending', 'completed', 'manual'],
      default: 'pending',
    },

    // Priority
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    priorityScore: { type: Number, min: 0, max: 100, default: 50 },
    priorityReason: { type: String, default: '' },
    priorityFactors: [{ type: String }],
    priorityStatus: {
      type: String,
      enum: ['pending', 'completed', 'manual'],
      default: 'pending',
    },

    // Duplicate Detection
    duplicateAnalysis: { type: DuplicateAnalysisSchema, default: () => ({}) },

    // Routing / Assignment
    routing: { type: RoutingSchema, default: () => ({}) },

    // Status & Workflow
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },
    workflowStage: { type: String, default: 'SUBMITTED' },

    // Resolution reference
    resolutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resolution' },

    // Escalation
    escalationRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    escalationLevel: { type: Number, default: 0 },

    // Recurring issue reference
    recurringIssueId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringIssue' },

    // Timing
    expectedResolutionTime: { type: Date },
    actualResolutionTime: { type: Date },

    // Citizen feedback
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      tags: [{ type: String }],
      submittedAt: { type: Date },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

ComplaintSchema.index({ 'location.ward': 1, category: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, priority: 1 });
ComplaintSchema.index({ citizenId: 1, createdAt: -1 });
ComplaintSchema.index({ 'routing.departmentId': 1, status: 1 });

// ─── Statics ─────────────────────────────────────────────────────────────────

ComplaintSchema.statics.generateComplaintId = async function () {
  const year = new Date().getFullYear();
  const count = await this.countDocuments();
  const seq = String(count + 1001).padStart(6, '0');
  return `CMP-${year}-${seq}`;
};

module.exports = mongoose.model('Complaint', ComplaintSchema);
