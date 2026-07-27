// Manually triggers api/sync.ts locally, outside of Vercel, since `npm run dev`
// (Vite) never serves the /api directory. Useful while iterating before deploy,
// or to backfill a historical season.
//
// Usage: npm run sync:local [season]   (season defaults to the current one)

import handler from '../api/sync.ts';

const season = process.argv[2];
const req = {
  query: season ? { season } : {},
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
