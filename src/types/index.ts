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

export type UserRole = 'citizen' | 'officer' | 'admin';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department?: Department;
  ward?: string;
  zone?: string;
  avatar: string;
  designation?: string;
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
