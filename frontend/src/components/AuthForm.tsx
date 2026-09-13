'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { api, setToken } from '@/lib/api';
import { useWorkspace } from '@/store/workspace';
import { Logo } from './Logo';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = isRegister ? await api.register(email, password, name) : await api.login(email, password);
      setToken(result.token);
      // Covers signing in over a still-populated store — a token replaced
      // without an explicit sign-out first.
      useWorkspace.getState().reset();
      router.push('/app');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="card p-7 shadow-[0_18px_50px_rgba(23,37,31,0.06)]">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">
            {isRegister ? 'Create your account' : 'Sign in'}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">
            {isRegister
              ? 'Your clients and sessions are private to your account.'
              : 'Welcome back. Pick up where you left off.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isRegister && (
              <div>
                <label className="label" htmlFor="name">
                  Name <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <input id="name" className="field" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={isRegister ? 8 : undefined}
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              {isRegister && <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters.</p>}
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-clay-50 px-4 py-3 text-sm text-clay-700">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" size={16} />}
              {isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {isRegister ? 'Already have an account? ' : 'No account yet? '}
          <Link href={isRegister ? '/login' : '/register'} className="font-semibold text-sage-600 hover:underline">
            {isRegister ? 'Sign in' : 'Create one'}
          </Link>
        </p>
      </div>
    </main>
  );
}
