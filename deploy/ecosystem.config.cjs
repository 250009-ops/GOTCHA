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
    },
    {
      name: 'gotcha-worker',
      cwd: path.join(appDir, 'services/worker'),
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
  ],
};
