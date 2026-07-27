# Jupiler Pro League PWA

Suivi de la Division 1A belge (classement, calendrier, résultats, historique 3 saisons), en React + TypeScript + Tailwind CSS v4, installable en PWA.

Le client ne parle jamais directement à l'API de données. Toutes les données transitent par Supabase, alimenté par une synchro serveur planifiée.

> **Note sur la source de données** : le brief initial prévoyait API-Football (100 req/jour en gratuit), mais son plan gratuit est verrouillé sur une plage fixe de saisons passées (2022-2024) et refuse tout accès à la saison en cours ou à 2025. L'app utilise donc **[TheSportsDB](https://www.thesportsdb.com/)**, dont le plan gratuit couvre la saison en cours (clé de test partagée `123`, ~30 req/min — voir les avertissements plus bas). Données fournies par TheSportsDB.

## Architecture

- **Frontend** : Vite + React 19 + TypeScript, Tailwind v4, `@tanstack/react-query`, `lucide-react`.
- **Données** : Supabase Postgres (`teams`, `fixtures`, `sync_logs`, `user_preferences`), lecture publique via RLS. Il n'y a **pas** de table `standings` : le classement est calculé côté client à partir des résultats (voir plus bas).
- **Synchro** : `api/sync.ts`, une fonction serverless Vercel déclenchée par `vercel.json` (cron), qui récupère le calendrier complet d'une saison depuis TheSportsDB et fait un `upsert` dans Supabase avec la clé de service.
- **PWA** : `vite-plugin-pwa`, cache Stale-While-Revalidate sur les réponses Supabase pour un fonctionnement hors-ligne avec les dernières données connues.

## Mise en route

```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

1. Créer un projet Supabase et exécuter [`supabase/schema.sql`](supabase/schema.sql) dans l'éditeur SQL (ou `supabase db push` avec la CLI).
2. Renseigner les variables d'environnement (voir `.env.example`) :
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` : utilisées par le client React.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` : utilisées uniquement par `api/sync.ts` (jamais exposées au navigateur).
   - `THESPORTSDB_API_KEY` : `123` fonctionne (clé de test gratuite partagée). **Peu fiable en pratique** (voir avertissement ci-dessous) — pour un usage sérieux, prendre une clé personnelle via le [Patreon TheSportsDB](https://www.patreon.com/thesportsdb) (~9$/mois).
   - `CRON_SECRET` : jeton partagé pour protéger l'endpoint `/api/sync` (transmis en `?secret=` ou en header `Authorization: Bearer`). Vercel Cron l'envoie automatiquement en header si la variable est définie sur le projet.
3. Avant de déployer, on peut déclencher une synchro manuelle en local (voir ci-dessous) puisque `npm run dev` (Vite) ne sert jamais le dossier `/api`.
4. Déployer sur Vercel : mêmes variables dans les Project Settings ; `vercel.json` déclare un cron 1x/jour et un `maxDuration` de 90s (une synchro complète d'une saison peut prendre ~1 min).

> **Limite Vercel Hobby** : le plan gratuit **refuse le déploiement** si un cron est déclaré plus d'une fois par jour (erreur `Hobby accounts are limited to daily cron jobs`, pas juste une limitation silencieuse). Pour un polling plus fréquent les jours de match, passer au plan Pro ou déclencher `/api/sync?secret=...` depuis un scheduler externe (GitHub Actions, cron-job.org).

> **⚠️ Fiabilité de la clé de test `123`** : en pratique, cette clé partagée déclenche régulièrement un ban Cloudflare temporaire (HTTP 429, "you are being rate limited") — probablement un quota global partagé entre tous les utilisateurs gratuits dans le monde, pas seulement le trafic de cette app. `api/sync.ts` retente automatiquement avec un backoff, mais une synchro complète peut tout de même échouer. Une clé Patreon personnelle est fortement recommandée en production.

## Déclencher une synchro manuellement

```bash
npm run sync:local        # saison en cours
npm run sync:local 2024   # saison 2024-25 (backfill historique)
```

`scripts/sync-local.mjs` charge `.env.local` et appelle directement le handler de `api/sync.ts`. Le calendrier complet est récupéré journée par journée (`eventsround.php`) car l'endpoint saison complète de TheSportsDB est plafonné à 15 matchs sur le plan gratuit — ça prend une minute ou deux.

## Classement : calculé, pas synchronisé

`lookuptable.php` (l'endpoint classement de TheSportsDB) est plafonné à **5 lignes sur le plan gratuit, même pour une saison entièrement terminée** (vérifié). Le classement est donc calculé côté client dans [`src/lib/standings.ts`](src/lib/standings.ts) à partir des résultats de tous les matchs de la saison (déjà récupérés en entier via `api/sync.ts`) :

- **Saison 2026-27 et suivantes** : calcul exact — la Pro League passe à un format simple (18 clubs, aller-retour, sans playoffs).
- **Avant la première journée** : tant que la saison en cours n'a aucun résultat, le tri se fait sur le classement final de la saison précédente plutôt qu'alphabétiquement.
- **2023-24 et 2024-25** : approximation — l'ancien format avec Playoffs 1/2/3 (points divisés par deux à mi-saison, groupes Championship/Europe/Relegation) n'est pas reproduit par un simple cumul 3-1-0 sur tous les matchs.
- **2025-26** : classement officiel saisi à la main dans [`src/lib/historicalStandingsOverrides.ts`](src/lib/historicalStandingsOverrides.ts), pour ce même problème de playoffs — c'est la seule saison historique avec des chiffres exacts.

Les zones de qualification européenne (Ligue des Champions / Europa / Conférence) sont une liste éditée à la main dans [`src/lib/europeanQualification.ts`](src/lib/europeanQualification.ts), affichée sur le classement 2025-26 et sur celui de la saison en cours.

## Historique (menu du bas)

Un menu fixe en bas de l'écran ([`SeasonNav`](src/components/SeasonNav.tsx)) permet de basculer entre la saison actuelle et les 3 précédentes ; les onglets Classement/Calendrier du haut s'appliquent à la saison sélectionnée.

## Coupe de Belgique

Non implémentée : introuvable dans le catalogue de compétitions belges de TheSportsDB (plan gratuit), et API-Football bloque les mêmes saisons récentes que pour la ligue. À reprendre si une source de données fiable est trouvée.

## Logos des équipes (aucun lien externe)

Aucune image n'est jamais chargée depuis un CDN tiers : les blasons sont téléchargés une fois, redimensionnés et compressés en WebP dans [`public/team-logos/`](public/team-logos) (`/team-logos/<id>.webp`, ~120 Ko pour les 18 clubs contre ~1.8 Mo pour les PNG bruts de TheSportsDB), servis en same-origin et précachés par le service worker pour fonctionner hors-ligne.

```bash
npm run logos:localize
```

`scripts/localize-logos.mjs` (utilise `sharp`) télécharge le logo de chaque équipe dont `teams.logo` n'est pas encore un `.webp` local, le redimensionne (128px max) et l'enregistre dans `public/team-logos/`, puis met à jour la ligne en base avec le chemin local. `api/sync.ts` ne touche plus jamais `logo` une fois qu'il pointe vers un chemin local (`/...`) — sinon chaque synchro le remplacerait par l'URL externe de TheSportsDB. [`supabase/seed.sql`](supabase/seed.sql) référence directement ces chemins locaux pour les 18 clubs actuels.

À relancer après une promotion/relégation qui introduit une nouvelle équipe (celle-ci apparaît d'abord avec l'URL externe de TheSportsDB le temps qu'on relance le script).

## Thème dynamique par équipe

Tailwind v4 n'utilise plus de `tailwind.config.js` classique : les couleurs sont déclarées dans [`src/index.css`](src/index.css) via `@theme`, en pointant vers des variables CSS (`--team-primary`, `--team-secondary`, ...). [`TeamThemeContext`](src/context/TeamThemeContext.tsx) réécrit ces variables sur `document.documentElement` quand l'utilisateur choisit son équipe favorite (persistée en `localStorage`), ce qui met à jour toute l'UI (`bg-team-primary`, `text-team-primary`, ..., et la scrollbar) sans recompilation.

## Structure

```
api/sync.ts                        # Fonction serverless : TheSportsDB -> Supabase (fixtures uniquement)
scripts/sync-local.mjs             # Déclenche la synchro en local (hors Vercel dev)
scripts/localize-logos.mjs         # Télécharge les logos en local, aucun lien externe
scripts/generate-app-icon.mjs      # Génère les icônes PWA depuis pro-league-logo.jpg
public/team-logos/                 # Logos des 18 clubs, servis en same-origin
supabase/schema.sql                # Schéma Postgres + RLS
supabase/seed.sql                  # Couleurs + logos locaux des 18 clubs actuels
src/lib/standings.ts               # Calcul du classement depuis les résultats
src/lib/historicalStandingsOverrides.ts  # Classement officiel 2025-26 (saisi à la main)
src/lib/europeanQualification.ts   # Zones de qualification européenne (saisi à la main)
src/hooks/                         # react-query (teams, fixtures) + favoris/online/PWA
src/context/                       # TeamThemeContext (thème dynamique)
src/components/                    # Header, StandingsTable, FixturesList, SeasonNav, ...
vercel.json                        # Cron de synchronisation
```

## Icônes PWA

L'onglet du navigateur garde `public/favicon.svg` (compatible Chrome/Edge). L'icône d'installation (manifest + écran d'accueil iOS) est générée depuis `public/pro-league-logo.jpg` :

```bash
npm run icon:generate
```

`scripts/generate-app-icon.mjs` (utilise `sharp`) compose le logo sur un canevas carré blanc (logo à ~90% de la taille, léger bord blanc) et produit `icon-192.png` / `icon-512.png` (référencés dans le manifest via `vite.config.ts`) et `apple-touch-icon.png` (180×180, référencé dans `index.html`). À relancer si `pro-league-logo.jpg` est remplacé.
