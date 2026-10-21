'use client';

import { useEffect, useState } from 'react';
import type { Account, HistoryItem, Plan, Tab, Usage, User } from '../../types';
import { ApiError, api } from '../../lib/api';
import {
  ActivityTable,
  Card,
  Checklist,
  Empty,
  Metric,
  Progress,
  monthNow,
  number,
} from '../ui';

export function OverviewTab({
  account,
  setTab,
  setError,
}: {
  account: Account;
  setTab: (tab: Tab) => void;
  setError: (error: string | null) => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [demoProgress, setDemoProgress] = useState<{
    step: number;
    error: string;
    done: boolean;
    busy: boolean;
  }>({ step: 0, error: '', done: false, busy: false });
  useEffect(() => {
    Promise.all([
      api<Usage>(`/usage?month=${monthNow()}&limit=100`),
      api<{ items: User[] }>('/users?limit=100'),
      api<{ items: HistoryItem[] }>('/history?limit=5'),
    ])
      .then(([u, us, h]) => {
        setUsage(u);
        setUsers(us.items);
        setHistory(h.items);
      })
      .catch((e) => setError(e.message));
  }, [setError]);
  const accepted = history.filter((x) => x.outcome === 'ACCEPTED').length;
  async function refreshOverview() {
    const [u, us, h] = await Promise.all([
      api<Usage>(`/usage?month=${monthNow()}&limit=100`),
      api<{ items: User[] }>('/users?limit=100'),
      api<{ items: HistoryItem[] }>('/history?limit=5'),
    ]);
    setUsage(u);
    setUsers(us.items);
    setHistory(h.items);
    await api<{ items: Plan[] }>('/plans');
  }
  async function loadDemoData() {
    if (demoProgress.busy) return;
    setDemoProgress({ step: 0, error: '', done: false, busy: true });
    let currentStep = 0;
    try {
      const currentPlans = await api<{ items: Plan[] }>('/plans');
      if (
        currentPlans.items.some((plan) => !plan.isPredefined) &&
        !window.confirm(
          'This account already has custom plans. Continue and reuse or add the demo plans?',
        )
      ) {
        setDemoProgress({ step: 0, error: '', done: false, busy: false });
        return;
      }
      const planSpecs = [
        {
          name: 'demo-account',
          scope: 'ACCOUNT' as const,
          monthlyAllowance: 100,
          maxPerRequest: 25,
        },
        {
          name: 'demo-basic',
          scope: 'USER' as const,
          monthlyAllowance: 50,
          maxPerRequest: 10,
        },
        {
          name: 'demo-premium',
          scope: 'USER' as const,
          monthlyAllowance: 200,
          maxPerRequest: 25,
        },
        {
          name: 'demo-account-large',
          scope: 'ACCOUNT' as const,
          monthlyAllowance: 1000,
          maxPerRequest: 100,
        },
      ];
      const plans: Plan[] = [];
      for (const [index, spec] of planSpecs.entries()) {
        currentStep = index + 1;
        setDemoProgress({
          step: index + 1,
          error: '',
          done: false,
          busy: true,
        });
        try {
          plans.push(
            await api<Plan>('/plans', {
              method: 'POST',
              body: JSON.stringify(spec),
            }),
          );
        } catch (e) {
          const error = e as ApiError;
          if (error.code !== 'plan_name_taken') throw error;
          const existing = await api<{ items: Plan[] }>(
            `/plans?scope=${spec.scope}`,
          );
          const plan = existing.items.find((item) => item.name === spec.name);
          if (!plan) throw error;
          plans.push(plan);
        }
      }
      currentStep = 5;
      setDemoProgress({
        step: currentStep,
        error: '',
        done: false,
        busy: true,
      });
      await api<{ account: Account }>('/account/plan', {
        method: 'PUT',
        body: JSON.stringify({ planId: plans[0].id }),
      });
      currentStep = 6;
      setDemoProgress({
        step: currentStep,
        error: '',
        done: false,
        busy: true,
      });
      for (const [userRef, planId] of [
        ['adam', plans[1].id],
        ['bob', plans[2].id],
      ] as const) {
        try {
          await api<User>('/users', {
            method: 'POST',
            body: JSON.stringify({ userRef, planId }),
          });
        } catch (e) {
          const error = e as ApiError;
          if (error.code !== 'user_exists') throw error;
        }
        if (userRef === 'adam') {
          currentStep = 7;
          setDemoProgress({
            step: currentStep,
            error: '',
            done: false,
            busy: true,
          });
        }
      }
      await refreshOverview();
      setDemoProgress({ step: 7, error: '', done: true, busy: false });
    } catch (e) {
      const error = e as ApiError;
      setDemoProgress({
        step: currentStep,
        error: `${error.code ?? 'request_failed'}: ${error.message}`,
        done: false,
        busy: false,
      });
    }
  }
  return (
    <>
      <div className="welcome-banner">
        <div>
          <div className="eyebrow">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <h3>Build with confidence.</h3>
          <p>Monitor the limits that keep your product healthy.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => setTab('Simulator')}
        >
          Test a request
        </button>
      </div>
      <div className="stats-grid">
        <Metric
          label="Account plan"
          value={account.accountPlan.name}
          detail={`${number(account.accountPlan.monthlyAllowance)} units / month`}
        />
        <Metric
          label="Remaining quota"
          value={usage ? number(usage.account.remaining) : '0'}
          detail={
            usage
              ? `${Math.round((usage.account.remaining / usage.account.monthlyAllowance) * 100)}% available`
              : 'Loading usage'
          }
        />
        <Metric
          label="Active users"
          value={usage ? number(usage.users.length) : '0'}
          detail="Across this workspace"
        />
        <Metric
          label="Requests tracked"
          value={history.length ? number(history.length) : '0'}
          detail={
            history.length
              ? `${accepted} accepted in recent activity`
              : 'Your first request is waiting'
          }
        />
      </div>
      <div className="content-grid">
        <Card>
          <div className="card-head">
            <div>
              <span className="eyebrow">Monthly consumption</span>
              <h3>
                {usage ? number(usage.account.consumed) : '0'}{' '}
                <small>
                  / {usage ? number(usage.account.monthlyAllowance) : '0'} units
                </small>
              </h3>
            </div>
            <span className="month-chip">{monthNow()}</span>
          </div>
          <div className="large-progress">
            <Progress
              used={usage?.account.consumed ?? 0}
              total={usage?.account.monthlyAllowance ?? 1}
            />
          </div>
          <div className="level-row">
            <span>
              Account limit{' '}
              {usage?.account.planName ?? account.accountPlan.name}
            </span>
            <strong>
              {usage
                ? `${Math.round((usage.account.consumed / usage.account.monthlyAllowance) * 100)}% used`
                : '0'}
            </strong>
          </div>
        </Card>
      </div>
      <Card className="table-card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Latest activity</span>
            <h3>Request history</h3>
          </div>
          <button className="text-button" onClick={() => setTab('History')}>
            View all
          </button>
        </div>
        {history.length ? (
          <ActivityTable items={history} />
        ) : users.length === 0 ? (
          <div className="demo-empty">
            <Empty text="No users or requests yet. Load a small real demo setup to explore the quota behaviors." />
            <button
              className="button primary"
              onClick={loadDemoData}
              disabled={demoProgress.busy}
            >
              {demoProgress.busy
                ? `Loading demo آ· step ${demoProgress.step} of 7â€¦`
                : 'Load demo data'}
            </button>
            {demoProgress.error && (
              <div className="error-box">Demo stopped {demoProgress.error}</div>
            )}
            {demoProgress.done && (
              <div className="demo-hint">
                <strong>Try this</strong>
                <span>alice 15 units â†’ USER max-per-request rejection</span>
                <span>
                  bob 25 units أ—4 â†’ the 4th hits the account allowance
                </span>
                <span>
                  Switch account plan to demo-account-large â†’ bob can consume
                  again
                </span>
                <button
                  className="text-button"
                  onClick={() => setTab('Simulator')}
                >
                  Open simulator â†’
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Empty text="No requests yet. Use the simulator to create your first API decision." />
            {demoProgress.done && (
              <div className="demo-hint">
                <strong>Try this</strong>
                <span>alice 15 units â†’ USER max-per-request rejection</span>
                <span>
                  bob 25 units أ—4 â†’ the 4th hits the account allowance
                </span>
                <span>
                  Switch account plan to demo-account-large â†’ bob can consume
                  again
                </span>
                <button
                  className="text-button"
                  onClick={() => setTab('Simulator')}
                >
                  Open simulator â†’
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

const demoPlanSpecs = [
  {
    name: 'prem',
    scope: 'ACCOUNT' as const,
    monthlyAllowance: 10000,
    maxPerRequest: 1000,
  },
  {
    name: 'demo-small',
    scope: 'ACCOUNT' as const,
    monthlyAllowance: 100,
    maxPerRequest: 50,
  },
  {
    name: 'proo',
    scope: 'USER' as const,
    monthlyAllowance: 500,
    maxPerRequest: 50,
  },
];
