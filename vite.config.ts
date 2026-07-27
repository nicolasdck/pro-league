import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: 'Jupiler Pro League',
				short_name: 'Pro League',
				description: 'Classement, calendrier et résultats de la Jupiler Pro League',
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
			},
			workbox: {
				// Default globPatterns don't cover public/ assets like the team
				// badges, which we self-host precisely so they work offline too.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
				// Cache Supabase REST responses so the last synced data stays
				// available offline, while still checking the network first.
				runtimeCaching: [
					{
						urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'supabase-data',
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
			},
		}),
	],
});
