'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Menu, Plus, X } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { SessionView } from '@/components/SessionView';
import { TranscriptComposer } from '@/components/TranscriptComposer';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/use-auth';
import { useWorkspace } from '@/store/workspace';

export function WorkspaceClient() {
  const { user, checking, signOut } = useAuth();
  const { session, loadingSession, loadClients, startNewSession } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (user) void loadClients();
  }, [user, loadClients]);

  // Opening a session from the sidebar on mobile should reveal it, not leave
  // the nav covering the screen.
  useEffect(() => {
    if (session) setNavOpen(false);
  }, [session]);

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center" aria-busy="true">
        <div className="text-center">
          <LoaderCircle className="mx-auto mb-3 animate-spin text-ink-muted" size={26} />
          <p className="text-sm text-ink-muted">Loading your workspace…</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink/10 bg-paper/95 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-ink/5"
        >
          {navOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Logo />
        <button
          type="button"
          onClick={() => {
            startNewSession();
            setNavOpen(false);
          }}
          aria-label="Start a new session"
          className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-ink text-white"
        >
          <Plus size={20} />
        </button>
      </header>

      <div
        className={`${navOpen ? 'block' : 'hidden'} fixed inset-x-0 bottom-0 top-16 z-20 lg:fixed lg:inset-y-0 lg:left-0 lg:top-0 lg:block lg:w-[288px]`}
      >
        <Sidebar user={user} onSignOut={signOut} onClose={() => setNavOpen(false)} />
      </div>

      <main className="lg:ml-[288px]">
        <div className="px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
          {loadingSession && !session ? (
            <div className="grid min-h-[50vh] place-items-center" aria-busy="true">
              <LoaderCircle className="animate-spin text-ink-muted" size={26} />
            </div>
          ) : session ? (
            <SessionView session={session} />
          ) : (
            <TranscriptComposer />
          )}
        </div>
      </main>
    </div>
  );
}
