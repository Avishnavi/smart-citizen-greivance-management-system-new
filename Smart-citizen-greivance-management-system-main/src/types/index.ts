export type ComplaintStatus = 'Pending' | 'In Progress' | 'Resolved' | 'Rejected';

export type ComplaintPriority = 'Low' | 'Medium' | 'High';

export type ComplaintCategory =
  | 'Pothole'
  | 'Water Supply'
  | 'Drainage'
  | 'Streetlight'
  | 'Garbage'
  | 'Traffic'
  | 'Stray Animals'
  | 'Tree Fall'
  | 'Illegal Construction'
  | 'Air & Noise'
  | 'Other';

export type Department =
  | 'Roads & Bridges'
  | 'Road Maintenance Department'
  | 'Water Supply & Sewerage'
  | 'Water & Sewerage Board'
  | 'Solid Waste Management'
  | 'Street Lighting'
  | 'Electricity & Lighting Department'
  | 'Storm Water Drains'
  | 'Public Health'
  | 'Public Health & Sanitation'
  | 'Traffic & Transport Department'
  | 'Town Planning & Enforcement'
  | 'Horticulture & Parks';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address: string;
  ward?: string;
  zone?: string;
  landmark?: string;
}

export interface TimelineEvent {
  id: string;
  step: number;
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
  current: boolean;
  officerName?: string;
  department?: string;
  remarks?: string;
}

export interface CitizenFeedback {
  rating: number; // 1-5
  comment: string;
  tags?: string[];
  submittedAt: string;
}

export interface ComplaintResolution {
  resolvedAt: string;
  resolutionNotes: string;
  proofImageUrl?: string;
  officerName: string;
}

export type TaskStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED_FOR_VERIFICATION'
  | 'REQUIRES_ADDITIONAL_WORK'
  | 'AWAITING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'COMPLETED';

export type SlaStatus = 'ON_TRACK' | 'AT_RISK' | 'OVERDUE' | 'COMPLETED_WITHIN_SLA' | 'COMPLETED_AFTER_SLA';

export interface TaskDelayRisk {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  riskScore: number;
  contributingFactors: string[];
  recommendedAction?: string;
  predictedAt?: string;
  scoringMethod?: string;
  predictionStatus?: string;
}

export interface AutomatedResolutionAssessment {
  overallScore: number;
  verificationScore: number;
  verified: boolean;
  verificationStatus: 'verified' | 'requires_review' | 'insufficient_evidence';
  recommendation: 'APPROVE_RECOMMENDED' | 'HUMAN_REVIEW_REQUIRED' | 'REWORK_RECOMMENDED';
  factorScores?: {
    descriptionCompleteness?: { score: number; max: number; details: string };
    taskRelevance?: { score: number; max: number; details: string };
    evidenceAvailability?: { score: number; max: number; details: string };
    checklistCompliance?: { score: number; max: number; details: string };
    sopAlignment?: { score: number; max: number; details: string };
  };
  evidenceCompleteness?: 'adequate' | 'partial' | 'insufficient' | 'missing';
  taskRelevance?: 'high' | 'moderate' | 'low' | 'unrelated';
  missingRequirements?: string[];
  identifiedInconsistencies?: string[];
  sopGuidance?: {
    references?: Array<{
      documentId: string;
      title: string;
      source: string;
      department?: string;
      documentType?: string;
    }>;
    applicablePrecautions?: string[];
    disclaimer?: string;
  };
  explanation?: string;
  method?: string;
}

export interface SupervisorResolutionReview {
  decision: 'approved' | 'requires_additional_work' | 'rejected' | 'pending';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  comments: string;
  reworkRequirements?: string[];
}

export interface DepartmentTask {
  id?: string;
  _id?: string;
  taskId: string;
  complaintId: string;
  taskType: 'primary' | 'supporting';
  departmentName: Department | string;
  departmentId?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  status: TaskStatus | string;
  assignedSupervisorName?: string;
  assignedSupervisorId?: string;
  assignedEmployeeName?: string;
  assignedEmployeeId?: string;
  assignedAt?: string;
  slaHours?: number;
  slaDeadline?: string;
  slaBreached?: boolean;
  slaStatus?: SlaStatus;
  remainingHours?: number;
  elapsedHours?: number;
  elapsedPercentage?: number;
  isBreached?: boolean;
  isPaused?: boolean;
  delayRisk?: TaskDelayRisk;
  escalationLevel?: number;
  pauseHistory?: Array<{
    pausedAt: string;
    resumedAt?: string | null;
    pausedByName?: string;
    reason?: string;
  }>;
  progressNotes?: Array<{
    note: string;
    authorName: string;
    authorRole?: string;
    createdAt: string;
  }>;
  resolution?: {
    resolutionNotes?: string;
    evidenceUrls?: string[];
    actionsTaken?: string[];
    verificationStatus?: 'pending' | 'verified' | 'requires_review' | 'insufficient_evidence' | 'rejected';
    verificationScore?: number;
    verificationReason?: string;
    verifiedAt?: string;
    automatedAssessment?: AutomatedResolutionAssessment;
    supervisorReview?: SupervisorResolutionReview;
  };
  resolutionHistory?: Array<{
    resolutionNotes?: string;
    evidenceUrls?: string[];
    actionsTaken?: string[];
    verificationStatus?: string;
    verificationScore?: number;
    verificationReason?: string;
    verifiedAt?: string;
    automatedAssessment?: AutomatedResolutionAssessment;
    supervisorReview?: SupervisorResolutionReview;
  }>;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Complaint {
  id: string;
  userId: string;
  description: string;
  voiceUrl?: string;
  voiceDuration?: number;
  imageUrls?: string[];
  category: ComplaintCategory;
  department: Department;
  location: LocationCoords;
  duplicateStatus: 'none' | 'possible_duplicate' | 'merged' | 'confirmed_new';
  similarComplaintId?: string;
  similarityScore?: number;
  priority: ComplaintPriority;
  priorityScore?: number;
  priorityFactors?: string[];
  status: ComplaintStatus;
  assignedOfficer?: string;
  escalated?: boolean;
  escalatedAt?: string;
  escalationReason?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  resolution?: ComplaintResolution;
  feedback?: CitizenFeedback;

  // Phase 2: Multi-Department Tasks & Admin Governance
  adminApproval?: {
    status: 'pending' | 'approved' | 'rejected' | 'clarification_required';
    reviewedAt?: string;
    reviewedBy?: string;
    adminNotes?: string;
    rejectionReason?: string;
  };
  departments?: {
    primary?: { departmentId?: string; departmentName: string; description?: string };
    supporting?: Array<{ departmentId?: string; departmentName: string; reason?: string }>;
  };
  primaryDepartment?: {
    departmentId?: string;
    departmentName: string;
    description?: string;
  };
  supportingDepartments?: Array<{
    departmentId?: string;
    departmentName: string;
    reason?: string;
  }>;
  taskCount?: number;
  tasksCompleted?: number;
  tasks?: DepartmentTask[];
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  similarComplaintId?: string;
  similarityScore?: number; // 0.0 to 1.0
  distanceMeters?: number;
  existingComplaint?: Complaint;
  recommendation: string;
}

export interface AIClassificationResult {
  category: ComplaintCategory;
  confidence: number;
  department: Department;
  suggestedKeywords: string[];
  aiSummary: string;
}

export interface PriorityPredictionResult {
  priority: ComplaintPriority;
  score: number; // 1-100
  factors: string[];
}

export interface AIAnalysisResult {
  classification: AIClassificationResult;
  priority: PriorityPredictionResult;
  duplicate: DuplicateDetectionResult;
  processingTimeMs: number;
}

export type UserRole =
  | 'citizen'
  | 'central_admin'
  | 'department_supervisor'
  | 'department_employee'
  | 'admin'
  | 'officer';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  department?: Department;
  ward?: string;
  zone?: string;
  avatar?: string;
  designation?: string;
  citizenId?: string;
  employeeId?: string;
  preferredLanguage?: string;
}

export interface CitizenProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  ward: string;
  zone: string;
  avatar: string;
  preferredLanguage: string;
  notificationPreferences: {
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
    push: boolean;
  };
}

export interface NotificationItem {
  id: string;
  complaintId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'status_change' | 'assigned' | 'resolved' | 'reminder' | 'announcement';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  options?: string[];
  timestamp: string;
}

export interface OfficialComplaintMessage {
  _id: string;
  complaintId: string;
  taskId?: string | null;
  departmentId?: string | null;
  departmentName?: string;
  senderId: string;
  senderName: string;
  senderRole: 'citizen' | 'central_admin' | 'department_supervisor' | 'department_employee';
  messageType: 'citizen_inquiry' | 'admin_clarification_request' | 'citizen_clarification_response' | 'internal_staff_note' | 'status_update';
  message: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintAssociatedDepartment {
  departmentId: string;
  departmentName: string;
  code: string;
  description?: string;
  isPrimary: boolean;
  reason?: string;
  taskCount: number;
  tasks?: Array<{
    taskId: string;
    status: string;
    assignedEmployeeName?: string;
  }>;
  messageCount: number;
}

export interface AssistantResponse {
  message: string;
  suggestedOptions?: string[];
  refinedDescription?: string;
  detectedCategoryHint?: ComplaintCategory;
}

export interface CivicAlert {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  date: string;
  affectedZones: string[];
}

export interface KnowledgeReference {
  documentId: string;
  chunkId?: string;
  title: string;
  source: string;
  department: string;
  documentType: string;
  applicableCategories: string[];
  sectionHeading?: string;
  pageReference?: string;
  relevanceScore: number;
  isPublic: boolean;
  version?: string;
}

export interface KnowledgeGuidance {
  found: boolean;
  guidanceType?: string;
  isOfficialInstruction?: boolean;
  summary: string;
  recommendedActions: string[];
  precautions: string[];
  references: KnowledgeReference[];
  topRelevanceScore?: number;
  retrievalMethod?: string;
  accessDenied?: boolean;
  audit?: {
    complaintId?: string;
    taskId?: string;
    requestedBy: string;
    userRole: string;
    targetDepartment: string;
    retrievedAt: string;
    found: boolean;
    referenceCount: number;
  };
}

export interface KnowledgeDocument {
  _id: string;
  title: string;
  description?: string;
  department: string;
  content: string;
  source?: string;
  documentType: 'procedure' | 'guideline' | 'sla_policy' | 'resolution_standard' | 'escalation_rule' | 'civic_info';
  applicableCategories?: string[];
  applicableSubcategories?: string[];
  version?: string;
  approvalStatus: 'draft' | 'under_review' | 'approved' | 'rejected';
  isPublic: boolean;
  active: boolean;
  recommendedActions?: string[];
  precautions?: string[];
  tags?: string[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HotspotStatus =
  | 'DETECTED'
  | 'UNDER_REVIEW'
  | 'ACTION_PLANNED'
  | 'MONITORING'
  | 'RESOLVED'
  | 'REOPENED';

export type TemporalTrendClassification =
  | 'INCREASING'
  | 'DECREASING'
  | 'STABLE'
  | 'INSUFFICIENT_DATA';

export interface HotspotAdminAction {
  action: string;
  performedBy: string;
  performedByRole: string;
  notes?: string;
  timestamp: string;
}

export interface RecurringIssueHotspot {
  _id: string;
  hotspotId?: string;
  clusterId?: number;
  category: string;
  subcategory?: string;
  departmentName?: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
    ward?: string;
    zone?: string;
    radiusMeters: number;
  };
  complaintCount: number;
  observationWindowDays?: number;
  clusteringMethod?: string;
  clusteringParams?: {
    epsilonMeters: number;
    minComplaints: number;
  };
  temporalTrend?: {
    classification: TemporalTrendClassification;
    currentPeriodCount: number;
    previousPeriodCount: number;
    percentageChange: number;
    dailyBreakdown?: Array<{ date: string; count: number }>;
    weeklyBreakdown?: Array<{ week: string; count: number }>;
    monthlyBreakdown?: Array<{ month: string; count: number }>;
  };
  status: HotspotStatus;
  preventiveActionPlan?: {
    proposedAction?: string;
    responsibleDepartment?: string;
    targetCompletionDate?: string;
    budgetEstimated?: number;
    planApprovedBy?: string;
  };
  adminActions?: HotspotAdminAction[];
  complaints?: string[];
  firstReportedAt?: string;
  lastReportedAt?: string;
  detectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HotspotMetrics {
  totalHotspots: number;
  activeHotspots: number;
  underReviewHotspots: number;
  increasingHotspots: number;
  categoryBreakdown: Array<{
    category: string;
    hotspotCount: number;
    totalComplaints: number;
  }>;
  wardBreakdown: Array<{
    ward: string;
    hotspotCount: number;
    totalComplaints: number;
  }>;
  trendBreakdown: Array<{
    trend: string;
    count: number;
  }>;
}
