// pm2 — mantém backend (Express + scheduler de posting/repost) e frontend rodando 24h no PC.
// Subir: pm2 start ecosystem.config.js && pm2 save   |   Logs: pm2 logs ml-ofertas-backend
// Requer build antes: npm run build (backend: tsc | frontend: next build)
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
    {
      name: 'ml-ofertas-frontend',
      cwd: __dirname + '/packages/frontend',
      script: __dirname + '/node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      time: true,
    },
  ],
}
