import type {
  AdminConfigResponse,
  AuthResponse,
  AuthUser,
  ClientWithSessions,
  PromptConfig,
  SessionDetail,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'allswell_token';

/** Thrown for any non-2xx response, carrying the status so callers can branch. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing and blocked site data both throw here. Treat it as
    // logged out rather than crashing the app shell.
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* Session lasts for this tab only. Better than failing the login. */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

/**
 * Nest's ValidationPipe returns `message` as an array of per-field errors.
 * Flatten it so the UI has one string to show.
 */
function extractMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body as { message: unknown };
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractMessage(body, `Request failed (${response.status})`), response.status);
  }

  return body as T;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request<AuthUser>('/auth/me'),

  listClients: () => request<ClientWithSessions[]>('/clients'),

  createClient: (name: string) => request<ClientWithSessions>('/clients', { method: 'POST', body: JSON.stringify({ name }) }),

  renameClient: (id: string, name: string) =>
    request<ClientWithSessions>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteClient: (id: string) => request<{ id: string; deleted: boolean }>(`/clients/${id}`, { method: 'DELETE' }),

  /** Sends the client's sessions in their new order; returns the whole nav. */
  reorderSessions: (clientId: string, sessionIds: string[]) =>
    request<ClientWithSessions[]>(`/clients/${clientId}/session-order`, {
      method: 'PATCH',
      body: JSON.stringify({ sessionIds }),
    }),

  getSession: (id: string) => request<SessionDetail>(`/sessions/${id}`),

  createSession: (payload: { transcript: string; clientId?: string; newClientName?: string; title?: string; sessionDate?: string }) =>
    request<SessionDetail>('/sessions', { method: 'POST', body: JSON.stringify(payload) }),

  reanalyzeSession: (id: string) => request<SessionDetail>(`/sessions/${id}/analyze`, { method: 'POST' }),

  askFollowUp: (id: string, question: string) =>
    request<SessionDetail>(`/sessions/${id}/turns`, { method: 'POST', body: JSON.stringify({ question }) }),

  updateSession: (id: string, payload: { title?: string; clientId?: string; sessionDate?: string | null }) =>
    request<SessionDetail>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteSession: (id: string) => request<{ id: string; deleted: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),

  getAdminConfig: () => request<AdminConfigResponse>('/admin/config'),

  updateAdminConfig: (payload: Partial<Pick<PromptConfig, 'analysisPrompt' | 'followUpPrompt' | 'model' | 'temperature' | 'maxTokens'>>) =>
    request<{ config: PromptConfig }>('/admin/config', { method: 'PUT', body: JSON.stringify(payload) }),
};
