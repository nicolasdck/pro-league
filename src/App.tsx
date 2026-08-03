import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { StandingsTable } from './components/StandingsTable';
import { FixturesList } from './components/FixturesList';
import { CupFixturesList } from './components/CupFixturesList';
import { EuropePage } from './components/EuropePage';
import { SeasonNav } from './components/SeasonNav';
import { TeamAgenda } from './components/TeamAgenda';
import { NewsList } from './components/NewsList';
import { currentSeason } from './lib/season';

type Tab = 'standings' | 'fixtures' | 'cup' | 'europe' | 'news';

const VALID_TABS: Tab[] = ['standings', 'fixtures', 'cup', 'europe', 'news'];

// Reads the `?tab=` param set by a PWA shortcut (see vite.config.ts) so a
// long-press launch lands directly on that tab instead of always opening
// on Classement. Only consulted once, at mount.
function initialTabFromUrl(): Tab {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return VALID_TABS.includes(requested as Tab) ? (requested as Tab) : 'standings';
}

function App() {
  const [tab, setTab] = useState<Tab>(initialTabFromUrl);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const [season, setSeason] = useState<number>(currentSeason());

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-100">
      <Header isNewsActive={tab === 'news'} onNewsClick={() => setTab('news')} />
      <OfflineBanner />

      <nav className="flex border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <TabButton label="Classement" active={tab === 'standings'} onClick={() => setTab('standings')} />
        <TabButton label="Calendrier" active={tab === 'fixtures'} onClick={() => setTab('fixtures')} />
        <TabButton label="Coupe" active={tab === 'cup'} onClick={() => setTab('cup')} />
        <TabButton label="Europe" active={tab === 'europe'} onClick={() => setTab('europe')} />
      </nav>

      <TeamAgenda />

      <main className="mx-auto max-w-3xl p-4 pb-20">
        {tab === 'standings' && <StandingsTable season={season} />}
        {tab === 'fixtures' && <FixturesList season={season} />}
        {tab === 'cup' && <CupFixturesList />}
        {tab === 'europe' && <EuropePage />}
        {tab === 'news' && <NewsList />}
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
