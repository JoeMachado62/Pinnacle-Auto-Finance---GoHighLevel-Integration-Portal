#!/bin/bash
# scripts/dev.sh - Development start script

echo "🚀 Starting Pinnacle Portal in development mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run 'npm run setup' first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
echo "🌟 Starting development server..."
npm run dev
