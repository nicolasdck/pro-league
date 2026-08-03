import { useNews } from '../hooks/useNews';
import { useTeams } from '../hooks/useTeams';

const dateFormatter = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function NewsList() {
  const { data: news, isLoading, isError } = useNews();
  const { data: teams } = useTeams();

  if (isLoading) return <div className="p-4 text-center text-sm text-neutral-500">Chargement des actus…</div>;
  if (isError || !news) {
    return (
      <div className="p-4 text-center text-sm text-red-600">Impossible de charger les actus pour le moment.</div>
    );
  }
  if (news.length === 0) {
    return <div className="p-4 text-center text-sm text-neutral-500">Aucune actualité pour l'instant.</div>;
  }

  const teamsById = new Map((teams ?? []).map((team) => [team.id, team]));

  return (
    <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
      {news.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 py-3 first:pt-0"
        >
          {item.imageUrl && (
            <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-neutral-900 dark:text-neutral-100">{item.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span>{dateFormatter.format(new Date(item.publishedAt))}</span>
              {item.teamIds.map((teamId) => {
                const team = teamsById.get(teamId);
                if (!team) return null;
                return (
                  <span key={teamId} className="flex items-center gap-1">
                    {team.logo && <img src={team.logo} alt="" className="h-3.5 w-3.5 object-contain" />}
                    {team.name}
                  </span>
                );
              })}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
