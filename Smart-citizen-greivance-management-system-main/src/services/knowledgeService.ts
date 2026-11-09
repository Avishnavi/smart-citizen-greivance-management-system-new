import { fetchApi } from './api';
import type { KnowledgeDocument, KnowledgeGuidance } from '../types';

/**
 * Retrieve grounded knowledge & SOP guidance for a complaint.
 */
export async function fetchComplaintKnowledge(complaintId: string): Promise<KnowledgeGuidance> {
  return fetchApi<KnowledgeGuidance>(`/complaints/${encodeURIComponent(complaintId)}/knowledge`);
}

/**
 * Retrieve grounded knowledge & SOP guidance for a specific department task.
 */
export async function fetchTaskKnowledge(taskId: string): Promise<KnowledgeGuidance> {
  return fetchApi<KnowledgeGuidance>(`/tasks/${encodeURIComponent(taskId)}/knowledge`);
}

/**
 * Query RAG knowledge retrieval with custom parameters.
 */
export async function retrieveKnowledge(payload: {
  complaintId?: string;
  taskId?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  issue?: string;
  department?: string;
  isPublicOnly?: boolean;
}): Promise<KnowledgeGuidance> {
  return fetchApi<KnowledgeGuidance>('/knowledge/retrieve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch knowledge documents list (scoped by user role & department).
 */
export async function fetchKnowledgeDocuments(params?: {
  department?: string;
  category?: string;
  documentType?: string;
  search?: string;
}): Promise<KnowledgeDocument[]> {
  const query = new URLSearchParams();
  if (params?.department) query.set('department', params.department);
  if (params?.category) query.set('category', params.category);
  if (params?.documentType) query.set('documentType', params.documentType);
  if (params?.search) query.set('search', params.search);

  const queryString = query.toString();
  const endpoint = `/knowledge${queryString ? `?${queryString}` : ''}`;
  const res = await fetchApi<any>(endpoint);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

/**
 * Fetch a single knowledge document with its chunks.
 */
export async function fetchKnowledgeDocById(id: string): Promise<{ document: KnowledgeDocument; chunks: any[] }> {
  return fetchApi<{ document: KnowledgeDocument; chunks: any[] }>(`/knowledge/${id}`);
}

