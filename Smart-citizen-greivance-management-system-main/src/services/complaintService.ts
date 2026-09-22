import type {
  Complaint,
  CitizenFeedback,
  ComplaintCategory,
  Department,
  LocationCoords,
  ComplaintPriority,
  AIAnalysisResult,
  TimelineEvent,
} from '../types';
import { fetchApi } from './api';
import { INITIAL_COMPLAINTS } from '../mock/complaints';
import { runFullAIAnalysis } from './aiService';

export interface CreateComplaintInput {
  citizenId?: string;
  userId?: string;
  description: string;
  originalText?: string;
  language?: string;
  inputType?: string;
  hasVoice?: boolean;
  voiceUrl?: string;
  voiceDuration?: number;
  imageUrls?: string[];
  category: ComplaintCategory;
  department?: Department;
  location: LocationCoords;
  duplicateStatus?: string;
  similarComplaintId?: string;
  similarityScore?: number;
  priority: ComplaintPriority;
  priorityScore?: number;
  priorityFactors?: string[];
}

export interface DashboardStatistics {
  totalComplaints: number;
  pendingComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  highPriorityComplaints: number;
  resolutionRate: number;
  recurringIssuesActive: number;
  criticalEscalations: number;
  categoryBreakdown: { category: string; count: number }[];
  wardBreakdown: { ward: string; count: number }[];
}

/**
 * Normalizes backend MongoDB complaint format to the frontend Complaint interface
 */
function normalizeComplaint(c: any): Complaint {
  const statusMap: Record<string, any> = {
    SUBMITTED: 'Pending',
    UNDER_ANALYSIS: 'Pending',
    CATEGORIZED: 'Pending',
    PRIORITIZED: 'Pending',
    ROUTED: 'Pending',
    ASSIGNED: 'Pending',
    IN_PROGRESS: 'In Progress',
    RESOLUTION_SUBMITTED: 'In Progress',
    UNDER_VERIFICATION: 'In Progress',
    VERIFIED: 'Resolved',
    CLOSED: 'Resolved',
    RESOLVED: 'Resolved',
    REQUIRES_REVIEW: 'In Progress',
    REJECTED: 'Rejected',
  };

  const priorityMap: Record<string, any> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'High',
  };

  return {
    id: c.complaintId || c.id || c._id,
    userId: c.citizenId || c.userId || 'CIT-8842',
    description: c.description || c.originalText || '',
    voiceUrl: c.voiceUrl,
    voiceDuration: c.voiceDuration,
    imageUrls: c.imageUrls || [],
    category: c.category || 'Other',
    department: (c.routing?.departmentName || c.department || 'Public Health & Sanitation') as Department,
    location: c.location || {
      latitude: 13.085,
      longitude: 80.2101,
      address: 'Anna Nagar, Chennai',
      ward: 'Ward 102',
      zone: 'Zone 8',
    },
    duplicateStatus:
      c.duplicateAnalysis?.isDuplicate ? 'possible_duplicate' : (c.duplicateStatus || 'none'),
    similarComplaintId:
      c.duplicateAnalysis?.duplicateComplaintIds?.[0] || c.similarComplaintId,
    similarityScore: c.duplicateAnalysis?.similarityScore || c.similarityScore,
    priority: (priorityMap[c.priority] || c.priority || 'Medium') as ComplaintPriority,
    priorityScore: c.priorityScore || 70,
    priorityFactors: c.priorityFactors || ['Standard Citizen Grievance SLA'],
    status: (statusMap[c.status] || c.status || 'Pending'),
    createdAt: c.createdAt || new Date().toISOString(),
    updatedAt: c.updatedAt || new Date().toISOString(),
    timeline: (c.timeline || []).map((t: any, idx: number) => ({
      id: t.id || t._id || `t-${idx}`,
      step: t.step || idx + 1,
      title: t.title || t.eventType || 'Status Update',
      description: t.description || '',
      timestamp: t.timestamp || t.createdAt || 'Pending',
      completed: Boolean(t.completed || t.createdAt),
      current: Boolean(t.current),
      officerName: t.officerName || t.actor?.name,
      department: t.department,
    })),
    resolution: c.resolutionId
      ? {
          resolvedAt: c.actualResolutionTime || c.updatedAt,
          resolutionNotes: c.resolution?.resolutionNotes || 'Resolution completed',
          officerName: c.resolution?.officerName || 'Field Supervisor',
          proofImageUrl: c.resolution?.evidenceUrls?.[0],
        }
      : c.resolution,
    feedback: c.feedback,
  };
}

/**
 * Fetch all complaints from backend REST API
 */
export async function fetchAllComplaints(citizenId?: string): Promise<Complaint[]> {
  try {
    const query = citizenId ? `?citizenId=${encodeURIComponent(citizenId)}` : '';
    const data = await fetchApi<any[]>(`/complaints${query}`);
    return Array.isArray(data) ? data.map(normalizeComplaint) : [];
  } catch (err) {
    console.warn('API fetchAllComplaints failed — falling back to initial data:', err);
    return INITIAL_COMPLAINTS;
  }
}

/**
 * Fetch single complaint by ID
 */
export async function fetchComplaintById(id: string): Promise<Complaint | null> {
  try {
    const data = await fetchApi<any>(`/complaints/${encodeURIComponent(id)}`);
    return data ? normalizeComplaint(data) : null;
  } catch (err) {
    console.warn(`API fetchComplaintById(${id}) failed — searching local cache:`, err);
    const found = INITIAL_COMPLAINTS.find(
      (c) => c.id.toLowerCase() === id.trim().toLowerCase()
    );
    return found || null;
  }
}

/**
 * Fetch live timeline events for a complaint
 */
export async function fetchComplaintTimeline(id: string): Promise<TimelineEvent[]> {
  try {
    const data = await fetchApi<any[]>(`/complaints/${encodeURIComponent(id)}/timeline`);
    if (Array.isArray(data) && data.length > 0) {
      return data.map((e: any, index: number) => ({
        id: e._id || `event-${index}`,
        step: index + 1,
        title: e.eventType.replace(/_/g, ' '),
        description: e.description,
        timestamp: new Date(e.createdAt).toLocaleString(),
        completed: true,
        current: index === data.length - 1,
        officerName: e.actor?.name,
      }));
    }
    return [];
  } catch (err) {
    console.warn(`Failed to fetch timeline for ${id}:`, err);
    return [];
  }
}

/**
 * Submit a new complaint to the backend
 */
export async function createNewComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const priorityUpper = (input.priority || 'MEDIUM').toUpperCase();

  const payload = {
    citizenId: input.citizenId || input.userId || 'CIT-8842',
    description: input.description,
    originalText: input.originalText || input.description,
    language: input.language || 'English',
    inputType: input.hasVoice && input.imageUrls?.length ? 'text+voice+image' : input.hasVoice ? 'voice' : input.imageUrls?.length ? 'image' : 'text',
    hasVoice: Boolean(input.hasVoice),
    voiceDuration: input.voiceDuration,
    imageUrls: input.imageUrls || [],
    category: input.category || 'Other',
    priority: priorityUpper,
    location: input.location,
  };

  try {
    const res = await fetchApi<any>('/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeComplaint(res);
  } catch (err) {
    console.warn('API createNewComplaint failed — using client generator:', err);
    const nextNum = 1246 + Math.floor(Math.random() * 100);
    const newId = `CMP-2026-00${nextNum}`;
    const now = new Date().toISOString();

    return {
      id: newId,
      userId: input.userId || 'CIT-8842',
      description: input.description,
      voiceUrl: input.voiceUrl,
      voiceDuration: input.voiceDuration,
      imageUrls: input.imageUrls || [],
      category: input.category,
      department: input.department || 'Public Health & Sanitation',
      location: input.location,
      duplicateStatus: (input.duplicateStatus as any) || 'none',
      priority: input.priority,
      priorityScore: input.priorityScore || 70,
      priorityFactors: input.priorityFactors || ['Standard Citizen Grievance SLA'],
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          id: `t-${Date.now()}-1`,
          step: 1,
          title: 'Complaint Submitted',
          description: 'Successfully registered via Citizen Grievance Portal.',
          timestamp: now,
          completed: true,
          current: false,
        },
        {
          id: `t-${Date.now()}-2`,
          step: 2,
          title: 'AI Analysis Completed',
          description: `Classified as ${input.category} with ${input.priority} Priority.`,
          timestamp: now,
          completed: true,
          current: true,
        },
      ],
    };
  }
}

/**
 * Submit feedback on a resolved complaint
 */
export async function submitCitizenFeedback(
  id: string,
  feedback: CitizenFeedback
): Promise<Complaint> {
  try {
    const res = await fetchApi<any>(`/complaints/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
    return normalizeComplaint(res);
  } catch (err) {
    console.warn('API submitCitizenFeedback failed:', err);
    throw err;
  }
}

/**
 * Upvote an existing duplicate/similar complaint
 */
export async function upvoteOrAddReportToExisting(
  existingId: string,
  additionalDescription?: string
): Promise<Complaint> {
  try {
    const res = await fetchApi<any>(`/complaints/${encodeURIComponent(existingId)}/upvote`, {
      method: 'POST',
      body: JSON.stringify({ additionalNotes: additionalDescription }),
    });
    return normalizeComplaint(res);
  } catch (err) {
    console.warn('API upvoteOrAddReportToExisting failed:', err);
    throw err;
  }
}

/**
 * Run multi-modal preview analysis on complaint wizard Step 3
 */
export async function fetchPreviewAnalysis(
  description: string,
  location: LocationCoords,
  imageUrls: string[] = [],
  hasVoice = false
): Promise<AIAnalysisResult> {
  try {
    const res = await fetchApi<AIAnalysisResult>('/ai/preview-analysis', {
      method: 'POST',
      body: JSON.stringify({ description, location, imageUrls, hasVoice }),
    });
    return res;
  } catch (err) {
    console.warn('API preview analysis failed — using fallback client inference:', err);
    // Fallback to local inference
    return runFullAIAnalysis(description, location, INITIAL_COMPLAINTS, imageUrls, hasVoice);
  }
}

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStatistics(): Promise<DashboardStatistics | null> {
  try {
    return await fetchApi<DashboardStatistics>('/dashboard/statistics');
  } catch (err) {
    console.warn('API fetchDashboardStatistics failed:', err);
    return null;
  }
}
