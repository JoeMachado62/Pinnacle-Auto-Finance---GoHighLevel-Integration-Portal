#!/bin/bash

# =============================================================================
# Pinnacle Auto Finance Portal - Safe Server Restart Script
# =============================================================================
# This script safely shuts down and restarts the PAF server
# Usage: ./restart-server.sh [production|development|force]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
LOG_DIR="$PROJECT_DIR/logs"
BACKUP_DIR="$PROJECT_DIR/backups"
PID_FILE="$PROJECT_DIR/server.pid"
PORT=${PORT:-3000}
NODE_ENV=${NODE_ENV:-development}

# Parse command line arguments
MODE=${1:-development}
FORCE=${2:-false}

# Create necessary directories
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if port is in use
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Get process ID using the port
get_process_by_port() {
    lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null || echo ""
}

# Check if PM2 is installed and running
check_pm2() {
    if command -v pm2 >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Backup current logs
backup_logs() {
    if [ -d "$LOG_DIR" ] && [ "$(ls -A $LOG_DIR 2>/dev/null)" ]; then
        log "Backing up current logs..."
        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_LOG_DIR="$BACKUP_DIR/logs_$BACKUP_TIMESTAMP"
        mkdir -p "$BACKUP_LOG_DIR"
        cp -r "$LOG_DIR"/* "$BACKUP_LOG_DIR/" 2>/dev/null || true
        log "Logs backed up to: $BACKUP_LOG_DIR"
    fi
}

# Wait for process to stop
wait_for_stop() {
    local pid=$1
    local timeout=${2:-30}
    local count=0
    
    while [ $count -lt $timeout ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            return 0  # Process stopped
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    return 1  # Timeout
}

# =============================================================================
# SHUTDOWN FUNCTIONS
# =============================================================================

stop_pm2() {
    log "Stopping PM2 processes..."
    
    # Check if any PAF processes are running in PM2
    if pm2 list | grep -q "paf\|pinnacle\|server"; then
        # Stop specific PAF processes
        pm2 stop all 2>/dev/null || true
        sleep 2
        
        # Delete processes to clean up
        pm2 delete all 2>/dev/null || true
        log "PM2 processes stopped and cleaned up"
    else
        info "No PAF processes found in PM2"
    fi
}

stop_node_processes() {
    log "Stopping Node.js processes on port $PORT..."
    
    # Get process ID
    local pid=$(get_process_by_port)
    
    if [ -n "$pid" ]; then
        info "Found process $pid using port $PORT"
        
        # Try graceful shutdown first (SIGTERM)
        log "Sending SIGTERM to process $pid..."
        kill -TERM "$pid" 2>/dev/null || true
        
        echo -n "Waiting for graceful shutdown"
        if wait_for_stop "$pid" 15; then
            echo ""
            log "Process stopped gracefully"
        else
            echo ""
            warn "Graceful shutdown timed out, forcing stop..."
            kill -KILL "$pid" 2>/dev/null || true
            sleep 2
            
            if kill -0 "$pid" 2>/dev/null; then
                error "Failed to stop process $pid"
                return 1
            else
                log "Process forcefully stopped"
            fi
        fi
    else
        info "No process found using port $PORT"
    fi
}

stop_all_node() {
    log "Stopping all Node.js processes related to this project..."
    
    # Find all node processes running server.js or related to this project
    local pids=$(pgrep -f "node.*server\.js\|node.*pinnacle\|nodemon.*server" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log "Found related Node processes: $pids"
        for pid in $pids; do
            log "Stopping process $pid..."
            kill -TERM "$pid" 2>/dev/null || true
        done
        
        sleep 3
        
        # Force kill any remaining processes
        local remaining=$(pgrep -f "node.*server\.js\|node.*pinnacle\|nodemon.*server" 2>/dev/null || true)
        if [ -n "$remaining" ]; then
            warn "Force killing remaining processes: $remaining"
            for pid in $remaining; do
                kill -KILL "$pid" 2>/dev/null || true
            done
        fi
    fi
}

cleanup_processes() {
    log "Performing cleanup..."
    
    # Remove PID file if it exists
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
        log "Removed PID file"
    fi
    
    # Kill any zombie processes
    local zombies=$(ps aux | grep -E "[Zz]ombie|<defunct>" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$zombies" ]; then
        warn "Cleaning up zombie processes: $zombies"
        for pid in $zombies; do
            kill -KILL "$pid" 2>/dev/null || true
        done
    fi
    
    # Clear any hung port bindings
    if check_port; then
        warn "Port $PORT still in use after cleanup"
        local remaining_pid=$(get_process_by_port)
        if [ -n "$remaining_pid" ]; then
            error "Process $remaining_pid still using port $PORT"
            if [ "$FORCE" = "force" ] || [ "$MODE" = "force" ]; then
                log "Force mode: killing remaining process"
                kill -KILL "$remaining_pid" 2>/dev/null || true
                sleep 2
            fi
        fi
    fi
}

# =============================================================================
# STARTUP FUNCTIONS
# =============================================================================

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm >/dev/null 2>&1; then
        error "npm is not installed"
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        error "package.json not found in $PROJECT_DIR"
        exit 1
    fi
    
    # Check if server.js exists
    if [ ! -f "$PROJECT_DIR/server.js" ]; then
        error "server.js not found in $PROJECT_DIR"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

install_dependencies() {
    log "Checking npm dependencies..."
    
    if [ ! -d "$PROJECT_DIR/node_modules" ] || [ "$PROJECT_DIR/package.json" -nt "$PROJECT_DIR/node_modules" ]; then
        log "Installing/updating dependencies..."
        cd "$PROJECT_DIR"
        npm install
        log "Dependencies installed"
    else
        info "Dependencies are up to date"
    fi
}

start_server() {
    log "Starting server in $MODE mode..."
    
    cd "$PROJECT_DIR"
    
    case $MODE in
        "production")
            start_production_server
            ;;
        "development")
            start_development_server
            ;;
        "pm2")
            start_pm2_server
            ;;
        *)
            log "Unknown mode: $MODE, defaulting to development"
            start_development_server
            ;;
    esac
}

start_production_server() {
    log "Starting production server..."
    
    export NODE_ENV=production
    
    # Start with PM2 if available, otherwise direct node
    if check_pm2; then
        pm2 start server.js --name "paf-portal" --env production
        log "Server started with PM2"
    else
        # Start in background and save PID
        nohup node server.js > "$LOG_DIR/server.log" 2>&1 &
        echo $! > "$PID_FILE"
        log "Server started with PID $(cat $PID_FILE)"
    fi
}

start_development_server() {
    log "Starting development server..."
    
    export NODE_ENV=development
    export LOG_LEVEL=debug
    
    # Check if nodemon is available
    if command -v nodemon >/dev/null 2>&1; then
        log "Starting with nodemon for auto-reload..."
        nohup nodemon server.js > "$LOG_DIR/server.log" 2>&1 &
        echo $! > "$PID_FILE"
    else
        log "Starting with node..."
        nohup node server.js > "$LOG_DIR/server.log" 2>&1 &
        echo $! > "$PID_FILE"
    fi
    
    log "Server started with PID $(cat $PID_FILE)"
}

start_pm2_server() {
    if ! check_pm2; then
        error "PM2 is not installed. Install with: npm install -g pm2"
        exit 1
    fi
    
    log "Starting server with PM2..."
    pm2 start server.js --name "paf-portal"
    pm2 save
    log "Server started with PM2"
}

verify_startup() {
    log "Verifying server startup..."
    
    # Wait for server to start
    local count=0
    local max_attempts=30
    
    while [ $count -lt $max_attempts ]; do
        if check_port; then
            log "Server is responding on port $PORT"
            break
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo ""
    
    if [ $count -ge $max_attempts ]; then
        error "Server failed to start within $max_attempts seconds"
        return 1
    fi
    
    # Test health endpoint
    if command -v curl >/dev/null 2>&1; then
        log "Testing health endpoint..."
        if curl -s -f "http://localhost:$PORT/api/health" >/dev/null; then
            log "Health check passed"
        else
            warn "Health check failed, but server is running"
        fi
    fi
    
    return 0
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    log "==================================================================="
    log "Pinnacle Auto Finance Portal - Server Restart"
    log "Mode: $MODE"
    log "Project Directory: $PROJECT_DIR"
    log "==================================================================="
    
    # Backup logs before stopping
    backup_logs
    
    # Stop existing processes
    log "Step 1: Stopping existing processes..."
    
    if check_pm2 && pm2 list | grep -q "paf\|pinnacle"; then
        stop_pm2
    fi
    
    stop_node_processes
    
    if [ "$FORCE" = "force" ] || [ "$MODE" = "force" ]; then
        stop_all_node
    fi
    
    cleanup_processes
    
    # Verify everything is stopped
    if check_port; then
        error "Failed to free port $PORT"
        exit 1
    fi
    
    log "Step 2: Preparing for restart..."
    check_prerequisites
    install_dependencies
    
    log "Step 3: Starting server..."
    start_server
    
    log "Step 4: Verifying startup..."
    if verify_startup; then
        log "==================================================================="
        log "✅ Server restart completed successfully!"
        log "Server is running on port $PORT"
        log "Mode: $MODE"
        log "Logs: $LOG_DIR/server.log"
        
        if check_pm2 && pm2 list | grep -q "paf\|pinnacle"; then
            log "PM2 Status:"
            pm2 status
        fi
        
        log "==================================================================="
    else
        error "❌ Server restart failed!"
        log "Check logs in $LOG_DIR/ for details"
        exit 1
    fi
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [mode] [force]"
        echo ""
        echo "Modes:"
        echo "  development  - Start with nodemon (default)"
        echo "  production   - Start with PM2 or node"
        echo "  pm2         - Force start with PM2"
        echo "  force       - Force kill all processes"
        echo ""
        echo "Examples:"
        echo "  $0                    # Development mode"
        echo "  $0 production         # Production mode"
        echo "  $0 development force  # Force restart in dev mode"
        echo "  $0 force             # Force kill and restart"
        exit 0
        ;;
esac

# Check if running as root and auto-switch to paf-user if available
if [ "$EUID" -eq 0 ]; then
    # Check if paf-user exists
    if id "paf-user" &>/dev/null; then
        log "Detected root user - automatically switching to paf-user for security"
        log "Re-executing script as paf-user..."
        exec sudo -u paf-user -H "$0" "$@"
    else
        warn "Running as root is not recommended for Node.js applications"
        warn "Consider creating a dedicated user: sudo useradd -r -s /bin/bash -d /var/www/paf-ghl paf-user"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Execute main function
main "$@"
