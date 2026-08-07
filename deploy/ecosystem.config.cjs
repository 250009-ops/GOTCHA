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
      max_memory_restart: '512M',
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
