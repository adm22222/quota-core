'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Plan, User, Usage } from '../../types';
import { api } from '../../lib/api';
import { Card, Empty, monthNow, number } from '../ui';

export function UsersTab({
  setError,
}: {
  setError: (e: string | null) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [userPlans, setUserPlans] = useState<Plan[]>([]);
  const [month, setMonth] = useState(monthNow());
  const [ref, setRef] = useState('');
  const [planId, setPlanId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      api<{ items: User[] }>('/users?limit=100'),
      api<Usage>(`/usage?month=${month}&limit=100`),
      api<{ items: Plan[] }>('/plans?scope=USER'),
    ])
      .then(([u, x, p]) => {
        setUsers(u.items);
        setUsage(x);
        setUserPlans(p.items);
      })
      .catch((e) => setError(e.message));
  }, [month, setError]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await api<User>('/users', {
        method: 'POST',
        body: JSON.stringify({ userRef: ref, ...(planId ? { planId } : {}) }),
      });
      setUsers((old) => [...old, u]);
      setRef('');
      setPlanId('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card className="create-inline">
        <div>
          <span className="eyebrow">New user</span>
          <h3>Register a user</h3>
        </div>
        <form onSubmit={create}>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="user_123 or alice@example.com"
            pattern="[A-Za-z0-9._:@-]+"
            required
          />
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Basic plan (default)</option>
            {userPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} آ· {number(plan.monthlyAllowance)} / month
              </option>
            ))}
          </select>
          <button className="button primary" disabled={busy}>
            {busy ? 'Addingâ€¦' : 'Add user'}
          </button>
        </form>
      </Card>
      <Card className="table-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Workspace directory</span>
            <h3>{users.length} users</h3>
          </div>
          <div className="filters">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <span className="subtle">Usage for {month}</span>
          </div>
        </div>
        {users.length ? (
          <div className="data-table">
            <div className="table-row table-header">
              <span>User reference</span>
              <span>Plan</span>
              <span>Usage</span>
            </div>
            {users.map((user) => {
              const level = usage?.users.find(
                (x) => x.userRef === user.userRef,
              );
              return (
                <div className="table-row" key={user.userRef}>
                  <span className="user-cell">
                    <span className="avatar small">
                      {user.userRef.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{user.userRef}</strong>
                  </span>
                  <span>
                    <span className="badge">{user.plan.name}</span>
                  </span>
                  <span>
                    <strong>{level ? number(level.consumed) : '0'}</strong>
                    <small> / {number(user.plan.monthlyAllowance)}</small>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="Add a user to begin metering individual usage." />
        )}
      </Card>
    </>
  );
}
