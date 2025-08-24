module.exports = {
  apps: [
    {
      name: 'discord-servers-enhanced',
      script: 'server.js',
      instances: 1, // Start with 1, can be scaled to 'max' for clustering
      exec_mode: 'fork', // Use 'cluster' for load balancing across instances
      watch: false,
      max_memory_restart: '750M', // Increased for enhanced features
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ENABLE_ANALYTICS: true,
        ENABLE_WEBSOCKET: true,
        ENABLE_VOICE_TRACKING: true,
        ENABLE_ACTIVITY_TRACKING: true,
        UPDATE_INTERVAL: 120000, // 2 minutes
        LOG_LEVEL: 'info'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        watch: true,
        ignore_watch: ['node_modules', 'logs', 'data', 'cache', 'monitoring'],
        ENABLE_DEBUG_LOGS: true,
        UPDATE_INTERVAL: 30000, // 30 seconds for faster development
        LOG_LEVEL: 'debug'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        ENABLE_ANALYTICS: true,
        ENABLE_WEBSOCKET: true,
        UPDATE_INTERVAL: 60000, // 1 minute
        LOG_LEVEL: 'info'
      },
      
      // Enhanced logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // Structured logging for better parsing
      
      // Process management
      kill_timeout: 10000, // Increased for graceful WebSocket disconnections
      restart_delay: 2000,
      max_restarts: 5, // Reduced to prevent restart loops
      min_uptime: '30s', // Increased minimum uptime
      
      // Enhanced monitoring
      monitoring: true,
      pmx: true,
      
      // Advanced PM2 features
      automation: false,
      autorestart: true,
      
      // Scheduled restart for memory cleanup
      cron_restart: '0 4 * * *', // Restart daily at 4 AM
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Enhanced error handling
      crash_retry_delay: 5000,
      
      // Node.js optimization flags
      node_args: [
        '--max-old-space-size=1024', // 1GB heap limit
        '--optimize-for-size', // Memory optimization
        '--gc-interval=100' // Garbage collection interval
      ],
      
      // Health check configuration
      health_check_grace_period: 30000,
      health_check_fatal_exceptions: true,
      
      // Performance monitoring
      trace: true,
      disable_trace: false,
      
      // Advanced configuration
      vizion: true, // Enable versioning
      autorestart: true,
      max_memory_restart: '750M',
      
      // Custom environment for enhanced features
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        
        // Core features
        ENABLE_ANALYTICS: 'true',
        ENABLE_WEBSOCKET: 'true',
        ENABLE_VOICE_TRACKING: 'true',
        ENABLE_ACTIVITY_TRACKING: 'true',
        ENABLE_HEALTH_SCORING: 'true',
        ENABLE_REAL_TIME_UPDATES: 'true',
        ENABLE_PROFILE_SECTION: 'true',
        ENABLE_ANALYTICS_DASHBOARD: 'true',
        
        // Performance settings
        UPDATE_INTERVAL: '120000',
        ANALYTICS_RETENTION_DAYS: '30',
        HEALTH_CHECK_INTERVAL: '120000',
        MAX_WEBSOCKET_CONNECTIONS: '100',
        VOICE_EVENT_RETENTION: '100',
        ACTIVITY_RESET_INTERVAL: '86400000',
        
        // API configuration
        API_RATE_LIMIT: '100',
        API_RATE_LIMIT_WINDOW: '900000',
        
        // Caching
        CACHE_TTL: '300', // 5 minutes
        REDIS_TTL: '600', // 10 minutes
        
        // Logging
        LOG_LEVEL: 'info',
        ENABLE_DEBUG_LOGS: 'false',
        
        // Memory management
        MAX_MEMORY_USAGE: '750',
        GARBAGE_COLLECTION_INTERVAL: '300000',
        
        // Security
        RATE_LIMIT_ENABLED: 'true',
        CORS_ENABLED: 'true'
      }
    },
    
    // Optional: Separate analytics processor
    {
      name: 'analytics-processor',
      script: 'scripts/analytics-processor.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 */6 * * *', // Every 6 hours
      autorestart: false, // Manual restart only
      max_memory_restart: '256M',
      
      env: {
        NODE_ENV: 'production',
        PROCESSOR_TYPE: 'analytics'
      },
      
      log_file: './logs/analytics-processor.log',
      error_file: './logs/analytics-processor.error.log',
      out_file: './logs/analytics-processor.out.log'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: ['ardelagi.web.id'],
      ref: 'origin/main',
      repo: 'git@github.com:ardelagi/discord-servers-showcase.git',
      path: '/var/www/ardelagi.web.id',
      
      // Pre-deployment commands (local)
      'pre-deploy-local': [
        'git add .',
        'git commit -m "Auto-deploy commit" || true',
        'git push origin main'
      ].join(' && '),
      
      // Post-deployment commands (remote)
      'post-deploy': [
        'npm ci --production',
        'npm run build || true',
        'cp .env.example .env || true',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save'
      ].join(' && '),
      
      // Pre-setup commands (remote) - first deployment only
      'pre-setup': [
        'sudo apt update',
        'sudo apt install -y git nodejs npm',
        'sudo npm install -g pm2',
        'pm2 install pm2-logrotate'
      ].join(' && '),
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'node',
      host: 'staging.ardelagi.web.id',
      ref: 'origin/develop',
      repo: 'git@github.com:ardelagi/discord-servers-showcase.git',
      path: '/var/www/staging',
      
      'post-deploy': [
        'npm ci',
        'pm2 reload ecosystem.config.js --env staging'
      ].join(' && '),
      
      env: {
        NODE_ENV: 'staging'
      }
    },
    
    development: {
      user: 'developer',
      host: 'dev.ardelagi.web.id',
      ref: 'origin/develop',
      repo: 'git@github.com:ardelagi/discord-servers-showcase.git',
      path: '/var/www/development',
      
      'post-deploy': [
        'npm install',
        'pm2 reload ecosystem.config.js --env development'
      ].join(' && '),
      
      env: {
        NODE_ENV: 'development'
      }
    }
  },

  // Custom PM2 modules configuration
  module_conf: {
    // Log rotation configuration
    'pm2-logrotate': {
      max_size: '10M',
      retain: '30',
      compress: true,
      dateFormat: 'YYYY-MM-DD_HH-mm-ss',
      workerInterval: '30', // 30 seconds
      rotateInterval: '0 0 * * *', // Daily at midnight
      rotateModule: true
    },
    
    // Auto-pull for automatic deployments
    'pm2-auto-pull': {
      apps: [
        {
          name: 'discord-servers-enhanced',
          script: 'server.js',
          watch_repo: true,
          repo_type: 'git',
          repo_path: '/var/www/ardelagi.web.id',
          branch: 'main'
        }
      ]
    }
  }
};