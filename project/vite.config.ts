import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
 plugins: [
 react(),
 VitePWA({
 registerType: 'autoUpdate',
 manifest: {
 name: 'Fitness Log · 力量训练记录',
 short_name: 'Fitness Log',
 description: '本地优先的力量训练记录、渐进超负荷建议与每周打卡',
 theme_color: '#ffffff',
 },
 workbox: {
 globPatterns: ['**/*.{js,css,html,ico,png,svg}']
 }
 })
 ],
 // Configurazione per il server di sviluppo
 // se non funziona il live reload (SOPRATTUTTO PER CHI USA WSL)
 server: {
 watch: {
 usePolling: true
 }
 },
 
 optimizeDeps: {
 exclude: ['lucide-react'],
 },
});
