'use client';

import { useEffect, useState } from 'react';
import type { Account, Tab } from './types';
import { ErrorBox } from './components/ui';
import { Welcome } from './components/Welcome';
import { OverviewTab } from './components/tabs/OverviewTab';
import { UsersTab } from './components/tabs/UsersTab';
import { PlansTab } from './components/tabs/PlansTab';
import { DemoTab } from './components/tabs/DemoTab';
import { SimulatorTab } from './components/tabs/SimulatorTab';
import { HistoryTab } from './components/tabs/HistoryTab';
import { InsightsTab } from './components/tabs/InsightsTab';

const nav: Tab[] = [
  'Overview',
  'Users',
  'Plans',
  'Demo',
  'Simulator',
  'History',
  'Insights',
];

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/session')
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated) setAccount(data.account);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen">Loading workspace</div>;
  if (!account) return <Welcome onReady={setAccount} />;

  async function logout() {
    await fetch('/api/session', { method: 'DELETE' });
    setAccount(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav>
          {nav.map((item) => (
            <button
              key={item}
              className={tab === item ? 'selected' : ''}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header>
          <div>
            <div className="breadcrumb">
              Workspace <span>/</span> {tab}
            </div>
            <h2>{tab === 'Overview' ? 'Good to see you' : tab}</h2>
          </div>
          <div className="header-actions">
            <button className="button secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <ErrorBox error={error} />
        {tab === 'Overview' && (
          <OverviewTab account={account} setTab={setTab} setError={setError} />
        )}
        {tab === 'Users' && <UsersTab setError={setError} />}
        {tab === 'Plans' && (
          <PlansTab
            account={account}
            setAccount={setAccount}
            setError={setError}
          />
        )}
        {tab === 'Demo' && (
          <DemoTab setError={setError} setAccount={setAccount} />
        )}
        {tab === 'Simulator' && <SimulatorTab setError={setError} />}
        {tab === 'History' && <HistoryTab setError={setError} />}
        {tab === 'Insights' && <InsightsTab setError={setError} />}
      </main>
    </div>
  );
}
