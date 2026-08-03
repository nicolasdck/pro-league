import { Newspaper, Trophy } from 'lucide-react';
import { TeamSelector } from './TeamSelector';

export function Header({ isNewsActive, onNewsClick }: { isNewsActive: boolean; onNewsClick: () => void }) {
	return (
		<header className="flex items-center justify-between bg-team-secondary p-2 text-team-secondary-fg shadow-sm">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2 font-bold">
					<Trophy className="h-6 w-6 text-team-primary" />
					<span>Pro League</span>
				</div>
				<button
					type="button"
					onClick={onNewsClick}
					className={
						isNewsActive
							? 'flex items-center gap-1.5 rounded-lg bg-team-primary px-2.5 py-1.5 text-sm font-medium text-white'
							: 'flex items-center gap-1.5 rounded-lg bg-team-secondary/10 px-2.5 py-1.5 text-sm font-medium text-team-secondary-fg'
					}
				>
					<Newspaper className="h-4 w-4" />
					Actus
				</button>
			</div>
			<TeamSelector />
		</header>
	);
}
