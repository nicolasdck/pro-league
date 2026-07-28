// Manually triggers api/sync-cl.ts, sync-el.ts or sync-ecl.ts locally,
// outside of Vercel, since `npm run dev` (Vite) never serves the /api
// directory. One script for all three since they only differ by which
// competition module they load — see src/lib/europeSyncHandler.ts.
//
// Usage: npm run sync-europe:local -- cl|el|ecl

const competition = process.argv[2];
const modules = { cl: '../api/sync-cl.ts', el: '../api/sync-el.ts', ecl: '../api/sync-ecl.ts' };
const modulePath = modules[competition];
if (!modulePath) {
  console.error(`Usage: npm run sync-europe:local -- ${Object.keys(modules).join('|')}`);
  process.exit(1);
}

const { default: handler } = await import(modulePath);

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
