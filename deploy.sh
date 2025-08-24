#!/bin/bash

# Discord Servers Showcase Deployment Script
# Usage: ./deploy.sh [environment]

set -e  # Exit on any error

# Configuration
PROJECT_NAME="discord-servers-showcase"
PROJECT_PATH="/var/www/ardelagi.web.id"
NODE_VERSION="18"
ENV=${1:-production}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "Don't run this script as root. Use a regular user with sudo privileges."
        exit 1
    fi
}

# Install system dependencies
install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update system
    sudo apt update && sudo apt upgrade -y
    
    # Install required packages
    sudo apt install -y curl wget git nginx certbot python3-certbot-nginx
    
    # Install Node.js
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js ${NODE_VERSION}..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # Install PM2
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        sudo npm install -g pm2
        pm2 startup
        sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
    fi
    
    log_success "Dependencies installed successfully"
}

# Setup project directory
setup_project() {
    log_info "Setting up project directory..."
    
    # Create project directory
    sudo mkdir -p $PROJECT_PATH
    sudo chown -R $(whoami):$(whoami) $PROJECT_PATH
    
    # Clone or update repository
    if [ -d "$PROJECT_PATH/.git" ]; then
        log_info "Updating existing repository..."
        cd $PROJECT_PATH
        git pull origin main
    else
        log_info "Cloning repository..."
        # Replace with your repository URL
        git clone https://github.com/your-username/discord-servers-showcase.git $PROJECT_PATH
        cd $PROJECT_PATH
    fi
    
    log_success "Project setup completed"
}

# Install Node.js dependencies
install_node_deps() {
    log_info "Installing Node.js dependencies..."
    
    cd $PROJECT_PATH
    
    # Install dependencies
    npm ci --production
    
    log_success "Node.js dependencies installed"
}

# Setup environment variables
setup_environment() {
    log_info "Setting up environment variables..."
    
    cd $PROJECT_PATH
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from template..."
        cp .env.example .env
        
        log_warning "Please edit .env file with your configuration:"
        log_warning "  - DISCORD_BOT_TOKEN"
        log_warning "  - WHITELIST_GUILD_ID (optional)"
        log_warning "  - BADSIDE_GUILD_ID (optional)"
        
        read -p "Press enter after you've configured the .env file..."
    fi
    
    # Validate required environment variables
    if ! grep -q "DISCORD_BOT_TOKEN=" .env || grep -q "DISCORD_BOT_TOKEN=your_bot_token_here" .env; then
        log_error "Please set your DISCORD_BOT_TOKEN in .env file"
        exit 1
    fi
    
    log_success "Environment variables configured"
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    # Backup existing configuration
    if [ -f "/etc/nginx/sites-available/ardelagi.web.id" ]; then
        sudo cp /etc/nginx/sites-available/ardelagi.web.id /etc/nginx/sites-available/ardelagi.web.id.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Update configuration manually (you need to copy the nginx config content)
    log_warning "Please manually update /etc/nginx/sites-available/ardelagi.web.id with the new configuration"
    log_warning "Or copy the nginx configuration content provided in the setup"
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/ardelagi.web.id /etc/nginx/sites-enabled/
    
    # Test Nginx configuration
    if sudo nginx -t; then
        log_success "Nginx configuration is valid"
        sudo systemctl reload nginx
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

# Setup SSL certificate
setup_ssl() {
    log_info "Setting up SSL certificate..."
    
    # Check if certificate already exists
    if sudo certbot certificates | grep -q "ardelagi.web.id"; then
        log_info "SSL certificate already exists"
        # Renew if needed
        sudo certbot renew --dry-run
    else
        log_info "Obtaining new SSL certificate..."
        sudo certbot --nginx -d ardelagi.web.id -d www.ardelagi.web.id --non-interactive --agree-tos --email your-email@example.com
    fi
    
    log_success "SSL certificate configured"
}

# Start application with PM2
start_application() {
    log_info "Starting application with PM2..."
    
    cd $PROJECT_PATH
    
    # Stop existing process if running
    pm2 delete $PROJECT_NAME 2>/dev/null || true
    
    # Start application
    pm2 start ecosystem.config.js --env $ENV
    
    # Save PM2 configuration
    pm2 save
    
    # Show PM2 status
    pm2 status
    
    log_success "Application started successfully"
}

# Setup monitoring and logs
setup_monitoring() {
    log_info "Setting up monitoring and logs..."
    
    # Create log directory
    mkdir -p $PROJECT_PATH/logs
    
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
    
    # Setup system monitoring (optional)
    if command -v htop &> /dev/null; then
        log_info "htop already installed"
    else
        sudo apt install -y htop
    fi
    
    log_success "Monitoring setup completed"
}

# Test deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Wait for application to start
    sleep 10
    
    # Test local connection
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "Local health check passed"
    else
        log_error "Local health check failed"
        pm2 logs $PROJECT_NAME --lines 20
        exit 1
    fi
    
    # Test HTTPS connection
    if curl -f https://ardelagi.web.id/api/health > /dev/null 2>&1; then
        log_success "HTTPS health check passed"
    else
        log_warning "HTTPS health check failed - check SSL configuration"
    fi
    
    log_success "Deployment test completed"
}

# Main deployment function
main() {
    log_info "Starting deployment for environment: $ENV"
    
    check_root
    install_dependencies
    setup_project
    install_node_deps
    setup_environment
    configure_nginx
    setup_ssl
    start_application
    setup_monitoring
    test_deployment
    
    log_success "Deployment completed successfully!"
    log_info "Your Discord Servers Showcase is now running at:"
    log_info "  - https://ardelagi.web.id"
    log_info "  - API: https://ardelagi.web.id/api/servers"
    log_info ""
    log_info "Useful commands:"
    log_info "  - View logs: pm2 logs $PROJECT_NAME"
    log_info "  - Restart app: pm2 restart $PROJECT_NAME"
    log_info "  - Monitor: pm2 monit"
    log_info "  - Nginx status: sudo systemctl status nginx"
}

# Run main function
main "$@"