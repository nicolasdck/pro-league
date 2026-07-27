import { Trophy } from 'lucide-react';
import { TeamSelector } from './TeamSelector';

export function Header() {
  return (
    <header className="flex items-center justify-between bg-team-secondary px-4 py-3 text-team-secondary-fg shadow-sm">
      <div className="flex items-center gap-2 font-bold">
        <Trophy className="h-6 w-6 text-team-primary" />
        <span>Jupiler Pro League</span>
      </div>
      <TeamSelector />
    </header>
  );
}
