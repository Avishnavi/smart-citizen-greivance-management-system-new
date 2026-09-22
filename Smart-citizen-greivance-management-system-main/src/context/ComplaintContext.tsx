import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Complaint,
  LocationCoords,
  AIAnalysisResult,
  CitizenFeedback,
  ComplaintCategory,
  Department,
  ComplaintPriority,
} from '../types';
import {
  fetchAllComplaints,
  createNewComplaint,
  submitCitizenFeedback,
  upvoteOrAddReportToExisting,
  fetchPreviewAnalysis,
} from '../services/complaintService';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
import { INITIAL_COMPLAINTS } from '../mock/complaints';

export interface ComplaintDraft {
  description: string;
  voiceUrl?: string;
  voiceBlob?: Blob | string;
  voiceDuration?: number;
  imageUrls: string[];
  location: LocationCoords;
  aiAnalysis: AIAnalysisResult | null;
  selectedCategory?: ComplaintCategory;
  selectedDepartment?: Department;
  selectedPriority?: ComplaintPriority;
  duplicateResolution?: 'view' | 'upvote' | 'submit_new';
}

const DEFAULT_LOCATION: LocationCoords = {
  latitude: 13.085,
  longitude: 80.2101,
  address: '2nd Avenue, Anna Nagar Roundtana, Chennai',
  ward: 'Ward 102',
  zone: 'Zone 8 (Anna Nagar)',
  landmark: 'Anna Nagar Roundtana',
};

const INITIAL_DRAFT: ComplaintDraft = {
  description: '',
  imageUrls: [],
  location: DEFAULT_LOCATION,
  aiAnalysis: null,
};

interface ComplaintContextType {
  complaints: Complaint[];
  draft: ComplaintDraft;
  isLoading: boolean;
  isAnalyzing: boolean;
  isSubmitting: boolean;
  updateDraft: (updates: Partial<ComplaintDraft>) => void;
  resetDraft: () => void;
  analyzeDraftAI: () => Promise<AIAnalysisResult | null>;
  submitDraftComplaint: () => Promise<Complaint>;
  addFeedbackToComplaint: (id: string, feedback: CitizenFeedback) => Promise<Complaint>;
  upvoteExistingComplaint: (existingId: string) => Promise<Complaint>;
  refreshComplaints: () => Promise<void>;
  resetAllToDefault: () => void;
  adminUpdateComplaint: (id: string, updates: Partial<Complaint>) => void;
  officerUpdateComplaint: (id: string, updates: Partial<Complaint>) => void;
  adminReassignComplaint: (id: string, department: Department, officerName?: string, notes?: string) => void;
  adminEscalateComplaint: (id: string, reason: string, priorityScoreBoost?: number) => void;
  adminSendNotice: (id: string, message: string) => void;
}

const ComplaintContext = createContext<ComplaintContextType | undefined>(undefined);

export const ComplaintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [draft, setDraft] = useState<ComplaintDraft>(INITIAL_DRAFT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addNotification } = useNotifications();
  const { profile } = useAuth();

  const refreshComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllComplaints();
      setComplaints(data);
    } catch (err) {
      console.warn('Failed to refresh complaints from server:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshComplaints();
  }, [refreshComplaints]);

  const updateDraft = (updates: Partial<ComplaintDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const resetDraft = () => {
    setDraft({
      ...INITIAL_DRAFT,
      location: DEFAULT_LOCATION,
    });
  };

  const analyzeDraftAI = async (): Promise<AIAnalysisResult | null> => {
    if (!draft.description && !draft.voiceBlob && draft.imageUrls.length === 0) {
      return null;
    }

    setIsAnalyzing(true);
    try {
      const textToAnalyze =
        draft.description || 'Civic issue reported with audio recording and photographic evidence.';

      const result = await fetchPreviewAnalysis(
        textToAnalyze,
        draft.location,
        draft.imageUrls,
        Boolean(draft.voiceBlob)
      );

      setDraft((prev) => ({
        ...prev,
        aiAnalysis: result,
        selectedCategory: result.classification.category,
        selectedDepartment: result.classification.department,
        selectedPriority: result.priority.priority,
      }));

      return result;
    } catch (e) {
      console.error('AI Analysis failed:', e);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitDraftComplaint = async (): Promise<Complaint> => {
    setIsSubmitting(true);
    try {
      const category =
        draft.selectedCategory || draft.aiAnalysis?.classification.category || 'Other';
      const department =
        draft.selectedDepartment || draft.aiAnalysis?.classification.department || 'Public Health & Sanitation';
      const priority =
        draft.selectedPriority || draft.aiAnalysis?.priority.priority || 'Medium';

      const duplicateStatus =
        draft.aiAnalysis?.duplicate.isDuplicate && draft.duplicateResolution === 'submit_new'
          ? 'confirmed_new'
          : draft.aiAnalysis?.duplicate.isDuplicate
          ? 'possible_duplicate'
          : 'none';

      const newComplaint = await createNewComplaint({
        userId: profile.id,
        citizenId: profile.id,
        description: draft.description || 'Civic grievance registered by citizen.',
        originalText: draft.description,
        voiceUrl: draft.voiceUrl,
        voiceDuration: draft.voiceDuration,
        hasVoice: Boolean(draft.voiceBlob),
        imageUrls: draft.imageUrls,
        category,
        department,
        location: draft.location,
        duplicateStatus,
        similarComplaintId: draft.aiAnalysis?.duplicate.similarComplaintId,
        similarityScore: draft.aiAnalysis?.duplicate.similarityScore,
        priority,
        priorityScore: draft.aiAnalysis?.priority.score,
        priorityFactors: draft.aiAnalysis?.priority.factors,
      });

      await refreshComplaints();

      addNotification({
        complaintId: newComplaint.id,
        title: `Complaint Registered: ${newComplaint.id}`,
        message: `Your complaint for ${category} has been logged and assigned to ${department}.`,
        type: 'status_change',
      });

      return newComplaint;
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFeedbackToComplaint = async (
    id: string,
    feedback: CitizenFeedback
  ): Promise<Complaint> => {
    const updated = await submitCitizenFeedback(id, feedback);
    await refreshComplaints();
    return updated;
  };

  const upvoteExistingComplaint = async (existingId: string): Promise<Complaint> => {
    const updated = await upvoteOrAddReportToExisting(existingId, draft.description);
    await refreshComplaints();
    addNotification({
      complaintId: existingId,
      title: `Report Linked to ${existingId}`,
      message: `Your details have been attached to active complaint ${existingId}. Priority elevated.`,
      type: 'status_change',
    });
    return updated;
  };

  const resetAllToDefault = () => {
    setComplaints(INITIAL_COMPLAINTS);
    resetDraft();
  };

  // Department Officer resolution and field update handler
  const officerUpdateComplaint = (id: string, updates: Partial<Complaint>) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const now = new Date().toISOString();
          const newTimeline = [...(c.timeline || [])];
          if (updates.status && updates.status !== c.status) {
            const isResolved = updates.status === 'Resolved';
            newTimeline.push({
              id: `t-${Date.now()}-status`,
              step: newTimeline.length + 1,
              title: isResolved ? 'Field Work Completed & Resolved' : `Status Updated to ${updates.status}`,
              description:
                isResolved && updates.resolution?.resolutionNotes
                  ? `${updates.resolution.resolutionNotes}${updates.resolution.proofImageUrl ? ' [Photo Proof Attached]' : ''}`
                  : `Field status changed to ${updates.status}.`,
              timestamp: now,
              completed: true,
              current: true,
              officerName: updates.resolution?.officerName || c.assignedOfficer || 'Department Field Officer',
            });
          }
          return {
            ...c,
            ...updates,
            resolution: updates.resolution ? { ...(c.resolution || {}), ...updates.resolution } : (updates.status === 'Resolved' ? c.resolution : updates.resolution),
            updatedAt: now,
            timeline: newTimeline,
          };
        }
        return c;
      })
    );
    addNotification({
      title: 'Field Update Recorded',
      message: `Complaint ${id} was updated by field officer.`,
      type: 'status_change',
      complaintId: id,
    });
  };

  // Admin Municipal Triage / Assignment / General Update
  const adminUpdateComplaint = (id: string, updates: Partial<Complaint>) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const now = new Date().toISOString();
          const newTimeline = [...(c.timeline || [])];
          if (updates.status && updates.status !== c.status) {
            const isResolved = updates.status === 'Resolved';
            newTimeline.push({
              id: `t-${Date.now()}-admin-status`,
              step: newTimeline.length + 1,
              title: isResolved ? 'Grievance Resolved & Audited' : `Status: ${updates.status}`,
              description: `Administrative status change recorded.`,
              timestamp: now,
              completed: true,
              current: true,
              officerName: 'Municipal Admin Command',
            });
          }
          if (updates.department && updates.department !== c.department) {
            newTimeline.push({
              id: `t-${Date.now()}-admin-dept`,
              step: newTimeline.length + 1,
              title: `Department Reassigned`,
              description: `Admin reassigned from ${c.department} to ${updates.department}.`,
              timestamp: now,
              completed: true,
              current: true,
              officerName: 'Municipal Admin Command',
              department: updates.department,
            });
          }
          return {
            ...c,
            ...updates,
            updatedAt: now,
            timeline: newTimeline,
          };
        }
        return c;
      })
    );
  };

  // Admin Specific: Reassign Department and Officer
  const adminReassignComplaint = (
    id: string,
    department: Department,
    officerName?: string,
    notes?: string
  ) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const now = new Date().toISOString();
          const newTimeline = [...(c.timeline || [])];
          newTimeline.push({
            id: `t-${Date.now()}-reassign`,
            step: newTimeline.length + 1,
            title: `Admin Reassigned: ${department}`,
            description: notes || `Reassigned to ${department}${officerName ? ` (Assigned to: ${officerName})` : ''} by Municipal Admin.`,
            timestamp: now,
            completed: true,
            current: true,
            officerName: 'Municipal Admin Command',
            department,
          });

          return {
            ...c,
            department,
            assignedOfficer: officerName || c.assignedOfficer,
            adminNotes: notes || c.adminNotes,
            updatedAt: now,
            timeline: newTimeline,
          };
        }
        return c;
      })
    );

    addNotification({
      title: 'Administrative Reassignment',
      message: `Complaint ${id} reassigned to ${department}.`,
      type: 'assigned',
      complaintId: id,
    });
  };

  // Admin Specific: Escalate Delayed or High Priority Complaint
  const adminEscalateComplaint = (
    id: string,
    reason: string,
    priorityScoreBoost = 15
  ) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const now = new Date().toISOString();
          const newTimeline = [...(c.timeline || [])];
          newTimeline.push({
            id: `t-${Date.now()}-escalate`,
            step: newTimeline.length + 1,
            title: '⚠️ Administratively Escalated',
            description: `Escalation Reason: ${reason}. Executive attention flagged.`,
            timestamp: now,
            completed: true,
            current: true,
            officerName: 'Municipal Admin Command',
          });

          const newScore = Math.min(100, (c.priorityScore || 70) + priorityScoreBoost);
          return {
            ...c,
            escalated: true,
            escalatedAt: now,
            escalationReason: reason,
            priority: 'High',
            priorityScore: newScore,
            priorityFactors: Array.from(
              new Set([...(c.priorityFactors || []), `Admin Escalation: ${reason}`])
            ),
            updatedAt: now,
            timeline: newTimeline,
          };
        }
        return c;
      })
    );

    addNotification({
      title: '🚨 Complaint Escalated',
      message: `Complaint ${id} was flagged as HIGH PRIORITY by Municipal Command.`,
      type: 'status_change',
      complaintId: id,
    });
  };

  // Admin Specific: Send Administrative Direct Notice
  const adminSendNotice = (id: string, message: string) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const now = new Date().toISOString();
          const newTimeline = [...(c.timeline || [])];
          newTimeline.push({
            id: `t-${Date.now()}-notice`,
            step: newTimeline.length + 1,
            title: '📢 Administrative Dispatch Notice',
            description: message,
            timestamp: now,
            completed: true,
            current: true,
            officerName: 'Municipal Admin Command',
          });

          return {
            ...c,
            updatedAt: now,
            timeline: newTimeline,
          };
        }
        return c;
      })
    );

    addNotification({
      title: 'Administrative Notice Issued',
      message: `Notice dispatched for ${id}: "${message.slice(0, 40)}..."`,
      type: 'reminder',
      complaintId: id,
    });
  };

  return (
    <ComplaintContext.Provider
      value={{
        complaints,
        draft,
        isLoading,
        isAnalyzing,
        isSubmitting,
        updateDraft,
        resetDraft,
        analyzeDraftAI,
        submitDraftComplaint,
        addFeedbackToComplaint,
        upvoteExistingComplaint,
        refreshComplaints,
        resetAllToDefault,
        adminUpdateComplaint,
        officerUpdateComplaint,
        adminReassignComplaint,
        adminEscalateComplaint,
        adminSendNotice,
      }}
    >
      {children}
    </ComplaintContext.Provider>
  );
};

export const useComplaints = (): ComplaintContextType => {
  const context = useContext(ComplaintContext);
  if (!context) {
    throw new Error('useComplaints must be used within a ComplaintProvider');
  }
  return context;
};
