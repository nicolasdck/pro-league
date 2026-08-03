// Manually triggers api/sync-news.ts locally, outside of Vercel, since
// `npm run dev` (Vite) never serves the /api directory.
//
// Usage: npm run sync-news:local

import handler from '../api/sync-news.ts';

const req = {
  query: {},
  headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
};

let statusCode = 200;
const res = {
  status(code) {
    statusCode = code;
    return this;
  },
  json(body) {
    console.log(statusCode, JSON.stringify(body, null, 2));
  },
};

await handler(req, res);
if (statusCode >= 400) process.exitCode = 1;
