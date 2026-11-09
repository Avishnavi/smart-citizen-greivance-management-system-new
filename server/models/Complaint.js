'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const LocationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  ward: { type: String, default: '' },
  zone: { type: String, default: '' },
  landmark: { type: String, default: '' },
}, { _id: false });

const DuplicateAnalysisSchema = new mongoose.Schema({
  isDuplicate: { type: Boolean, default: false },
  duplicateLevel: {
    type: String,
    enum: ['likely_duplicate', 'related', 'none'],
    default: 'none',
  },
  duplicateComplaintIds: [{ type: String }],
  similarityScore: { type: Number, default: 0 },
  distanceMeters: { type: Number },
  reason: { type: String, default: '' },
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

const AdminApprovalSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'clarification_required'],
      default: 'pending',
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, default: '' },
    reviewedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
  },
  { _id: false }
);

const DepartmentRefSchema = new mongoose.Schema(
  {
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    departmentName: { type: String, required: true },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const MultiDepartmentSchema = new mongoose.Schema(
  {
    primary: { type: DepartmentRefSchema, default: null },
    supporting: [DepartmentRefSchema],
  },
  { _id: false }
);

const LLMAnalysisSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'not_configured'],
    default: 'pending',
  },
  summary: { type: String },
  issueType: { type: String },
  affectedService: { type: String },
  requestedAction: { type: String },
  urgencyIndicators: [{ type: String }],
  extractedLocation: { type: String },
  extractedEntities: [{ type: String }],
  contextualDetails: [{ type: String }],
  confidence: { type: Number },
  provider: { type: String, default: null }, // e.g., 'openai', 'gemini', null
  method: { type: String, default: 'heuristic_fallback' },
  processedAt: { type: Date },
}, { _id: false });

// ─── 14-Stage Complete Lifecycle Statuses ──────────────────────────────────────

const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'AI_PROCESSING',
  'AWAITING_ADMIN_REVIEW',
  'CLARIFICATION_REQUIRED',
  'REJECTED',
  'APPROVED',
  'DEPARTMENT_ASSIGNMENT',
  'IN_PROGRESS',
  'PARTIALLY_RESOLVED',
  'AWAITING_VERIFICATION',
  'REQUIRES_REVIEW',
  'RESOLVED',
  'CLOSED',
  'REOPENED',

  // Legacy & Alias Compatibility
  'UNDER_REVIEW',
  'Under Review',
  'UNDER_ANALYSIS',
  'CATEGORIZED',
  'PRIORITIZED',
  'ROUTED',
  'ASSIGNED',
  'RESOLUTION_SUBMITTED',
  'UNDER_VERIFICATION',
  'VERIFIED',
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
    citizenRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

    // Central Admin Governance & Approval
    adminApproval: { type: AdminApprovalSchema, default: () => ({ status: 'pending' }) },

    // Multi-Department Coordination & Tasks
    departments: { type: MultiDepartmentSchema, default: () => ({ primary: null, supporting: [] }) },
    taskCount: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },

    // Routing / Assignment (Preserved for compatibility)
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
    closedAt: { type: Date },

    // Citizen feedback
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      tags: [{ type: String }],
      submittedAt: { type: Date },
    },

    // Citizen clarification response
    clarificationResponse: {
      responseNotes: { type: String, default: '' },
      additionalImageUrls: [{ type: String }],
      respondedAt: { type: Date },
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
ComplaintSchema.index({ citizenRef: 1, createdAt: -1 });
ComplaintSchema.index({ 'routing.departmentId': 1, status: 1 });
ComplaintSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
ComplaintSchema.index({ expectedResolutionTime: 1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────

ComplaintSchema.virtual('tasks', {
  ref: 'ComplaintTask',
  localField: 'complaintId',
  foreignField: 'complaintId',
});

// ─── Statics ─────────────────────────────────────────────────────────────────

ComplaintSchema.statics.generateComplaintId = async function () {
  const year = new Date().getFullYear();
  const complaints = await this.find({ complaintId: new RegExp(`^CMP-${year}-`) }, { complaintId: 1 })
    .sort({ complaintId: -1 })
    .limit(20);

  let maxSeq = 1000;
  for (const c of complaints) {
    if (c.complaintId) {
      const parts = c.complaintId.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `CMP-${year}-${String(nextSeq).padStart(6, '0')}`;
  while (await this.exists({ complaintId: candidate })) {
    nextSeq++;
    candidate = `CMP-${year}-${String(nextSeq).padStart(6, '0')}`;
  }
  return candidate;
};

module.exports = mongoose.model('Complaint', ComplaintSchema);
