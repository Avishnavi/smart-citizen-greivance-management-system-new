/**
 * REST API client helper
 * Communicates with the Express backend via /api proxy (or VITE_API_URL).
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const AUTH_TOKEN_KEY = 'smart_city_auth_token';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  token?: string;
  count?: number;
  total?: number;
  unreadCount?: number;
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Get stored JWT auth token from localStorage
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store or clear JWT auth token in localStorage
 */
export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to update auth token in storage:', e);
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

  // Automatically attach Bearer token if available
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If token expired, clear invalid token
    if (response.status === 401 && (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_INVALID')) {
      setAuthToken(null);
    }
    throw new ApiError(data.message || `Request failed with status ${response.status}`, response.status, data.code);
  }

  // Return data wrapper or full response
  return (data.data !== undefined ? data.data : data) as T;
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
