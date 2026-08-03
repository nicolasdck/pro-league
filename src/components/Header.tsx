import { Newspaper } from 'lucide-react';
import { TeamSelector } from './TeamSelector';

export function Header({
	isNewsActive,
	onNewsClick,
}: {
	isNewsActive: boolean;
	onNewsClick: () => void;
}) {
	return (
		<header className="flex items-center justify-between bg-team-secondary p-2 text-team-secondary-fg shadow-sm">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2 font-bold">
					<span className="text-3xl">⚽</span>
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
