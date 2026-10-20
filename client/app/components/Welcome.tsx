'use client';

import { FormEvent, useState } from 'react';
import type { Account } from '../types';
import { ErrorBox } from './ui';

export function Welcome({ onReady }: { onReady: (account: Account) => void }) {
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'create'
            ? { action: 'create', name }
            : { action: 'login', apiKey },
        ),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data?.error?.message ?? data?.message ?? 'Could not connect',
        );
      if (mode === 'create' && data.apiKey) setNewKey(data.apiKey);
      else onReady(data.account);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
    } finally {
      setBusy(false);
    }
  }
  if (newKey)
    return (
      <main className="welcome">
        <div className="welcome-card">
          <div className="brand">
            <span className="brand-mark">Q</span>
            <span>QuotaCore</span>
          </div>
          <div className="eyebrow">Account ready</div>
          <h1>Save your API key.</h1>
          <p className="muted">
            This is the only time QuotaCore will show it. Copy it to your
            password manager before continuing.
          </p>
          <div className="key-box">
            <code>{newKey}</code>
            <button
              className="button secondary"
              onClick={() => navigator.clipboard.writeText(newKey)}
            >
              Copy key
            </button>
          </div>
          <button
            className="button primary wide"
            onClick={async () =>
              onReady((await (await fetch('/api/session')).json()).account)
            }
          >
            Open dashboard <span>→</span>
          </button>
        </div>
      </main>
    );
  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <span>QuotaCore</span>
        </div>
        <div className="eyebrow">Usage metering, made clear</div>
        <h1>Know what every request costs.</h1>
        <p className="muted">
          A focused control plane for quotas, plans, users, and real-time
          consumption decisions.
        </p>
        <div className="segmented">
          <button
            className={mode === 'create' ? 'active' : ''}
            onClick={() => setMode('create')}
          >
            Create account
          </button>
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Use API key
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            {mode === 'create' ? 'Account name' : 'API key'}
            <input
              value={mode === 'create' ? name : apiKey}
              onChange={(e) =>
                mode === 'create'
                  ? setName(e.target.value)
                  : setApiKey(e.target.value)
              }
              placeholder={mode === 'create' ? 'Acme production' : 'mk_live_…'}
              required
            />
          </label>
          <ErrorBox error={error} />
          <button className="button primary wide" disabled={busy}>
            {busy
              ? 'Connecting…'
              : mode === 'create'
                ? 'Create account'
                : 'Connect account'}{' '}
            <span>→</span>
          </button>
        </form>
        <p className="fine">
          Your key is encrypted in an httpOnly session cookie. It never enters
          localStorage.
        </p>
      </div>
      <div className="welcome-aside">
        <div className="pulse">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>Two levels. One decision.</strong>
          <p>
            Every consume call checks both the shared account plan and the
            individual user plan atomically.
          </p>
        </div>
      </div>
    </main>
  );
}
