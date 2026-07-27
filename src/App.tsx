import { useState } from 'react';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { StandingsTable } from './components/StandingsTable';
import { FixturesList } from './components/FixturesList';
import { SeasonNav } from './components/SeasonNav';
import { currentSeason } from './lib/season';

type Tab = 'standings' | 'fixtures';

function App() {
  const [tab, setTab] = useState<Tab>('standings');
  const [season, setSeason] = useState<number>(currentSeason());

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-100">
      <Header />
      <OfflineBanner />

      <nav className="flex border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <TabButton label="Classement" active={tab === 'standings'} onClick={() => setTab('standings')} />
        <TabButton label="Calendrier" active={tab === 'fixtures'} onClick={() => setTab('fixtures')} />
      </nav>

      <main className="mx-auto max-w-3xl p-4 pb-20">
        {tab === 'standings' ? <StandingsTable season={season} /> : <FixturesList season={season} />}
      </main>

      <PWAInstallPrompt />
      <SeasonNav selectedSeason={season} onSelect={setSeason} />
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex-1 border-b-2 border-team-primary px-4 py-3 text-sm font-semibold text-team-primary'
          : 'flex-1 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-neutral-500'
      }
    >
      {label}
    </button>
  );
}

export default App;
