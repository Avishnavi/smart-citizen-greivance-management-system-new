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
  DepartmentTask,
  RecurringIssueHotspot,
  HotspotMetrics,
  OfficialComplaintMessage,
  ComplaintAssociatedDepartment,
} from '../types';
import { fetchApi } from './api';
import { INITIAL_COMPLAINTS } from '../mock/complaints';
import { runFullAIAnalysis } from './aiService';
import { toCanonicalIso } from '../utils/dateUtils';

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
  if (c && typeof c === 'object' && (c.data || c.complaint)) {
    c = c.data || c.complaint;
  }
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
    REOPENED: 'In Progress',
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
  const isResolved = (statusVal === 'Resolved' || c.status === 'CLOSED') && c.status !== 'REOPENED';
  const isInProgress = statusVal === 'In Progress' || c.status === 'IN_PROGRESS' || c.status === 'REOPENED';
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
        timestamp: t.timestamp ? toCanonicalIso(t.timestamp) : (t.createdAt ? toCanonicalIso(t.createdAt) : 'Pending'),
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
        timestamp: toCanonicalIso(c.createdAt),
        completed: true,
        current: false,
      },
      {
        id: 'step-2',
        step: 2,
        title: 'Complaint Received / Under Review',
        description: 'Grievance verified and queued for municipal dispatch.',
        timestamp: toCanonicalIso(c.createdAt),
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
        timestamp: isAssigned ? toCanonicalIso(c.updatedAt || c.createdAt) : 'Pending',
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
        timestamp: isInProgress || isResolved ? toCanonicalIso(c.updatedAt || c.createdAt) : 'Pending',
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
        timestamp: isResolved ? toCanonicalIso(c.resolution?.resolvedAt || c.updatedAt || c.createdAt) : 'Pending',
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
        timestamp: isFeedbackDone ? toCanonicalIso(c.feedback.submittedAt || c.updatedAt) : 'Pending',
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
    createdAt: toCanonicalIso(c.createdAt),
    updatedAt: toCanonicalIso(c.updatedAt || c.createdAt),
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
    const res = await fetchApi<any>(`/complaints${query}`);
    const items = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
    return items.map(normalizeComplaint);
  } catch (err) {
    console.warn('API fetchAllComplaints error:', err);
    return [];
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
    console.warn(`API fetchComplaintById(${id}) error:`, err);
    return null;
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
          timestamp: (e.createdAt || e.timestamp) ? toCanonicalIso(e.createdAt || e.timestamp) : 'Pending',
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

  const res = await fetchApi<any>('/complaints', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeComplaint(res);
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
    const res = await fetchApi<any>('/dashboard/statistics');
    return res?.data || res || null;
  } catch (err) {
    console.warn('API fetchDashboardStatistics failed:', err);
    return null;
  }
}

// ─── Phase 2: Department Task & Workflow Operations ──────────────────────────

/**
 * Fetch department tasks associated with a single complaint
 */
export async function fetchComplaintTasks(complaintId: string): Promise<DepartmentTask[]> {
  try {
    const res = await fetchApi<any>(`/complaints/${complaintId}/tasks`);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.tasks)) return res.tasks;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  } catch (err) {
    console.warn(`Failed to fetch tasks for ${complaintId}:`, err);
    return [];
  }
}

/**
 * Fetch all department tasks scoped to current user's role/department
 */
export async function fetchAllDepartmentTasks(params: {
  status?: string;
  departmentName?: string;
  taskType?: string;
} = {}): Promise<DepartmentTask[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.departmentName && params.departmentName !== 'all') queryParams.append('departmentName', params.departmentName);
    if (params.taskType && params.taskType !== 'all') queryParams.append('taskType', params.taskType);

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const res = await fetchApi<any>(`/tasks${qs}`);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.tasks)) return res.tasks;
    return [];
  } catch (err) {
    console.warn('Failed to fetch department tasks:', err);
    return [];
  }
}

/**
 * Central Admin approves/rejects/clarifies complaint and creates department tasks
 */
export async function approveComplaintApi(
  complaintId: string,
  payload: {
    action: 'approve' | 'reject' | 'request_clarification';
    primaryDepartment?: { departmentId?: string; departmentName: string; description?: string };
    supportingDepartments?: Array<{ departmentId?: string; departmentName: string; reason?: string }>;
    priority?: string;
    adminNotes?: string;
    rejectionReason?: string;
  }
): Promise<any> {
  return await fetchApi(`/complaints/${complaintId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Supervisor assigns task to a department employee
 */
export async function assignTaskApi(
  taskId: string,
  payload: { employeeId?: string; employeeName: string }
): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Employee acknowledges or updates task status
 */
export async function updateTaskStatusApi(
  taskId: string,
  payload: { status: string; note?: string }
): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Employee submits resolution notes and proof for AI verification
 */
export async function submitTaskResolutionApi(
  taskId: string,
  payload: { resolutionNotes: string; evidenceUrls?: string[]; actionsTaken?: string[] }
): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/resolution`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Department Supervisor or Central Admin verifies task resolution
 */
export async function verifyTaskResolutionApi(
  taskId: string,
  payload: { action: 'approve' | 'request_rework' | 'reject'; comments: string; reworkRequirements?: string[] }
): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Central Admin or Supervisor finalizes complaint closure after tasks are verified
 */
export async function closeComplaintApi(complaintId: string): Promise<any> {
  return await fetchApi(`/complaints/${complaintId}/close`, {
    method: 'POST',
  });
}

/**
 * Citizen or Admin reopens a resolved or closed complaint
 */
export async function reopenComplaintApi(complaintId: string, reason?: string): Promise<any> {
  return await fetchApi(`/complaints/${complaintId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Citizen responds to a clarification request from Central Admin
 */
export async function submitClarificationApi(
  complaintId: string,
  clarificationText: string,
  additionalImageUrls?: string[]
): Promise<any> {
  return await fetchApi(`/complaints/${complaintId}/clarification`, {
    method: 'POST',
    body: JSON.stringify({ clarificationText, additionalImageUrls }),
  });
}

/**
 * Fetch task SLA status and predictive delay details
 */
export async function fetchTaskSlaApi(taskId: string): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/sla`);
}

/**
 * Supervisor or Admin pauses task SLA clock
 */
export async function pauseTaskSlaApi(taskId: string, reason: string): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/pause-sla`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Supervisor or Admin resumes task SLA clock
 */
export async function resumeTaskSlaApi(taskId: string): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/resume-sla`, {
    method: 'POST',
  });
}

/**
 * Supervisor or Admin triggers task escalation
 */
export async function escalateTaskApi(
  taskId: string,
  payload: { escalationLevel?: number; triggerCondition?: string; reason?: string }
): Promise<any> {
  return await fetchApi(`/tasks/${taskId}/escalate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Acknowledge an escalation record
 */
export async function acknowledgeEscalationApi(escalationId: string): Promise<any> {
  return await fetchApi(`/tasks/escalations/${escalationId}/acknowledge`, {
    method: 'PATCH',
  });
}

/**
 * Fetch aggregated SLA metrics for dashboard
 */
export async function fetchSlaMetricsApi(): Promise<any> {
  return await fetchApi('/dashboard/sla-metrics');
}

/**
 * Fetch detected recurring issue hotspots
 */
export async function fetchHotspotsApi(params: {
  category?: string;
  ward?: string;
  status?: string;
  observationWindowDays?: number;
} = {}): Promise<RecurringIssueHotspot[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.category && params.category !== 'all') queryParams.append('category', params.category);
    if (params.ward && params.ward !== 'all') queryParams.append('ward', params.ward);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.observationWindowDays) queryParams.append('observationWindowDays', String(params.observationWindowDays));

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const res = await fetchApi<{ success: boolean; count: number; data: RecurringIssueHotspot[] }>(`/dashboard/hotspots${qs}`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).data)) return (res as any).data;
    return [];
  } catch (err) {
    console.warn('Failed to fetch hotspots:', err);
    return [];
  }
}

/**
 * Fetch hotspot details by ID
 */
export async function fetchHotspotDetailsApi(id: string): Promise<RecurringIssueHotspot | null> {
  try {
    const res = await fetchApi<RecurringIssueHotspot>(`/dashboard/hotspots/${id}`);
    return res;
  } catch (err) {
    console.warn(`Failed to fetch hotspot ${id}:`, err);
    return null;
  }
}

/**
 * Trigger municipality-wide DBSCAN hotspot scan (Central Admin)
 */
export async function runHotspotScanApi(params: {
  epsilonMeters?: number;
  minComplaints?: number;
  observationWindowDays?: number;
} = {}): Promise<any> {
  return await fetchApi('/dashboard/hotspots/scan', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Update hotspot lifecycle status and preventive action plan
 */
export async function updateHotspotStatusApi(
  id: string,
  payload: {
    status: string;
    proposedAction?: string;
    responsibleDepartment?: string;
    targetCompletionDate?: string;
    budgetEstimated?: number;
    notes?: string;
  }
): Promise<any> {
  return await fetchApi(`/dashboard/hotspots/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch aggregated hotspot metrics for dashboard
 */
export async function fetchHotspotMetricsApi(): Promise<HotspotMetrics | null> {
  try {
    const res = await fetchApi<HotspotMetrics>('/dashboard/hotspot-metrics');
    return res;
  } catch (err) {
    console.warn('Failed to fetch hotspot metrics:', err);
    return null;
  }
}

// ─── Official Citizen–Department Chat APIs ───────────────────────────────────

/**
 * Fetch associated departments for a complaint (to render department conversation tabs).
 */
export async function fetchComplaintDepartmentsApi(
  complaintId: string
): Promise<ComplaintAssociatedDepartment[]> {
  try {
    const cleanId = encodeURIComponent(complaintId.trim());
    const res = await fetchApi<ComplaintAssociatedDepartment[]>(`/complaints/${cleanId}/departments`);
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.warn(`Failed to fetch departments for complaint ${complaintId}:`, err.message);
    throw err;
  }
}

/**
 * Fetch messages for a specific department under a complaint.
 */
export async function fetchDepartmentMessagesApi(
  complaintId: string,
  departmentId: string,
  options: { page?: number; limit?: number; taskId?: string } = {}
): Promise<OfficialComplaintMessage[]> {
  try {
    const cleanComplaintId = encodeURIComponent(complaintId.trim());
    const cleanDeptId = encodeURIComponent(departmentId.trim());

    const queryParams = new URLSearchParams();
    if (options.page) queryParams.set('page', String(options.page));
    if (options.limit) queryParams.set('limit', String(options.limit));
    if (options.taskId) queryParams.set('taskId', options.taskId);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const endpoint = `/complaints/${cleanComplaintId}/departments/${cleanDeptId}/messages${queryString}`;

    const res = await fetchApi<OfficialComplaintMessage[]>(endpoint);
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.warn(`Failed to fetch messages for complaint ${complaintId}, dept ${departmentId}:`, err.message);
    throw err;
  }
}

/**
 * Send an official citizen message to an assigned department.
 * Identity fields (senderId, senderName, senderRole) are strictly derived on the backend.
 */
export async function sendDepartmentMessageApi(
  complaintId: string,
  departmentId: string,
  payload: {
    message: string;
    attachments?: string[];
    taskId?: string;
    isInternal?: boolean;
    messageType?: string;
  }
): Promise<OfficialComplaintMessage> {
  const cleanComplaintId = encodeURIComponent(complaintId.trim());
  const cleanDeptId = encodeURIComponent(departmentId.trim());

  const res = await fetchApi<OfficialComplaintMessage>(
    `/complaints/${cleanComplaintId}/departments/${cleanDeptId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: payload.message.trim(),
        attachments: payload.attachments || [],
        taskId: payload.taskId || undefined,
        isInternal: Boolean(payload.isInternal),
        messageType: payload.messageType || undefined,
      }),
    }
  );

  return res;
}

/**
 * Fetch complaint-level legacy messages where departmentId is null.
 */
export async function fetchLegacyMessagesApi(
  complaintId: string
): Promise<OfficialComplaintMessage[]> {
  try {
    const cleanId = encodeURIComponent(complaintId.trim());
    const res = await fetchApi<OfficialComplaintMessage[]>(`/complaints/${cleanId}/messages?legacyOnly=true`);
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.warn(`Failed to fetch legacy messages for complaint ${complaintId}:`, err.message);
    return [];
  }
}
