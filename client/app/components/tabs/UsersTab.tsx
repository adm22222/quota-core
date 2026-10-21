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
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<
    Array<{ users?: string; usage?: string }>
  >([{}]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [ref, setRef] = useState('');
  const [planId, setPlanId] = useState('');
  const [busy, setBusy] = useState(false);
  const cursor = pageCursors[page] ?? {};
  const cursorKey = `${cursor.users ?? ''}:${cursor.usage ?? ''}`;
  useEffect(() => {
    const query = new URLSearchParams({ limit: String(pageSize) });
    if (cursor.users) query.set('cursor', cursor.users);
    const usageQuery = new URLSearchParams({ month, limit: String(pageSize) });
    if (cursor.usage) usageQuery.set('cursor', cursor.usage);
    Promise.all([
      api<{ items: User[]; nextCursor?: string | null }>(`/users?${query}`),
      api<Usage>(`/usage?${usageQuery}`),
      api<{ items: Plan[] }>('/plans?scope=USER'),
    ])
      .then(([u, x, p]) => {
        setUsers(u.items);
        setUsage(x);
        setUserPlans(p.items);
        const nextUsers = u.nextCursor ?? undefined;
        const nextUsage = x.nextCursor ?? undefined;
        setHasNextPage(Boolean(nextUsers && nextUsage));
        if (nextUsers && nextUsage) {
          setPageCursors((old) => {
            const next = old.slice(0, page + 1);
            next[page + 1] = { users: nextUsers, usage: nextUsage };
            return next;
          });
        }
      })
      .catch((e) => setError(e.message));
  }, [cursorKey, month, page, pageSize, setError]);
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
  async function changePlan(userRef: string, nextPlanId: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<User>(
        `/users/${encodeURIComponent(userRef)}/plan`,
        {
          method: 'PUT',
          body: JSON.stringify({ planId: nextPlanId }),
        },
      );
      setUsers((old) =>
        old.map((user) => (user.userRef === updated.userRef ? updated : user)),
      );
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
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(0);
                setPageCursors([{}]);
              }}
            />
            <select
              value={pageSize}
              aria-label="Rows per page"
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
                setPageCursors([{}]);
              }}
            >
              {[1, 5, 10, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
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
                    <select
                      value={user.plan.id}
                      disabled={busy}
                      aria-label={`Plan for ${user.userRef}`}
                      onChange={(e) => changePlan(user.userRef, e.target.value)}
                    >
                      {userPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
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
        <div className="pagination" aria-label="Users and usage pagination">
          <button
            className="button secondary"
            disabled={busy || page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            className="button secondary"
            disabled={busy || !hasNextPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </Card>
    </>
  );
}
