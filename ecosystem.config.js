module.exports = {
  apps: [
    {
      name: 'discord-servers-showcase',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        watch: true,
        ignore_watch: ['node_modules', 'logs']
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Monitoring
      monitoring: false,
      pmx: true,
      
      // Advanced PM2 features
      automation: false,
      autorestart: true,
      
      // Cron restart (optional)
      cron_restart: '0 2 * * *', // Restart every day at 2 AM
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Environment specific settings
      node_args: '--max-old-space-size=512'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/discord-servers-showcase.git',
      path: '/var/www/discord-servers-showcase',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
