'use client';

import { useEffect, useState } from 'react';
import type { Account, ConsumeResult, DemoRow, Plan, User } from '../../types';
import { ApiError, api } from '../../lib/api';
import { Card, Empty, number } from '../ui';

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

export function DemoTab({
  setError,
  setAccount,
}: {
  setError: (e: string | null) => void;
  setAccount: (account: Account) => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupError, setSetupError] = useState('');
  const [ready, setReady] = useState(false);
  const [walkBusy, setWalkBusy] = useState(false);
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [extraRows, setExtraRows] = useState<DemoRow[]>([]);
  const demoPlan = (name: string) => plans.find((plan) => plan.name === name);

  async function resetDemo() {
    setError(null);
    setSetupError('');
    setRows([]);
    setExtraRows([]);
    setReady(false);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: `QuotaCore demo ${Date.now()}`,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(
          data?.error?.message ?? data?.message ?? 'Unable to reset demo',
          data?.error?.code,
        );
      setAccount(data.account);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function ensurePlan(spec: (typeof demoPlanSpecs)[number]) {
    try {
      const created = await api<Plan>('/plans', {
        method: 'POST',
        body: JSON.stringify(spec),
      });
      setPlans((old) => [
        ...old.filter((plan) => plan.id !== created.id),
        created,
      ]);
      return created;
    } catch (e) {
      const error = e as ApiError;
      if (error.code !== 'plan_name_taken') throw error;
      const existing = await api<{ items: Plan[] }>(
        `/plans?scope=${spec.scope}`,
      );
      const match = existing.items.find((plan) => plan.name === spec.name);
      if (!match) throw error;
      setPlans((old) => [...old.filter((plan) => plan.id !== match.id), match]);
      return match;
    }
  }

  async function setupDemo() {
    setSetupBusy(true);
    setSetupError('');
    setReady(false);
    setSetupStep(0);
    setError(null);
    try {
      const existing = await api<{ items: Plan[] }>('/plans');
      if (
        existing.items.some((plan) => !plan.isPredefined) &&
        !window.confirm(
          'This account has custom plans. Continue with the demo setup?',
        )
      )
        return false;
      const ensured: Plan[] = [];
      for (const [index, spec] of demoPlanSpecs.entries()) {
        setSetupStep(index + 1);
        ensured.push(await ensurePlan(spec));
      }
      setSetupStep(5);
      const smallAccount = await api<{ account: Account }>('/account/plan', {
        method: 'PUT',
        body: JSON.stringify({
          planId: ensured.find((plan) => plan.name === 'demo-small')?.id,
        }),
      });
      setAccount(smallAccount.account);
      setSetupStep(6);
      for (const [userRef, planId] of [
        ['adam', undefined],
        ['bob', ensured.find((plan) => plan.name === 'proo')?.id],
      ] as const) {
        try {
          await api<User>('/users', {
            method: 'POST',
            body: JSON.stringify({ userRef, ...(planId ? { planId } : {}) }),
          });
        } catch (e) {
          if ((e as ApiError).code !== 'user_exists') throw e;
        }
        if (userRef === 'adam') setSetupStep(7);
      }
      setPlans(ensured);
      setReady(true);
      return true;
    } catch (e) {
      const error = e as ApiError;
      setSetupError(`${error.code ?? 'request_failed'}: ${error.message}`);
      return false;
    } finally {
      setSetupBusy(false);
    }
  }

  async function runWalkthrough() {
    setWalkBusy(true);
    setRows([]);
    setExtraRows([]);
    setError(null);
    const next: DemoRow[] = [];
    try {
      next.push({
        label: '1 . Create custom account plan prem',
        note: '10,000 monthly units . 1,000 max per request.',
      });
      next.push({
        label: '2 . Create custom user plan proo',
        note: '500 monthly units . 50 max per request.',
      });
      next.push({
        label: '3 . Switch account plan  demo-small',
        note: '100 monthly units . 50 max per request. All tests start here.',
      });
      next.push({
        label: '4 Add Adam (Basic) and Bob (proo)',
        note: 'Two real users registered during setup.',
      });
      setRows([...next]);
      const requests = [
        ['5 Adam consumes a small amount', 'adam', 10],
        ['6 Adam asks above his per-request limit', 'adam', 25],
        ['7 Bob uses the shared allowance', 'bob', 25],
        ['8 Bob uses the shared allowance', 'bob', 25],
        ['9 Bob uses the last shared allowance', 'bob', 31],
        ['10 Adam asks for more than the account has left', 'adam', 10],
      ] as const;
      for (const [label, userRef, units] of requests) {
        const result = await api<ConsumeResult>('/consume', {
          method: 'POST',
          body: JSON.stringify({
            userRef,
            units,
            requestId: `demo-walkthrough-${label.split(' ')[0]}`,
          }),
        });
        next.push({ label, result });
        setRows([...next]);
      }
      const prem =
        demoPlan('prem') ??
        (await api<{ items: Plan[] }>('/plans?scope=ACCOUNT')).items.find(
          (plan) => plan.name === 'prem',
        );
      if (!prem) throw new Error('prem plan was not found');
      const largeAccount = await api<{ account: Account }>('/account/plan', {
        method: 'PUT',
        body: JSON.stringify({ planId: prem.id }),
      });
      setAccount(largeAccount.account);
      next.push({
        label: '11 switch account plan prem',
        note: 'Usage is preserved; the account now has 10,000 monthly units.',
      });
      setRows([...next]);
      const result = await api<ConsumeResult>('/consume', {
        method: 'POST',
        body: JSON.stringify({
          userRef: 'adam',
          units: 1,
          requestId: 'demo-walkthrough-11',
        }),
      });
      next.push({ label: '12 Adam tries again', result });
      setRows([...next]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWalkBusy(false);
    }
  }

  async function runExtras() {
    setExtraRows([]);
    setError(null);
    const output: DemoRow[] = [];
    try {
      const replay = await api<ConsumeResult>('/consume', {
        method: 'POST',
        body: JSON.stringify({
          userRef: 'adam',
          units: 10,
          requestId: 'demo-walkthrough-9',
        }),
      });
      output.push({ label: 'Replay request 6', result: replay });
      try {
        await api<ConsumeResult>('/consume', {
          method: 'POST',
          body: JSON.stringify({
            userRef: 'adam',
            units: 20,
            requestId: 'demo-walkthrough-9',
          }),
        });
      } catch (e) {
        const error = e as ApiError;
        output.push({
          label: 'Request 6 with 20 units',
          note: `${error.code ?? 'request_failed'}: ${error.message}`,
        });
      }
      const adam = await api<ConsumeResult>('/consume', {
        method: 'POST',
        body: JSON.stringify({
          userRef: 'adam',
          units: 25,
          requestId: 'demo-extra-adam-25',
        }),
      });
      output.push({ label: 'Adam 25', result: adam });
      setExtraRows(output);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const story = [
    'Create custom account plan prem',
    'Create custom user plan proo',
    'Switch account plan to demo-small',
    'Add Adam (Basic) and Bob (proo)',
    'Adam consumes a small amount',
    'Adam asks above his per-request limit',
    'Bob uses the shared allowance',
    'Bob uses the shared allowance',
    'Bob uses the last shared allowance',
    'Adam asks for more than the account has left',
    'Switch to prem account plan',
    'Adam tries again',
  ];
  return (
    <div className="guided-demo">
      <div className="guided-head">
        <div>
          <span className="eyebrow">Guided demo</span>
          <h3>See quota decisions in motion.</h3>
          <p className="muted">
            Plays the whole story through the real API. Reset gives you a fresh
            account.
          </p>
        </div>
        <div className="guided-actions">
          <button
            className="button primary"
            disabled={setupBusy || walkBusy}
            onClick={async () => {
              const ok = await setupDemo();
              if (ok) await runWalkthrough();
            }}
          >
            {setupBusy || walkBusy ? 'Playing' : 'Play'}
          </button>
          <button
            className="button secondary"
            disabled={setupBusy || walkBusy}
            onClick={resetDemo}
          >
            Reset
          </button>
        </div>
      </div>
      <Card className="story-card">
        <div className="story-line" />
        {story.map((label, index) => {
          const result = rows[index];
          const done = Boolean(result);
          return (
            <div className={`story-step ${done ? 'complete' : ''}`} key={label}>
              <div className="story-number">{done ? '✓' : index + 1}</div>
              <div className="story-copy">
                <strong>{label}</strong>
                {result ? (
                  result.note ? (
                    <small>{result.note}</small>
                  ) : (
                    <span
                      className={
                        result.result?.accepted
                          ? 'status accepted'
                          : 'status rejected'
                      }
                    >
                      {result.result?.accepted
                        ? 'ACCEPTED'
                        : `REJECTED آ· ${result.result?.reason?.level ?? ''}`}
                    </span>
                  )
                ) : (
                  <small>{index === 0 ? 'Ready to start' : 'Waiting'}</small>
                )}
              </div>
            </div>
          );
        })}
        {setupError && (
          <div className="error-box">Demo stopped {setupError}</div>
        )}
        <div className="story-footer">
          {setupBusy && <span>Setup step {setupStep} of 7</span>}
          {walkBusy && <span>Running real API requests</span>}
          {ready && !walkBusy && (
            <span>
              Setup complete. Play the walkthrough to create real request
              history.
            </span>
          )}
        </div>
      </Card>
      {rows.some((row) => row.result) && (
        <Card className="request-accordion">
          <div className="card-head">
            <div>
              <span className="eyebrow">Request details</span>
              <h3>Inspect each real API decision</h3>
            </div>
          </div>
          {rows.map((row) =>
            row.result ? (
              <details key={row.label}>
                <summary>
                  <span>{row.label}</span>
                  <span
                    className={
                      row.result.accepted
                        ? 'status accepted'
                        : 'status rejected'
                    }
                  >
                    {row.result.accepted
                      ? 'ACCEPTED'
                      : `REJECTED ${row.result.reason?.level ?? ''}`}
                  </span>
                </summary>
                <div className="request-detail">
                  <div>
                    <span>Method</span>
                    <strong>POST</strong>
                  </div>
                  <div>
                    <span>Endpoint</span>
                    <strong>/v1/consume</strong>
                  </div>
                  <div>
                    <span>User</span>
                    <strong>{row.result.userRef}</strong>
                  </div>
                  <div>
                    <span>Units</span>
                    <strong>{number(row.result.units)}</strong>
                  </div>
                  <div>
                    <span>Request ID</span>
                    <strong className="mono">{row.result.requestId}</strong>
                  </div>
                  <div>
                    <span>Account remaining After Request</span>
                    <strong>{number(row.result.account.remaining)}</strong>
                  </div>
                  <div>
                    <span>User remaining</span>
                    <strong>{number(row.result.user.remaining)}</strong>
                  </div>
                  {row.result.reason && (
                    <div className="request-reason">
                      <span>Primary reason</span>
                      <strong>
                        {row.result.reason.level}{' '}
                        {row.result.reason.rule.replaceAll('_', ' ')}
                      </strong>
                    </div>
                  )}
                </div>
              </details>
            ) : null,
          )}
        </Card>
      )}
    </div>
  );
}
