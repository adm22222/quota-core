import type { ReactNode } from 'react';
import type { HistoryItem } from '../types';

export const number = (value: number) =>
  new Intl.NumberFormat('en-US').format(value);
export const monthNow = () => new Date().toISOString().slice(0, 7);

export function Progress({
  used,
  total,
  color = 'bg-cyan-400',
}: {
  used: number;
  total: number;
  color?: string;
}) {
  const percentage = Math.min(100, total ? (used / total) * 100 : 0);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
export function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="error-box">{error}</div> : null;
}
export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: string;
}) {
  return (
    <Card className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
export function Checklist({
  done,
  label,
  onClick,
}: {
  done: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button className="checklist" onClick={onClick}>
      <span className={done ? 'check done' : 'check'}>{done ? '✓' : ''}</span>
      <span className={done ? 'strike' : ''}>{label}</span>
      {!done && onClick && <span className="arrow">→</span>}
    </button>
  );
}
export function ActivityTable({ items }: { items: HistoryItem[] }) {
  return (
    <div className="data-table">
      <div className="table-row table-header">
        <span>Request</span>
        <span>User</span>
        <span>Units</span>
        <span>Outcome</span>
      </div>
      {items.map((item) => (
        <div
          className="table-row"
          key={`${item.requestId}-${item.processedAt}`}
        >
          <span className="mono">{item.requestId}</span>
          <span>{item.userRef}</span>
          <span>{number(item.units)}</span>
          <span>
            <span
              className={
                item.outcome === 'ACCEPTED'
                  ? 'status accepted'
                  : 'status rejected'
              }
            >
              {item.outcome === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
