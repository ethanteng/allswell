'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/store/workspace';
import { api, ApiError, clearToken, getToken } from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  /** True until the token has been checked against the API. */
  checking: boolean;
  signOut: () => void;
}

/**
 * Verifies the stored token and redirects to /login when it is missing or
 * rejected. Every authenticated page calls this; it is the only place that
 * decides someone is signed out.
 */
export function useAuth(): AuthState {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!getToken()) {
        router.replace('/login');
        return;
      }

      try {
        const me = await api.me();
        if (!cancelled) {
          setUser(me);
          setChecking(false);
        }
      } catch (error) {
        // Only an auth failure means sign out. A network blip or a sleeping
        // backend shouldn't throw away a valid session.
        if (error instanceof ApiError && error.status === 401) {
          clearToken();
          // The rejected token may have belonged to someone else; nothing loaded
          // under it should survive into the next sign-in on this tab.
          useWorkspace.getState().reset();
          router.replace('/login');
          return;
        }
        if (!cancelled) setChecking(false);
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return {
    user,
    checking,
    signOut: () => {
      clearToken();
      useWorkspace.getState().reset();
      router.replace('/login');
    },
  };
}
