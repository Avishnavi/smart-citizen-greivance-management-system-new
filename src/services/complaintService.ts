import type {
  Complaint,
  ComplaintStatus,
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
 * Checks whether an event is an internal/AI processing event
 * that must not be exposed to citizen tracking.
 */
function isAiEvent(item: any): boolean {
  if (!item) return true;
  const eventType = (item.eventType || '').toUpperCase();
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const actor = (item.actor?.name || item.officerName || '').toLowerCase();
  const actorType = (item.actor?.type || '').toLowerCase();

  const internalTypes = [
    'LLM_ANALYSIS_STARTED',
    'LLM_ANALYSIS_COMPLETED',
    'LLM_ANALYSIS_FAILED',
    'CATEGORY_ASSIGNED',
    'DUPLICATE_CHECK_STARTED',
    'DUPLICATE_CHECK_COMPLETED',
    'PRIORITY_PREDICTED',
    'ESCALATION_RISK_UPDATED',
    'RECURRING_ISSUE_FLAGGED',
    'RESOLUTION_VERIFICATION_STARTED',
    'RESOLUTION_VERIFICATION_COMPLETED',
  ];

  if (internalTypes.includes(eventType) || item.metadata?.internal === true) {
    return true;
  }

  // Filter out intermediate status change events from AI orchestrator
  if (eventType === 'STATUS_CHANGED' || eventType === 'STATUS_UPDATED') {
    const prev = (item.previousStatus || item.metadata?.previousStatus || '').toUpperCase();
    const next = (item.newStatus || item.metadata?.newStatus || '').toUpperCase();
    const internalStages = ['UNDER_ANALYSIS', 'CATEGORIZED', 'PRIORITIZED'];
    if (internalStages.includes(prev) || internalStages.includes(next)) {
      return true;
    }
  }

  if (actorType === 'ai') return true;
  if (/\b(ai|llm)\b/i.test(actor) || actor.includes('pipeline') || actor.includes('algorithm')) return true;

  const aiKeywords = [
    'ai pipeline',
    'ai analysis',
    'llm analysis',
    'ai processing',
    'ai classification',
    'ai verification',
    'ai scoring',
    'ai categorization',
    'ai prediction',
    'ai processing started',
    'ai processing completed',
    'under_analysis',
    'status updated to categorized',
    'status updated to prioritized',
  ];

  if (/\b(ai|llm)\b/i.test(title) || /\b(ai|llm)\b/i.test(desc)) return true;

  return aiKeywords.some((kw) => title.includes(kw) || desc.includes(kw));
}

/**
 * Normalizes backend MongoDB complaint format to the frontend Complaint interface
 */
function normalizeComplaint(c: any): Complaint {
  const statusMap: Record<string, any> = {
    SUBMITTED: 'Pending',
    UNDER_REVIEW: 'Pending',
    'Under Review': 'Pending',
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

  // Filter out any AI / internal events from timeline
  const rawTimeline = (c.timeline || []).filter((t: any) => !isAiEvent(t));

  const statusVal = (statusMap[c.status] || c.status || 'Pending') as ComplaintStatus;
  const isResolved = statusVal === 'Resolved' || c.status === 'CLOSED';
  const isInProgress = statusVal === 'In Progress' || c.status === 'IN_PROGRESS';
  const isAssigned = Boolean(c.assignedOfficer || c.routing?.assignedOfficerName || isInProgress || isResolved);
  const isFeedbackDone = Boolean(c.feedback);
  const isFinalStatus = isResolved || statusVal === 'Rejected' || c.status === 'CLOSED' || c.status === 'REJECTED';

  let formattedTimeline: TimelineEvent[] = [];

  if (rawTimeline.length > 0) {
    formattedTimeline = rawTimeline.map((t: any, idx: number) => {
      let cleanTitle = t.title || (t.eventType ? t.eventType.replace(/_/g, ' ') : 'Status Update');
      if (cleanTitle === 'COMPLAINT SUBMITTED') cleanTitle = 'Complaint Submitted';
      if (cleanTitle === 'DEPARTMENT ROUTED' || cleanTitle === 'OFFICER ASSIGNED') {
        cleanTitle = 'Assigned to Department / Officer';
      }
      const isLast = idx === rawTimeline.length - 1;
      return {
        id: t.id || t._id || `t-${idx}`,
        step: idx + 1,
        title: cleanTitle,
        description: t.description || '',
        timestamp: t.timestamp || (t.createdAt ? new Date(t.createdAt).toLocaleString() : 'Pending'),
        completed: isLast ? isFinalStatus : true,
        current: isLast ? !isFinalStatus : false,
        officerName: t.officerName || t.metadata?.assignedOfficerName || (t.actor?.type === 'officer' ? t.actor?.name : undefined),
        department: t.department || t.metadata?.departmentName,
      };
    });
  } else {
    formattedTimeline = [
      {
        id: 'step-1',
        step: 1,
        title: 'Complaint Submitted',
        description: 'Complaint registered via Citizen Portal with location details.',
        timestamp: c.createdAt ? new Date(c.createdAt).toLocaleString() : 'Just now',
        completed: true,
        current: false,
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Complaint Received / Under Review',
        description: 'Grievance verified and queued for municipal dispatch.',
        timestamp: c.createdAt ? new Date(c.createdAt).toLocaleString() : 'Just now',
        completed: isAssigned || isInProgress || isResolved,
        current: !isAssigned && !isInProgress && !isResolved,
      },
      {
        id: 'step-3',
        step: 3,
        title: 'Assigned to Department / Officer',
        description: (c.assignedOfficer || c.routing?.assignedOfficerName)
          ? `Assigned to ${c.assignedOfficer || c.routing?.assignedOfficerName} (${c.department || c.routing?.departmentName || 'Municipal Dept'}).`
          : `Queued for field dispatch to ${c.department || 'Municipal Dept'}.`,
        timestamp: isAssigned ? (c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'Assigned') : 'Pending',
        completed: isInProgress || isResolved,
        current: isAssigned && !isInProgress && !isResolved,
        officerName: c.assignedOfficer || c.routing?.assignedOfficerName,
        department: c.department || c.routing?.departmentName,
      },
      {
        id: 'step-4',
        step: 4,
        title: 'In Progress',
        description: isInProgress
          ? (c.adminNotes || 'Field crew on-site inspection and repair operation underway.')
          : isResolved
          ? 'Field crew repair work completed.'
          : 'Pending dispatch of field crew.',
        timestamp: isInProgress || isResolved ? (c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'In Progress') : 'Pending',
        completed: isResolved,
        current: isInProgress,
        officerName: c.assignedOfficer || c.routing?.assignedOfficerName,
      },
      {
        id: 'step-5',
        step: 5,
        title: 'Resolved',
        description: isResolved
          ? (c.resolution?.resolutionNotes || 'Grievance resolved and verified by municipal team.')
          : 'Pending resolution verification and on-site testing.',
        timestamp: isResolved ? (c.resolution?.resolvedAt || c.updatedAt || 'Resolved') : 'Pending',
        completed: isResolved,
        current: isResolved && !isFeedbackDone,
      },
      {
        id: 'step-6',
        step: 6,
        title: 'Citizen Feedback',
        description: isFeedbackDone
          ? `Citizen satisfaction rating: ${c.feedback.rating}/5 stars.`
          : 'Citizen post-resolution verification and satisfaction rating.',
        timestamp: isFeedbackDone ? (c.feedback.submittedAt || 'Completed') : 'Pending',
        completed: isFeedbackDone,
        current: isResolved && !isFeedbackDone,
      },
    ];
  }

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
    status: statusVal,
    createdAt: c.createdAt || new Date().toISOString(),
    updatedAt: c.updatedAt || new Date().toISOString(),
    assignedOfficer: c.assignedOfficer || c.routing?.assignedOfficerName || '',
    adminNotes: c.adminNotes || c.priorityReason || '',
    escalated: Boolean(c.escalated || c.escalationLevel > 0 || c.escalationRisk === 'HIGH' || c.escalationRisk === 'CRITICAL'),
    timeline: formattedTimeline,
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
 * Fetch single complaint by ID with timeline
 */
export async function fetchComplaintById(id: string): Promise<Complaint | null> {
  try {
    const [data, timelineEvents] = await Promise.all([
      fetchApi<any>(`/complaints/${encodeURIComponent(id)}`),
      fetchComplaintTimeline(id).catch(() => []),
    ]);
    if (!data) return null;
    const normalized = normalizeComplaint(data);
    if ((!normalized.timeline || normalized.timeline.length === 0) && timelineEvents.length > 0) {
      normalized.timeline = timelineEvents;
    }
    return normalized;
  } catch (err) {
    console.warn(`API fetchComplaintById(${id}) failed — searching local cache:`, err);
    const found = INITIAL_COMPLAINTS.find(
      (c) => c.id.toLowerCase() === id.trim().toLowerCase()
    );
    return found || null;
  }
}

/**
 * Update complaint on the backend (Admin / Officer status update)
 */
export async function updateComplaintApi(
  id: string,
  updates: Partial<Complaint>
): Promise<Complaint> {
  const res = await fetchApi<any>(`/complaints/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return normalizeComplaint(res);
}

/**
 * Fetch live timeline events for a complaint
 */
export async function fetchComplaintTimeline(id: string): Promise<TimelineEvent[]> {
  try {
    const data = await fetchApi<any[]>(`/complaints/${encodeURIComponent(id)}/timeline`);
    if (Array.isArray(data) && data.length > 0) {
      const filtered = data.filter((e: any) => !isAiEvent(e));
      return filtered.map((e: any, index: number) => {
        let cleanTitle = e.title || (e.eventType ? e.eventType.replace(/_/g, ' ') : 'Status Update');
        if (cleanTitle === 'COMPLAINT SUBMITTED') cleanTitle = 'Complaint Submitted';
        if (cleanTitle === 'DEPARTMENT ROUTED' || cleanTitle === 'OFFICER ASSIGNED') {
          cleanTitle = 'Assigned to Department / Officer';
        }
        const isLast = index === filtered.length - 1;
        return {
          id: e._id || `event-${index}`,
          step: index + 1,
          title: cleanTitle,
          description: e.description,
          timestamp: e.createdAt ? new Date(e.createdAt).toLocaleString() : 'Pending',
          completed: !isLast,
          current: isLast,
          officerName: e.officerName || e.metadata?.assignedOfficerName || (e.actor?.type === 'officer' ? e.actor?.name : undefined),
          department: e.department || e.metadata?.departmentName,
        };
      });
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
    voiceUrl: input.voiceUrl,
    voiceDuration: input.voiceDuration,
    imageUrls: input.imageUrls || [],
    category: input.category || 'Other',
    priority: priorityUpper,
    location: {
      latitude: input.location?.latitude ?? 13.0827,
      longitude: input.location?.longitude ?? 80.2707,
      address: input.location?.address || 'Selected Grievance Location',
      ward: input.location?.ward || '',
      zone: input.location?.zone || '',
      landmark: input.location?.landmark || '',
    },
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
