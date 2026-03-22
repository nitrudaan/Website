#!/bin/bash

# UDAAN Website Setup Script
# Double-click this file to install all dependencies and set up the project
# Compatible with macOS and Linux

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

clear
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║${NC}        ${GREEN}UDAAN AEROMODELLING CLUB - WEBSITE SETUP${NC}        ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                  ${YELLOW}NIT Rourkela${NC}                          ${BLUE}║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check for Node.js
echo ""
print_status "Checking for Node.js..."

if command_exists node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js found: $NODE_VERSION"
    
    # Check if version is at least 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js version 18+ is recommended. You have $NODE_VERSION"
    fi
else
    print_error "Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo ""
    echo "  macOS (with Homebrew):"
    echo "    brew install node"
    echo ""
    echo "  macOS/Linux (with nvm - recommended):"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "    nvm install 20"
    echo ""
    echo "  Or download from: https://nodejs.org/"
    echo ""
    printf "Press Enter to exit..."
    read
    exit 1
fi

# Check for npm
print_status "Checking for npm..."

if command_exists npm; then
    NPM_VERSION=$(npm -v)
    print_success "npm found: v$NPM_VERSION"
else
    print_error "npm is not installed!"
    echo "npm usually comes with Node.js. Please reinstall Node.js."
    printf "Press Enter to exit..."
    read
    exit 1
fi

# Ensure public directory and config exist
echo ""
print_status "Setting up configuration..."

mkdir -p "$PROJECT_DIR/public"

if [ ! -f "$PROJECT_DIR/public/config.json" ]; then
    echo '{"inductionOpen": false, "registrationOpen": false, "inductionOpen2ndYear": false}' > "$PROJECT_DIR/public/config.json"
    print_success "Created config.json with default settings"
else
    print_success "config.json already exists"
fi

# Setup environment variables (.env file)
echo ""
print_status "Setting up environment variables..."

ENV_FILE="$PROJECT_DIR/.env"

# Default Supabase configuration (UDAAN project)
DEFAULT_SUPABASE_URL="https://vdeacxzqdbulgklfkqfs.supabase.co"
DEFAULT_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZWFjeHpxZGJ1bGdrbGZrcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTAxMTgsImV4cCI6MjA4MDMyNjExOH0.NBSBiR-l0Itv-rhKXod8fAar2apdTbad4_qN4vyQdDM"

if [ ! -f "$ENV_FILE" ]; then
    print_warning ".env file not found. Creating with default UDAAN Supabase configuration..."
    
    cat > "$ENV_FILE" << EOF
# Supabase Configuration
# Replace these values with your own if you're using a different Supabase project

VITE_SUPABASE_URL=$DEFAULT_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$DEFAULT_SUPABASE_ANON_KEY

# Optional: Gemini API Key for AI features (leave empty if not needed)
# GEMINI_API_KEY=your_gemini_api_key_here
EOF
    
    print_success "Created .env file with default UDAAN Supabase configuration"
else
    # Verify .env has required variables
    print_status "Verifying .env configuration..."
    
    ENV_VALID=true
    
    if ! grep -q "VITE_SUPABASE_URL" "$ENV_FILE"; then
        print_warning "VITE_SUPABASE_URL not found in .env"
        ENV_VALID=false
    fi
    
    if ! grep -q "VITE_SUPABASE_ANON_KEY" "$ENV_FILE"; then
        print_warning "VITE_SUPABASE_ANON_KEY not found in .env"
        ENV_VALID=false
    fi
    
    if [ "$ENV_VALID" = true ]; then
        print_success ".env file is properly configured"
    else
        print_warning "Some environment variables are missing!"
        echo ""
        printf "Would you like to reset .env to default configuration? (y/N): "
        read reset_env
        if [ "$reset_env" = "y" ] || [ "$reset_env" = "Y" ]; then
            cat > "$ENV_FILE" << EOF
# Supabase Configuration
# Replace these values with your own if you're using a different Supabase project

VITE_SUPABASE_URL=$DEFAULT_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$DEFAULT_SUPABASE_ANON_KEY

# Optional: Gemini API Key for AI features (leave empty if not needed)
# GEMINI_API_KEY=your_gemini_api_key_here
EOF
            print_success "Reset .env file with default configuration"
        fi
    fi
fi

# Make admin scripts executable
print_status "Setting up admin scripts..."

if [ -d "$PROJECT_DIR/admin/mac" ]; then
    chmod +x "$PROJECT_DIR/admin/mac"/*.command 2>/dev/null
    print_success "Admin scripts are now executable"
else
    print_warning "Admin folder not found - skipping"
fi

# Install dependencies
echo ""
print_status "Installing dependencies..."
echo ""

# Check if node_modules exists
if [ -d "$PROJECT_DIR/node_modules" ]; then
    print_warning "node_modules folder exists"
    echo ""
    printf "Do you want to reinstall dependencies? (y/N): "
    read reinstall
    if [ "$reinstall" = "y" ] || [ "$reinstall" = "Y" ]; then
        print_status "Removing existing node_modules..."
        rm -rf "$PROJECT_DIR/node_modules"
        rm -f "$PROJECT_DIR/package-lock.json"
    else
        print_status "Skipping dependency installation"
        SKIP_INSTALL=true
    fi
fi

if [ "$SKIP_INSTALL" != "true" ]; then
    print_status "Running npm install... (this may take a few minutes)"
    echo ""
    
    if npm install; then
        echo ""
        print_success "Dependencies installed successfully!"
    else
        echo ""
        print_error "Failed to install dependencies!"
        print_status "Try running 'npm install' manually to see the error"
        printf "Press Enter to exit..."
        read
        exit 1
    fi
fi

# Verify installation
echo ""
print_status "Verifying installation..."

MISSING_DEPS=""

check_package() {
    if [ ! -d "$PROJECT_DIR/node_modules/$1" ]; then
        MISSING_DEPS="$MISSING_DEPS $1"
    fi
}

check_package "react"
check_package "react-dom"
check_package "vite"
check_package "framer-motion"
check_package "@react-three/fiber"
check_package "react-router-dom"

if [ -z "$MISSING_DEPS" ]; then
    print_success "All core packages installed correctly"
else
    print_warning "Some packages may be missing:$MISSING_DEPS"
    print_status "Try running 'npm install' manually"
fi

# Verify critical public assets (audio, models, logos)
echo ""
print_status "Verifying public assets (audio, models, logos)..."

MISSING_ASSETS=""

check_asset() {
    if [ ! -f "$PROJECT_DIR/$1" ]; then
        MISSING_ASSETS="$MISSING_ASSETS $1"
        # create a small placeholder to make it obvious in the repo
        PLACEHOLDER="$PROJECT_DIR/$1.MISSING.txt"
        if [ ! -f "$PLACEHOLDER" ]; then
            echo "MISSING ASSET: $1" > "$PLACEHOLDER"
            echo "Place the real file at $1. This placeholder was created by the setup script." >> "$PLACEHOLDER"
        fi
    fi
}

check_asset "public/Click.wav"
check_asset "public/Reject.wav"
check_asset "public/hayden-folker-surrounded.mp3"
check_asset "public/uploads-files-3193264-drone+2+model.glb"
check_asset "public/RC.glb"
check_asset "public/udaan-logo.webp"
check_asset "public/nitr-logo.svg"

if [ -z "$MISSING_ASSETS" ]; then
    print_success "All essential public assets are present"
else
    print_warning "Some public assets are missing:$MISSING_ASSETS"
    echo "Place the missing files in the 'public/' folder. For audio files, supported formats: .mp3 or .wav";
    echo "Place model GLB files in 'public/' if you use custom 3D models. Place logos as webp/svg for best results.";
fi

# Summary
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    SETUP COMPLETE!                        ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  To start the development server:"
echo ""
echo -e "    ${YELLOW}npm run dev${NC}"
echo ""
echo "  Then open: ${BLUE}http://localhost:3000${NC}"
echo ""
echo "  Default Admin Login:"
echo "    • ID: UDAAN-001"
echo "    • Password: admin123"
echo ""
echo "  Admin controls (in admin/mac folder):"
echo "    • Toggle-Induction-1stYear.command  - Toggle 1st year induction"
echo "    • Toggle-Induction-2ndYear.command  - Toggle 2nd year induction"
echo "    • Toggle-Registration.command       - Toggle event registration"
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""

# Ask if user wants to start the server
printf "Would you like to start the development server now? (Y/n): "
read start_server

if [ "$start_server" != "n" ] && [ "$start_server" != "N" ]; then
    echo ""
    print_status "Starting development server..."
    echo ""
    npm run dev
else
    echo ""
    print_status "You can start the server later with: npm run dev"
    echo ""
    printf "Press Enter to close..."
    read
fi
