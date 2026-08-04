import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			// 'prompt' (not 'autoUpdate') + injectRegister: null: registration is
			// done by hand via the `virtual:pwa-register/react` hook (see
			// UpdatePrompt.tsx), so a new build waits for the user to click
			// "Rafraîchir" instead of silently reloading the page under them.
			registerType: 'prompt',
			injectRegister: null,
			// 'injectManifest' (not the default 'generateSW') because the service
			// worker needs a `push` / `notificationclick` handler for goal
			// notifications — see src/sw.ts, which also reproduces the
			// precache + Supabase runtime-cache behaviour generateSW used to
			// provide automatically.
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: 'Pro League',
				short_name: 'Pro League',
				description: 'Classement, calendrier et résultats de la Pro League',
				theme_color: '#1f2937',
				background_color: '#1f2937',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
				],
				// Long-press the installed icon (Android/desktop) to jump straight
				// past the tab bar — read back by App.tsx's `?tab=` handling.
				shortcuts: [
					{
						name: 'Classement',
						short_name: 'Classement',
						description: 'Voir le classement de la Pro League',
						url: '/?tab=standings',
						icons: [
							{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
						],
					},
					{
						name: 'Mon équipe',
						short_name: 'Mon équipe',
						description: 'Voir le calendrier de mon équipe favorite',
						url: '/?tab=fixtures',
						icons: [
							{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
						],
					},
				],
			},
			injectManifest: {
				// Default globPatterns don't cover public/ assets like the team
				// badges, which we self-host precisely so they work offline too.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
			},
		}),
	],
});
