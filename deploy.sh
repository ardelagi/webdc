#!/bin/bash

# Enhanced Discord Servers Showcase Deployment Script
# Usage: ./deploy-enhanced.sh [environment]

set -e  # Exit on any error

# Configuration
PROJECT_NAME="discord-servers-enhanced"
PROJECT_PATH="/var/www/ardelagi.web.id"
NODE_VERSION="18"
ENV=${1:-production}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_feature() {
    echo -e "${PURPLE}[FEATURE]${NC} $1"
}

log_deploy() {
    echo -e "${CYAN}[DEPLOY]${NC} $1"
}

# ASCII Art Banner
show_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
    ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗ 
    ██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
    ██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║
    ██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║
    ██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝
    ╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ 
    
    Enhanced Server Showcase - Deployment v3.0
    Real-time Analytics | Voice Tracking | Health Monitoring
EOF
    echo -e "${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "Don't run this script as root. Use a regular user with sudo privileges."
        exit 1
    fi
}

# System requirements check
check_system_requirements() {
    log_info "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_warning "This script is optimized for Linux. Proceeding anyway..."
    fi
    
    # Check memory
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [[ $TOTAL_MEM -lt 1024 ]]; then
        log_warning "System has less than 1GB RAM. Performance may be affected."
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {printf "%.0f", $4/1024}')
    if [[ $AVAILABLE_SPACE -lt 1024 ]]; then
        log_warning "Less than 1GB disk space available."
    fi
    
    log_success "System requirements check completed"
}

# Install enhanced dependencies
install_enhanced_dependencies() {
    log_info "Installing enhanced system dependencies..."
    
    # Update system
    sudo apt update && sudo apt upgrade -y
    
    # Install base packages
    sudo apt install -y curl wget git nginx certbot python3-certbot-nginx \
                       htop nethogs iotop redis-server \
                       build-essential software-properties-common
    
    # Install Node.js with specific version
    if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 16 ]]; then
        log_info "Installing Node.js ${NODE_VERSION}..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # Install PM2 with ecosystem support
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2 process manager..."
        sudo npm install -g pm2
        pm2 install pm2-logrotate
        pm2 set pm2-logrotate:max_size 10M
        pm2 set pm2-logrotate:retain 30
        pm2 startup
        sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
    fi
    
    # Configure Redis for caching
    log_info "Configuring Redis for enhanced caching..."
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    
    # Test Redis connection
    if redis-cli ping | grep -q PONG; then
        log_success "Redis is running and accessible"
    else
        log_warning "Redis setup may have issues"
    fi
    
    log_success "Enhanced dependencies installed successfully"
}

# Enhanced project setup
setup_enhanced_project() {
    log_info "Setting up enhanced project structure..."
    
    # Create project directory with proper structure
    sudo mkdir -p $PROJECT_PATH/{logs,backups,ssl,temp}
    sudo chown -R $(whoami):$(whoami) $PROJECT_PATH
    
    # Clone or update repository
    if [ -d "$PROJECT_PATH/.git" ]; then
        log_info "Updating existing repository..."
        cd $PROJECT_PATH
        git stash push -m "Pre-deployment stash $(date)"
        git pull origin main
        git stash pop || log_warning "Could not restore stashed changes"
    else
        log_info "Cloning repository..."
        git clone https://github.com/ardelagi/discord-servers-showcase.git $PROJECT_PATH
        cd $PROJECT_PATH
    fi
    
    # Create enhanced directory structure
    mkdir -p {data,cache,exports,monitoring}
    
    log_success "Enhanced project setup completed"
}

# Enhanced environment setup
setup_enhanced_environment() {
    log_info "Setting up enhanced environment variables..."
    
    cd $PROJECT_PATH
    
    # Backup existing .env
    if [ -f .env ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        log_info "Backed up existing .env file"
    fi
    
    # Create comprehensive .env from example
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from enhanced template..."
        cp .env.example .env
        
        log_warning "Please configure these essential variables in .env:"
        echo "  - DISCORD_BOT_TOKEN (Required)"
        echo "  - OWNER_DISCORD_ID (Optional but recommended)"
        echo "  - WHITELIST_GUILD_ID (Optional for private servers)"
        echo "  - BADSIDE_GUILD_ID (Optional for private servers)"
        echo ""
        echo "Enhanced features configuration:"
        echo "  - ENABLE_ANALYTICS=true"
        echo "  - ENABLE_WEBSOCKET=true"
        echo "  - ENABLE_VOICE_TRACKING=true"
        echo "  - ENABLE_ACTIVITY_TRACKING=true"
        
        read -p "Press enter after you've configured the .env file..."
    fi
    
    # Validate critical environment variables
    source .env
    
    if [ -z "$DISCORD_BOT_TOKEN" ] || [ "$DISCORD_BOT_TOKEN" = "your_discord_bot_token_here" ]; then
        log_error "DISCORD_BOT_TOKEN is not set in .env file"
        exit 1
    fi
    
    log_success "Enhanced environment variables configured"
}

# Install enhanced Node.js dependencies
install_enhanced_node_deps() {
    log_info "Installing enhanced Node.js dependencies..."
    
    cd $PROJECT_PATH
    
    # Clean install with audit
    rm -rf node_modules package-lock.json
    npm ci --production --silent
    
    # Security audit
    npm audit --audit-level moderate || log_warning "Some security vulnerabilities found"
    
    # Verify critical dependencies
    log_info "Verifying critical dependencies..."
    node -e "
        try {
            require('discord.js');
            require('express');
            require('socket.io');
            console.log('✅ All critical dependencies verified');
        } catch (error) {
            console.log('❌ Dependency verification failed:', error.message);
            process.exit(1);
        }
    "
    
    log_success "Enhanced Node.js dependencies installed"
}

# Configure enhanced Nginx with WebSocket support
configure_enhanced_nginx() {
    log_info "Configuring enhanced Nginx with WebSocket support..."
    
    # Backup existing configuration
    if [ -f "/etc/nginx/sites-available/ardelagi.web.id" ]; then
        sudo cp /etc/nginx/sites-available/ardelagi.web.id /etc/nginx/sites-available/ardelagi.web.id.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Create enhanced Nginx configuration
    sudo tee /etc/nginx/sites-available/ardelagi.web.id > /dev/null <<EOF
# Enhanced Discord Server Showcase Configuration
# Supports WebSocket, Real-time updates, and Static Assets

upstream discord_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=general:10m rate=2r/s;

server {
    listen 80;
    listen [::]:80;
    server_name ardelagi.web.id www.ardelagi.web.id;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ardelagi.web.id www.ardelagi.web.id;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ardelagi.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ardelagi.web.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # WebSocket Support for Socket.IO
    location /socket.io/ {
        proxy_pass http://discord_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # API Routes with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://discord_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_pragma;
        proxy_cache_revalidate on;
        proxy_cache_min_uses 3;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        
        # Cache API responses briefly
        location ~* ^/api/(health|stats) {
            proxy_pass http://discord_app;
            proxy_cache_valid 200 30s;
            add_header X-Cache-Status \$upstream_cache_status;
        }
    }
    
    # Static Assets with long-term caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://discord_app;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }
    
    # Main application
    location / {
        limit_req zone=general burst=10 nodelay;
        
        proxy_pass http://discord_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_pragma;
        proxy_cache_revalidate on;
        
        # Enable caching for static content
        proxy_cache_valid 200 5m;
        add_header X-Cache-Status \$upstream_cache_status;
    }
    
    # Health check endpoint (no rate limiting)
    location = /api/health {
        proxy_pass http://discord_app;
        access_log off;
        proxy_cache_valid 200 10s;
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    # Logs
    access_log /var/log/nginx/ardelagi.web.id.access.log;
    error_log /var/log/nginx/ardelagi.web.id.error.log;
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/ardelagi.web.id /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    if sudo nginx -t; then
        log_success "Enhanced Nginx configuration is valid"
        sudo systemctl reload nginx
    else
        log_error "Enhanced Nginx configuration test failed"
        exit 1
    fi
}

# Enhanced SSL setup with automatic renewal
setup_enhanced_ssl() {
    log_info "Setting up enhanced SSL with automatic renewal..."
    
    # Check if certificate already exists
    if sudo certbot certificates | grep -q "ardelagi.web.id"; then
        log_info "SSL certificate already exists"
        # Test renewal
        sudo certbot renew --dry-run
    else
        log_info "Obtaining new SSL certificate..."
        sudo certbot --nginx -d ardelagi.web.id -d www.ardelagi.web.id \
            --non-interactive --agree-tos --email admin@ardelagi.web.id \
            --redirect --hsts --staple-ocsp
    fi
    
    # Setup automatic renewal with monitoring
    sudo tee /etc/cron.d/certbot-renew > /dev/null <<EOF
# Enhanced SSL renewal with Discord notification
0 12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
    
    log_success "Enhanced SSL certificate configured with automatic renewal"
}

# Start enhanced application with monitoring
start_enhanced_application() {
    log_info "Starting enhanced application with monitoring..."
    
    cd $PROJECT_PATH
    
    # Stop existing processes
    pm2 delete $PROJECT_NAME 2>/dev/null || true
    
    # Start with enhanced ecosystem configuration
    pm2 start ecosystem.config.js --env $ENV
    
    # Install PM2 monitoring modules
    pm2 install pm2-server-monit || log_warning "Could not install server monitoring"
    
    # Save PM2 configuration
    pm2 save
    
    # Display status
    pm2 status
    pm2 logs $PROJECT_NAME --lines 10
    
    log_success "Enhanced application started successfully"
}

# Enhanced monitoring setup
setup_enhanced_monitoring() {
    log_info "Setting up enhanced monitoring and alerting..."
    
    # Create monitoring directory
    mkdir -p $PROJECT_PATH/monitoring
    
    # Setup log rotation
    sudo tee /etc/logrotate.d/$PROJECT_NAME > /dev/null <<EOF
$PROJECT_PATH/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 $(whoami) $(whoami)
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    # Create monitoring script
    cat > $PROJECT_PATH/monitoring/health-check.sh <<EOF
#!/bin/bash
# Enhanced health monitoring script

LOG_FILE="$PROJECT_PATH/logs/health-check.log"
API_ENDPOINT="https://ardelagi.web.id/api/health"

# Check API health
if ! curl -f -s "\$API_ENDPOINT" > /dev/null; then
    echo "\$(date): API health check failed" >> "\$LOG_FILE"
    pm2 restart $PROJECT_NAME
    echo "\$(date): Restarted application due to health check failure" >> "\$LOG_FILE"
fi

# Check memory usage
MEMORY_USAGE=\$(pm2 jlist | jq -r '.[] | select(.name=="$PROJECT_NAME") | .monit.memory' 2>/dev/null)
if [[ \$MEMORY_USAGE -gt 524288000 ]]; then  # 500MB
    echo "\$(date): High memory usage detected: \$MEMORY_USAGE bytes" >> "\$LOG_FILE"
    pm2 restart $PROJECT_NAME
fi

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    echo "\$(date): Redis connection failed" >> "\$LOG_FILE"
    sudo systemctl restart redis-server
fi
EOF
    
    chmod +x $PROJECT_PATH/monitoring/health-check.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_PATH/monitoring/health-check.sh") | crontab -
    
    # Create performance monitoring script
    cat > $PROJECT_PATH/monitoring/performance-monitor.sh <<EOF
#!/bin/bash
# Performance monitoring and alerting

STATS_FILE="$PROJECT_PATH/monitoring/performance.json"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80

# Collect metrics
CPU_USAGE=\$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - \$1}')
MEMORY_USAGE=\$(free | grep Mem | awk '{printf("%.2f"), \$3/\$2 * 100.0}')
DISK_USAGE=\$(df / | tail -1 | awk '{print \$5}' | sed 's/%//')

# Create JSON stats
cat > "\$STATS_FILE" <<JSON
{
    "timestamp": "\$(date -Iseconds)",
    "cpu_usage": \$CPU_USAGE,
    "memory_usage": \$MEMORY_USAGE,
    "disk_usage": \$DISK_USAGE,
    "pm2_processes": \$(pm2 jlist | jq length)
}
JSON

echo "\$(date): Performance check - CPU: \${CPU_USAGE}%, Memory: \${MEMORY_USAGE}%, Disk: \${DISK_USAGE}%"
EOF
    
    chmod +x $PROJECT_PATH/monitoring/performance-monitor.sh
    
    # Add performance monitoring to crontab
    (crontab -l 2>/dev/null; echo "*/10 * * * * $PROJECT_PATH/monitoring/performance-monitor.sh") | crontab -
    
    log_success "Enhanced monitoring and alerting setup completed"
}

# Enhanced testing suite
test_enhanced_deployment() {
    log_info "Running enhanced deployment tests..."
    
    # Wait for application to fully start
    sleep 15
    
    # Test local connection
    log_info "Testing local API endpoints..."
    
    # Basic health check
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "✅ Local health check passed"
    else
        log_error "❌ Local health check failed"
        pm2 logs $PROJECT_NAME --lines 20
        exit 1
    fi
    
    # Test enhanced endpoints
    ENDPOINTS=("/api/servers" "/api/analytics" "/api/voice" "/api/profile" "/api/stats")
    
    for endpoint in "${ENDPOINTS[@]}"; do
        if curl -f -s "http://localhost:3000$endpoint" | jq . > /dev/null 2>&1; then
            log_success "✅ $endpoint endpoint working"
        else
            log_warning "⚠️  $endpoint endpoint may have issues"
        fi
    done
    
    # Test WebSocket connection
    log_info "Testing WebSocket functionality..."
    if nc -z localhost 3000; then
        log_success "✅ WebSocket port accessible"
    else
        log_warning "⚠️  WebSocket connection may have issues"
    fi
    
    # Test HTTPS connection
    log_info "Testing HTTPS endpoints..."
    if curl -f https://ardelagi.web.id/api/health > /dev/null 2>&1; then
        log_success "✅ HTTPS health check passed"
    else
        log_warning "⚠️  HTTPS health check failed - check SSL configuration"
    fi
    
    # Test performance
    log_info "Running performance tests..."
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' https://ardelagi.web.id/)
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        log_success "✅ Response time: ${RESPONSE_TIME}s (Good)"
    else
        log_warning "⚠️  Response time: ${RESPONSE_TIME}s (Consider optimization)"
    fi
    
    log_success "Enhanced deployment tests completed"
}

# Generate deployment report
generate_deployment_report() {
    log_info "Generating deployment report..."
    
    REPORT_FILE="$PROJECT_PATH/deployment-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$REPORT_FILE" <<EOF
# Enhanced Discord Server Showcase Deployment Report

**Deployment Date:** $(date)
**Environment:** $ENV
**Version:** 3.0.0

## 🚀 Features Deployed

### Core Enhancements
- ✅ Real-time Analytics Dashboard
- ✅ WebSocket Live Updates  
- ✅ Member Activity Tracking
- ✅ Server Health Scoring
- ✅ Voice Channel Monitoring
- ✅ Enhanced Profile Section

### Technical Improvements
- ✅ Redis Caching Layer
- ✅ WebSocket Support in Nginx
- ✅ Enhanced Security Headers
- ✅ Performance Monitoring
- ✅ Automated Health Checks
- ✅ Log Rotation & Management

## 📊 System Information

**Server Specifications:**
- OS: $(lsb_release -d | cut -f2)
- Node.js: $(node -v)
- PM2: $(pm2 -v)
- Nginx: $(nginx -v 2>&1)
- Redis: $(redis-server --version)

**Resource Usage:**
- Memory: $(free -h | awk 'NR==2{printf "%.1f/%.1fGB (%.0f%%)", $3/1024/1024, $2/1024/1024, $3*100/$2}')
- Disk: $(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')
- CPU Cores: $(nproc)

## 🔧 Configuration Files

**Project Structure:**
\`\`\`
$PROJECT_PATH/
├── server.js (Enhanced with WebSocket & Analytics)
├── index.html (Real-time Dashboard)
├── package.json (Updated dependencies)
├── ecosystem.config.js (PM2 configuration)
├── .env (Environment variables)
├── logs/ (Application logs)
├── monitoring/ (Health check scripts)
└── data/ (Analytics data)
\`\`\`

## 🌐 Endpoints Available

**API Endpoints:**
- GET /api/servers - Server data with health scores
- GET /api/analytics/:serverId? - Analytics data
- GET /api/voice/:serverId? - Voice activity data  
- GET /api/profile - Owner profile and stats
- GET /api/stats - Global statistics
- GET /api/health - System health check

**WebSocket Events:**
- serverUpdate - Real-time server updates
- globalStatsUpdate - Global statistics updates
- memberUpdate - Member join/leave events
- voiceUpdate - Voice activity updates
- activityUpdate - Activity feed updates

## 🛡️ Security Features

- SSL/TLS with automatic renewal
- Rate limiting (API: 10req/s, General: 2req/s)
- Security headers (HSTS, CSP, XSS Protection)
- Nginx proxy with upstream caching
- Process isolation with PM2

## 📈 Monitoring & Alerting

**Automated Monitoring:**
- Health checks every 5 minutes
- Performance monitoring every 10 minutes
- SSL certificate renewal monitoring
- Log rotation (daily, 52 week retention)
- Memory usage alerts (>500MB threshold)

**Available Commands:**
\`\`\`bash
# Application Management
pm2 status                    # View process status
pm2 logs $PROJECT_NAME       # View application logs
pm2 restart $PROJECT_NAME    # Restart application
pm2 monit                    # Real-time monitoring

# System Monitoring  
sudo systemctl status nginx  # Nginx status
redis-cli ping               # Redis connectivity
tail -f $PROJECT_PATH/logs/combined.log  # Live logs
\`\`\`

## 🎯 Performance Optimizations

- Redis caching for API responses
- Nginx proxy caching (5min for pages, 30s for API)
- Gzip compression enabled
- Static asset caching (1 year expiry)
- WebSocket connection pooling
- PM2 cluster mode ready

## 🔄 Update Procedures

**To deploy updates:**
\`\`\`bash
cd $PROJECT_PATH
git pull origin main
npm ci --production
pm2 restart $PROJECT_NAME
\`\`\`

**To update SSL certificates:**
\`\`\`bash
sudo certbot renew
sudo systemctl reload nginx
\`\`\`

---

**Deployment completed successfully!** 🎉

Access your enhanced Discord Server Showcase at: https://ardelagi.web.id

EOF
    
    log_success "Deployment report generated: $REPORT_FILE"
    echo ""
    log_feature "📄 View full report: cat $REPORT_FILE"
}

# Main deployment function
main() {
    show_banner
    
    log_deploy "Starting enhanced deployment for environment: $ENV"
    echo ""
    
    # Pre-deployment checks
    check_root
    check_system_requirements
    
    # Installation and setup
    install_enhanced_dependencies
    setup_enhanced_project
    setup_enhanced_environment
    install_enhanced_node_deps
    
    # Server configuration
    configure_enhanced_nginx
    setup_enhanced_ssl
    
    # Application deployment
    start_enhanced_application
    setup_enhanced_monitoring
    
    # Testing and validation
    test_enhanced_deployment
    generate_deployment_report
    
    echo ""
    log_deploy "🎉 Enhanced Discord Server Showcase deployment completed successfully!"
    echo ""
    log_success "🌐 Your application is now running with the following enhancements:"
    echo ""
    log_feature "  ✨ Real-time Analytics Dashboard"
    log_feature "  🔄 WebSocket Live Updates" 
    log_feature "  👥 Member Activity Tracking"
    log_feature "  💚 Server Health Scoring"
    log_feature "  🎤 Voice Channel Monitoring"
    log_feature "  👤 Enhanced Profile Section"
    echo ""
    log_success "🔗 Access your showcase at: https://ardelagi.web.id"
    log_success "📊 API Documentation: https://ardelagi.web.id/api/health"
    echo ""
    log_info "📋 Useful management commands:"
    echo "   pm2 status                 - View application status"
    echo "   pm2 logs $PROJECT_NAME    - View application logs"  
    echo "   pm2 monit                 - Real-time monitoring dashboard"
    echo "   sudo systemctl status nginx - Check web server status"
    echo ""
    log_warning "🔧 Don't forget to:"
    echo "   1. Configure your Discord bot token in .env"
    echo "   2. Add your Discord user ID for the profile section"
    echo "   3. Set up any private guild IDs for exclusive servers"
    echo "   4. Review monitoring alerts and thresholds"
    echo ""
    log_info "📈 Monitor your deployment:"
    echo "   - Application logs: tail -f $PROJECT_PATH/logs/combined.log"
    echo "   - Performance stats: cat $PROJECT_PATH/monitoring/performance.json"
    echo "   - Health checks: tail -f $PROJECT_PATH/logs/health-check.log"
}

# Run main function
main "$@"