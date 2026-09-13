'use client';

import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';
import type { ClientWithSessions, SessionDetail } from '@/lib/types';

interface WorkspaceState {
  clients: ClientWithSessions[];
  /** Full detail for the open session, or null when composing a new one. */
  session: SessionDetail | null;
  selectedSessionId: string | null;
  /**
   * Client the composer should preselect, set by "New session" on a client row.
   * Store state rather than an event: the composer only mounts once the session
   * is cleared, so an event dispatched alongside that clear arrives before
   * anything is listening.
   */
  composeForClientId: string | null;
  /**
   * Incremented on every startNewSession call. The composer resets on this
   * rather than on composeForClientId, which does not change when the same
   * choice is made twice running — two clicks of "New session", or the same
   * client row twice — and so would leave the previous draft in place.
   */
  composeNonce: number;

  loadingClients: boolean;
  loadingSession: boolean;
  /** True while a transcript is being analysed or a follow-up answered. */
  working: boolean;
  error: string | null;

  loadClients: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  startNewSession: (composeForClientId?: string) => void;

  createSession: (payload: { transcript: string; clientId?: string; newClientName?: string; sessionDate?: string }) => Promise<string | null>;
  reanalyze: () => Promise<void>;
  askFollowUp: (question: string) => Promise<void>;

  createClient: (name: string) => Promise<void>;
  renameClient: (clientId: string, name: string) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;

  renameSession: (sessionId: string, title: string) => Promise<void>;
  moveSession: (sessionId: string, clientId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  clearError: () => void;
  /** Drops every account-scoped value. Called whenever the signed-in user changes. */
  reset: () => void;
}

/**
 * Account-scoped state, split out so `reset` cannot miss a field.
 *
 * The store is module-level and outlives a sign-out, so without this a second
 * clinician signing in on the same tab would see the first one's clients and
 * their open session — transcript and feedback included — until the reload that
 * may never come. Clearing the token is not enough.
 */
const EMPTY_WORKSPACE = {
  clients: [],
  session: null,
  selectedSessionId: null,
  composeForClientId: null,
  loadingClients: false,
  loadingSession: false,
  working: false,
  error: null,
} satisfies Partial<WorkspaceState>;

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ...EMPTY_WORKSPACE,
  composeNonce: 0,

  clearError: () => set({ error: null }),

  // Bump the nonce so a mounted composer clears its draft too.
  reset: () => set((state) => ({ ...EMPTY_WORKSPACE, composeNonce: state.composeNonce + 1 })),

  loadClients: async () => {
    set({ loadingClients: true });
    try {
      set({ clients: await api.listClients(), error: null });
    } catch (error) {
      set({ error: messageFor(error, 'Could not load your clients') });
    } finally {
      set({ loadingClients: false });
    }
  },

  selectSession: async (sessionId) => {
    // Set the id first so the sidebar highlights immediately rather than after
    // the fetch resolves.
    set({ selectedSessionId: sessionId, loadingSession: true, error: null });
    try {
      const session = await api.getSession(sessionId);
      // A different session may have been opened while this was in flight.
      if (get().selectedSessionId !== sessionId) return;
      set({ session });
    } catch (error) {
      set({ error: messageFor(error, 'Could not open that session'), session: null });
    } finally {
      if (get().selectedSessionId === sessionId) set({ loadingSession: false });
    }
  },

  /** Clears the workspace back to the composer, optionally preselecting a client. */
  startNewSession: (composeForClientId) =>
    set((state) => ({
      session: null,
      selectedSessionId: null,
      error: null,
      composeForClientId: composeForClientId ?? null,
      composeNonce: state.composeNonce + 1,
    })),

  createSession: async (payload) => {
    set({ working: true, error: null });
    try {
      const session = await api.createSession(payload);
      set({ session, selectedSessionId: session.id });
      await get().loadClients();
      return session.id;
    } catch (error) {
      set({ error: messageFor(error, 'Could not analyse that transcript') });
      return null;
    } finally {
      set({ working: false });
    }
  },

  reanalyze: async () => {
    const { session } = get();
    if (!session) return;

    set({ working: true, error: null });
    try {
      set({ session: await api.reanalyzeSession(session.id) });
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not re-run the analysis') });
    } finally {
      set({ working: false });
    }
  },

  askFollowUp: async (question) => {
    const { session } = get();
    if (!session) return;

    set({ working: true, error: null });
    try {
      set({ session: await api.askFollowUp(session.id, question) });
    } catch (error) {
      set({ error: messageFor(error, 'Could not answer that question') });
    } finally {
      set({ working: false });
    }
  },

  createClient: async (name) => {
    try {
      await api.createClient(name);
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not create that client') });
    }
  },

  renameClient: async (clientId, name) => {
    // Optimistic: renaming is the most-used action in the nav and a round-trip
    // of lag on every rename makes the whole sidebar feel slow.
    const previous = get().clients;
    set({ clients: previous.map((client) => (client.id === clientId ? { ...client, name } : client)) });

    try {
      await api.renameClient(clientId, name);
      await get().loadClients();
    } catch (error) {
      set({ clients: previous, error: messageFor(error, 'Could not rename that client') });
    }
  },

  deleteClient: async (clientId) => {
    try {
      await api.deleteClient(clientId);
      // The open session may have belonged to the client that just went away.
      if (get().session?.clientId === clientId) get().startNewSession();
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not delete that client') });
    }
  },

  renameSession: async (sessionId, title) => {
    try {
      const updated = await api.updateSession(sessionId, { title });
      if (get().selectedSessionId === sessionId) set({ session: updated });
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not rename that session') });
    }
  },

  moveSession: async (sessionId, clientId) => {
    try {
      const updated = await api.updateSession(sessionId, { clientId });
      if (get().selectedSessionId === sessionId) set({ session: updated });
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not move that session') });
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await api.deleteSession(sessionId);
      if (get().selectedSessionId === sessionId) get().startNewSession();
      await get().loadClients();
    } catch (error) {
      set({ error: messageFor(error, 'Could not delete that session') });
    }
  },
}));
