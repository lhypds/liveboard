module.exports = {
  apps: [
    {
      name: 'eitai-dashboard',
      script: 'npm',
      args: 'run preview -- --host --port 4173',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
