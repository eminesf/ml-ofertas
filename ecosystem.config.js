// pm2 — mantém o backend (API + scheduler de posting/scrapes) rodando 24h no PC.
// O site público roda na Vercel; não há mais frontend local (desligado em 23/11/2026).
// Subir: pm2 start ecosystem.config.js && pm2 save   |   Logs: pm2 logs ml-ofertas-backend
// Requer build antes: npm run build -w @ml-afiliados/backend (tsc)
module.exports = {
  apps: [
    {
      name: 'ml-ofertas-backend',
      cwd: __dirname + '/packages/backend',
      script: 'dist/index.js',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      time: true,
    },
  ],
}
