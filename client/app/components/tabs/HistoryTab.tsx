'use client';

import { useEffect, useState } from 'react';
import type { HistoryItem } from '../../types';
import { api } from '../../lib/api';
import { ActivityTable, Card, Empty, monthNow } from '../ui';

export function HistoryTab({
  setError,
}: {
  setError: (e: string | null) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [outcome, setOutcome] = useState('');
  const [month, setMonth] = useState(monthNow());
  useEffect(() => {
    const query = new URLSearchParams({ limit: '50', month });
    if (outcome) query.set('outcome', outcome);
    api<{ items: HistoryItem[] }>(`/history?${query}`)
      .then((x) => setItems(x.items))
      .catch((e) => setError(e.message));
  }, [month, outcome, setError]);
  return (
    <Card className="table-card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Immutable request log</span>
          <h3>Consumption history</h3>
        </div>
        <div className="filters">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">All outcomes</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>
      {items.length ? (
        <ActivityTable items={items} />
      ) : (
        <Empty text="No decisions match these filters." />
      )}
    </Card>
  );
}
