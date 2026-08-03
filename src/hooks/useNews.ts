import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { NewsItem } from '../types';

interface NewsItemRow {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  article_type: string;
  published_at: string;
  team_ids: number[];
}

function mapNewsItem(row: NewsItemRow): NewsItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    imageUrl: row.image_url,
    articleType: row.article_type,
    publishedAt: row.published_at,
    teamIds: row.team_ids,
  };
}

async function fetchNews(limit: number): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as NewsItemRow[]).map(mapNewsItem);
}

export function useNews(limit = 30) {
  return useQuery({
    queryKey: ['news', limit],
    queryFn: () => fetchNews(limit),
    staleTime: 1000 * 60 * 15,
  });
}
