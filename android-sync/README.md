# Pro League Sync (Android)

App Android minimaliste dont le seul but est de garder les scores en direct
à jour dans Supabase même quand personne n'a l'app web ouverte — voir la
discussion dans le repo principal pour le contexte complet.

Adaptée du pattern déjà utilisé dans `worldcup-2026/android-sync`, mais
nettement plus simple : **aucune clé sensible embarquée dans cette app**
(pas de clé service_role Supabase). Elle fait deux choses en arrière-plan :

1. **Décider s'il faut synchroniser** : lit le calendrier public
   (`fixtures` / `cup_fixtures` / `european_fixtures`, lecture seule via la
   clé *anon* Supabase — RLS n'autorise que le `SELECT`) pour savoir si un
   match est en cours ou proche, sans plage horaire à configurer à la main
   — voir `sync/ScheduleChecker.kt`.
2. **Synchroniser** : si oui, appelle les deux mêmes endpoints publics que
   le navigateur appelle déjà — voir `sync/SyncRunner.kt` :
   - `GET {BASE_URL}/api/live-scores` (championnat)
   - `GET {BASE_URL}/api/live-scores-euro` (Coupe + CL/EL/ECL)

   Les deux sont sans paramètres = mode auto-découverte : chaque endpoint
   interroge lui-même Supabase pour savoir quels matchs sont actuellement
   dans leur fenêtre live, puis scrape footmercato.net pour les scores.

Toute la logique sensible (clé service_role Supabase, scraping footmercato)
reste côté Vercel (`api/live-scores.ts` / `api/live-scores-euro.ts` dans le
repo principal).

## Pourquoi une app dédiée plutôt qu'un simple onglet ouvert

Le polling côté navigateur (`useLiveScorePolling*.ts`) s'arrête volontairement
dès que l'onglet n'est plus visible (économie de batterie pour les ~50
utilisateurs) — un téléphone en poche, écran éteint, ne suffit donc pas.
Cette app utilise un `Service` Android en avant-plan avec notification
persistante, qui exempte le process du mode Doze et continue de tourner
écran éteint.

## Mise en route

1. **Ouvrir dans Android Studio** : `File > Open`, sélectionner ce dossier
   `android-sync/`.
2. **Configurer les secrets** : copier `app/secrets.properties.example` en
   `app/secrets.properties` (gitignored) et renseigner `SUPABASE_URL` /
   `SUPABASE_ANON_KEY` — les mêmes valeurs publiques que
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dans le `.env.local` du
   repo principal (déjà présentes dans le bundle JS de l'app web, donc pas
   un vrai secret, mais gitignored par principe).
3. **Vérifier l'URL de base** dans `app/build.gradle.kts` (`BASE_URL`) —
   par défaut pointée sur `https://pro-league-delta.vercel.app`. La changer
   si le déploiement Vercel change d'URL.
4. **Lancer sur ton téléphone** (câble USB + mode développeur/débogage USB
   activé, ou directement depuis Android Studio avec le téléphone connecté).
5. Dans l'app :
   - Activer "Synchronisation active".
   - Cliquer "Désactiver l'optimisation de batterie" (sinon Android peut
     quand même tuer le service au bout d'un moment, notification
     persistante ou non).
   - Choisir une fréquence (5 min par défaut — c'est un filet de sécurité,
     pas le mécanisme principal de fraîcheur : quand quelqu'un a l'app web
     ouverte, le polling côté navigateur reste à ~30s). Rien d'autre à
     configurer : les fenêtres de synchro sont automatiques.
6. Vérifier que ça marche : bouton "Sync maintenant", puis regarder
   l'historique en bas de l'écran (nombre de matchs mis à jour, succès/échec),
   ou la notification persistante ("Aucun match en cours — prochain : ...").
7. Bouton "Calendrier" en haut de l'écran : liste tous les matchs
   (championnat/Coupe/Europe, tous statuts), triée du plus récent au plus
   ancien, filtrable par date. Cliquer un match déroule l'historique des
   synchros qui ont eu lieu pendant sa fenêtre live (succès/échec/erreur) —
   corrélation par horodatage avec l'historique existant, pas de tracking
   par match côté serveur.

## Permissions demandées

- `POST_NOTIFICATIONS` : pour la notification persistante du service.
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_DATA_SYNC` : type de service
  Android requis pour ce genre de tâche de fond.
- `RECEIVE_BOOT_COMPLETED` : redémarre le service après un reboot du
  téléphone si la synchro était activée.
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` / `WAKE_LOCK` : fiabilité en fond,
  voir l'écran de réglages dans l'app.
- `INTERNET` : pour les appels décrits plus haut. Rien d'autre.

## Structure

Même architecture que `worldcup-2026/android-sync`, en plus simple (pas de
widget, pas de saisie manuelle, pas de sélection de source/équipe, pas de
plages horaires à configurer) :

- `sync/SyncForegroundService.kt` — le service en avant-plan, boucle interne.
- `sync/ScheduleChecker.kt` — lit le calendrier Supabase pour décider s'il y
  a un match en cours ou proche (clé anon, lecture seule).
- `sync/SyncRunner.kt` — les deux appels HTTP vers Vercel (aucune clé,
  aucun body).
- `boot/BootReceiver.kt` — redémarre après reboot si activé.
- `prefs/SyncPreferences.kt` — réglages persistés (DataStore) : activé/non,
  fréquence, historique.
- `ui/SettingsScreen.kt` + `ui/SyncViewModel.kt` — écran principal.
- `ui/ScheduleScreen.kt` + `ui/ScheduleViewModel.kt` — écran "Calendrier"
  (liste des matchs + historique de synchro par match, filtre par date).
