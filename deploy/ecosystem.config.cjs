const path = require('path');

const appDir = process.env.VPS_APP_DIR || '/var/www/gotcha';

module.exports = {
  apps: [
    {
      name: 'gotcha-api',
      cwd: path.join(appDir, 'services/api'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // PDF screenshot + OCR needs headroom; 512M was restarting mid-scan and leaving imports stuck at 0/N.
      max_memory_restart: '1024M',
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      min_uptime: '20s',
    },
    {
      // Postgres import queue. The old Bull worker in services/worker stays on disk and is not started.
      name: 'gotcha-import-worker',
      cwd: path.join(appDir, 'services/api'),
      script: 'dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 30000,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1024M',
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      min_uptime: '20s',
    },
  ],
};
