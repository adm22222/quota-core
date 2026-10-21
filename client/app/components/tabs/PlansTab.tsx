'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Account, Plan } from '../../types';
import { api } from '../../lib/api';
import { Card, number } from '../ui';

export function PlansTab({
  account,
  setAccount,
  setError,
}: {
  account: Account;
  setAccount: (a: Account) => void;
  setError: (e: string | null) => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [scope, setScope] = useState<'ACCOUNT' | 'USER'>('ACCOUNT');
  const [form, setForm] = useState({
    name: '',
    monthlyAllowance: '10000',
    maxPerRequest: '100',
  });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    monthlyAllowance: '',
    maxPerRequest: '',
  });
  useEffect(() => {
    api<{ items: Plan[] }>(`/plans?scope=${scope}`)
      .then((x) => {
        if (scope !== 'ACCOUNT') {
          setPlans(x.items);
          return;
        }
        const current = account.accountPlan;
        setPlans(
          x.items.some((plan) => plan.id === current.id)
            ? x.items
            : [current, ...x.items],
        );
      })
      .catch((e) => setError(e.message));
  }, [account.accountPlan, scope, setError]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api<Plan>('/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          scope,
          monthlyAllowance: Number(form.monthlyAllowance),
          maxPerRequest: Number(form.maxPerRequest),
        }),
      });
      setPlans((old) => [...old, p]);
      setForm({ name: '', monthlyAllowance: '10000', maxPerRequest: '100' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function select(plan: Plan) {
    if (plan.id === account.accountPlan.id || plan.scope !== 'ACCOUNT') return;
    setBusy(true);
    try {
      const next = await api<{ account: Account }>('/account/plan', {
        method: 'PUT',
        body: JSON.stringify({ planId: plan.id }),
      });
      setAccount(next.account);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function startEdit(plan: Plan) {
    setEditing(plan);
    setEditForm({
      name: plan.name,
      monthlyAllowance: String(plan.monthlyAllowance),
      maxPerRequest: String(plan.maxPerRequest),
    });
  }
  async function updatePlan(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const updated = await api<Plan>(`/plans/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          monthlyAllowance: Number(editForm.monthlyAllowance),
          maxPerRequest: Number(editForm.maxPerRequest),
        }),
      });
      setPlans((old) =>
        old.map((plan) => (plan.id === updated.id ? updated : plan)),
      );
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">Limit architecture</span>
          <h3>Plans are the contract.</h3>
          <p className="muted">
            Account plans are shared across your workspace. User plans apply per
            identity.
          </p>
        </div>
        <div className="segmented compact">
          <button
            className={scope === 'ACCOUNT' ? 'active' : ''}
            onClick={() => setScope('ACCOUNT')}
          >
            Account plans
          </button>
          <button
            className={scope === 'USER' ? 'active' : ''}
            onClick={() => setScope('USER')}
          >
            User plans
          </button>
        </div>
      </div>
      <div className="plans-grid">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={
              plan.id === account.accountPlan.id
                ? 'plan-card current'
                : 'plan-card'
            }
          >
            <div className="plan-top">
              <span className="badge">
                {plan.isPredefined ? 'PREDEFINED' : 'CUSTOM'}
              </span>
              {plan.id === account.accountPlan.id && (
                <span className="current-label">Current</span>
              )}
            </div>
            <h3>{plan.name}</h3>
            <div className="plan-number">
              {number(plan.monthlyAllowance)}
              <small> units / month</small>
            </div>
            <div className="plan-detail">
              <span>Max per request</span>
              <strong>{number(plan.maxPerRequest)}</strong>
            </div>
            <button
              className="button secondary wide"
              disabled={
                busy ||
                plan.id === account.accountPlan.id ||
                scope !== 'ACCOUNT'
              }
              onClick={() => select(plan)}
            >
              {plan.id === account.accountPlan.id
                ? 'Active plan'
                : 'Switch plan'}
            </button>
            {!plan.isPredefined && (
              <button
                className="button secondary wide"
                disabled={busy}
                onClick={() => startEdit(plan)}
              >
                Edit custom plan
              </button>
            )}
            {editing?.id === plan.id && (
              <form className="stack-form" onSubmit={updatePlan}>
                <label>
                  Name
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Monthly allowance
                  <input
                    type="number"
                    min="1"
                    value={editForm.monthlyAllowance}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        monthlyAllowance: e.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Max / request
                  <input
                    type="number"
                    min="1"
                    value={editForm.maxPerRequest}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        maxPerRequest: e.target.value,
                      })
                    }
                    required
                  />
                </label>
                <div className="header-actions">
                  <button className="button primary" disabled={busy}>
                    {busy ? 'Savingâ€¦' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Card>
        ))}
      </div>
      <Card className="create-plan">
        <div>
          <span className="eyebrow">Custom plan</span>
          <h3>Define a limit profile</h3>
          <p className="muted">
            Custom plans stay private to this account. Existing usage is
            preserved when limits change.
          </p>
        </div>
        <form onSubmit={create} className="flex flex-col">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Team Pro"
              required
            />
          </label>
          <label>
            Monthly allowance
            <input
              type="number"
              min="1"
              value={form.monthlyAllowance}
              onChange={(e) =>
                setForm({ ...form, monthlyAllowance: e.target.value })
              }
              required
            />
          </label>
          <label>
            Max / request
            <input
              type="number"
              min="1"
              value={form.maxPerRequest}
              onChange={(e) =>
                setForm({ ...form, maxPerRequest: e.target.value })
              }
              required
            />
          </label>
          <button className="button primary wide" disabled={busy}>
            {busy ? 'Saving' : 'Create custom plan'}
          </button>
        </form>
      </Card>
    </>
  );
}
