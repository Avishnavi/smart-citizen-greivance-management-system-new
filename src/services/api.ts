/**
 * REST API client helper
 * Communicates with the Express backend via /api proxy (or VITE_API_URL).
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
  total?: number;
  unreadCount?: number;
}

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || `Request failed with status ${response.status}`, response.status);
  }

  return (data.data !== undefined ? data.data : data) as T;
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
