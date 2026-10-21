'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HistoryItem, Usage } from '../../types';
import { api } from '../../lib/api';
import { Card, Empty, Metric, Progress, monthNow, number } from '../ui';

export function InsightsTab({
  setError,
}: {
  setError: (e: string | null) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    Promise.all([
      api<{ items: HistoryItem[] }>(`/history?month=${monthNow()}&limit=100`),
      api<Usage>(`/usage?month=${monthNow()}&limit=100`),
    ])
      .then(([h, u]) => {
        setItems(h.items);
        setUsage(u);
      })
      .catch((e) => setError(e.message));
  }, [setError]);
  const accepted = items.filter((x) => x.outcome === 'ACCEPTED');
  const rejected = items.filter((x) => x.outcome === 'REJECTED');
  const avg = accepted.length
    ? Math.round(
        accepted.reduce((sum, x) => sum + x.units, 0) / accepted.length,
      )
    : 0;
  const exhaustion =
    usage?.account.consumed && avg
      ? Math.max(0, Math.floor(usage.account.remaining / avg))
      : null;
  const reasons = useMemo(
    () =>
      rejected.reduce<Record<string, number>>((all, item) => {
        const key = item.reason
          ? `${item.reason.level} آ· ${item.reason.rule.replaceAll('_', ' ')}`
          : 'Unknown';
        all[key] = (all[key] ?? 0) + 1;
        return all;
      }, {}),
    [rejected],
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">Deterministic signals</span>
          <h3>What the traffic says.</h3>
          <p className="muted">
            Calculated directly from usage and request history. No generated
            estimates.
          </p>
        </div>
      </div>
      <div className="stats-grid">
        <Metric
          label="Acceptance rate"
          value={
            items.length
              ? `${Math.round((accepted.length / items.length) * 100)}%`
              : '0'
          }
          detail={`${accepted.length} accepted آ· ${rejected.length} rejected`}
          icon="0"
        />
        <Metric
          label="Average accepted request"
          value={avg ? `${number(avg)} units` : '0'}
          detail="Based on this month"
        />
        <Metric
          label="Estimated requests left"
          value={exhaustion === null ? '0' : number(exhaustion)}
          detail="At current average size"
        />
        <Metric
          label="Consumed this month"
          value={usage ? number(usage.account.consumed) : '0'}
          detail={
            usage
              ? `${number(usage.account.remaining)} remaining`
              : 'Loading usage'
          }
        />
      </div>
      <div className="content-grid">
        <Card>
          <div className="card-head">
            <div>
              <span className="eyebrow">Rejection breakdown</span>
              <h3>Why requests stop</h3>
            </div>
          </div>
          {Object.keys(reasons).length ? (
            Object.entries(reasons).map(([key, value]) => (
              <div className="breakdown" key={key}>
                <div>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
                <Progress
                  used={value}
                  total={rejected.length}
                  color="bg-rose-400"
                />
              </div>
            ))
          ) : (
            <Empty text="No rejected requests in the selected month." />
          )}
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <span className="eyebrow">Capacity outlook</span>
              <h3>Account quota</h3>
            </div>
          </div>
          {usage && (
            <>
              <div className="outlook">
                <strong>{number(usage.account.remaining)}</strong>
                <span>units remaining</span>
              </div>
              <Progress
                used={usage.account.consumed}
                total={usage.account.monthlyAllowance}
              />
              <div className="level-row">
                <span>{number(usage.account.consumed)} consumed</span>
                <strong>
                  {number(usage.account.monthlyAllowance)} allowance
                </strong>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
