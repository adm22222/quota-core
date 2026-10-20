'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ConsumeResult, User } from '../../types';
import { api } from '../../lib/api';
import { Card, Empty, number } from '../ui';

export function SimulatorTab({
  setError,
}: {
  setError: (e: string | null) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [userRef, setUserRef] = useState('');
  const [units, setUnits] = useState('10');
  const [requestId, setRequestId] = useState('demo-request');
  const [result, setResult] = useState<ConsumeResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ items: User[] }>('/users?limit=100')
      .then((x) => {
        setUsers(x.items);
        if (x.items[0]) setUserRef(x.items[0].userRef);
      })
      .catch((e) => setError(e.message));
  }, [setError]);
  async function consume(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<ConsumeResult>('/consume', {
          method: 'POST',
          body: JSON.stringify({ userRef, units: Number(units), requestId }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="simulator-grid">
      <Card>
        <span className="eyebrow">Live API operation</span>
        <h3>Test consumption</h3>
        <p className="muted">
          This sends a real <code>POST /v1/consume</code> request. Reuse the
          request ID to verify idempotent replay behavior.
        </p>
        <form className="stack-form" onSubmit={consume}>
          <label>
            User
            <select
              value={userRef}
              onChange={(e) => setUserRef(e.target.value)}
              required
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.userRef}>{u.userRef}</option>
              ))}
            </select>
          </label>
          <label>
            Units
            <input
              type="number"
              min="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              required
            />
          </label>
          <label>
            Request ID
            <input
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              required
            />
            <small>Unique per account</small>
          </label>
          <button className="button primary wide" disabled={busy || !userRef}>
            {busy ? 'Checking limitsâ€¦' : 'Run consumption test â†’'}
          </button>
        </form>
      </Card>
      <Card
        className={
          result
            ? result.accepted
              ? 'result-card accepted'
              : 'result-card rejected'
            : 'result-card'
        }
      >
        <span className="eyebrow">Decision result</span>
        {result ? (
          <>
            <div className="decision">
              <span
                className={
                  result.accepted ? 'decision-icon yes' : 'decision-icon no'
                }
              >
                {result.accepted ? 'âœ“' : '!'}
              </span>
              <div>
                <h3>
                  {result.accepted ? 'Request accepted' : 'Request rejected'}
                </h3>
                <p>
                  {result.replayed
                    ? 'Replayed from the original request.'
                    : `${number(result.units)} units were ${result.accepted ? 'consumed' : 'not consumed'}.`}
                </p>
              </div>
            </div>
            <div className="result-stats">
              <div>
                <span>Account remaining After Request</span>
                <strong>{number(result.account.remaining)}</strong>
              </div>
              <div>
                <span>User remaining</span>
                <strong>{number(result.user.remaining)}</strong>
              </div>
            </div>
            {!result.accepted && result.violations.length > 0 && (
              <div className="violations">
                <strong>Limit checks</strong>
                {result.violations.map((v, i) => (
                  <div key={i}>
                    <span>
                      {v.level} آ· {v.rule.replaceAll('_', ' ')}
                    </span>
                    <span>
                      limit {number(v.limit)} / tried {number(v.attempted)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="fine">
              Processed {new Date(result.processedAt).toLocaleString()} آ·{' '}
              {result.month}
            </p>
          </>
        ) : (
          <Empty text="Your real-time acceptance or rejection will appear here." />
        )}
      </Card>
    </div>
  );
}
