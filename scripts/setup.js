#!/usr/bin/env node
// scripts/setup.js - PROJECT SETUP SCRIPT
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Setting up Pinnacle Auto Finance Portal...\n');

// Create required directories
const directories = [
    'data',
    'logs',
    'uploads',
    'scripts',
    'utils'
];

console.log('📁 Creating required directories...');
directories.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ Created: ${dir}/`);
    } else {
        console.log(`   ✓ Exists: ${dir}/`);
    }
});

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '..', '.env');
const envTemplatePath = path.join(__dirname, '..', '.env.template');

console.log('\n⚙️ Checking environment configuration...');
if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envTemplatePath)) {
        // Copy template and generate secure values
        let envContent = fs.readFileSync(envTemplatePath, 'utf8');
        
        // Generate secure random values
        const jwtSecret = crypto.randomBytes(64).toString('hex');
        const encryptionKey = crypto.randomBytes(32).toString('hex');
        const apiSecretKey = crypto.randomBytes(32).toString('hex');
        const internalApiKey = crypto.randomBytes(24).toString('hex');
        const ghlWebhookSecret = crypto.randomBytes(32).toString('hex');
        const dealertrackWebhookSecret = crypto.randomBytes(32).toString('hex');
        
        // Replace placeholder values
        envContent = envContent.replace(
            'JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long',
            `JWT_SECRET=${jwtSecret}`
        );
        envContent = envContent.replace(
            'ENCRYPTION_KEY=your-aes-256-encryption-key-32-chars',
            `ENCRYPTION_KEY=${encryptionKey}`
        );
        envContent = envContent.replace(
            'API_SECRET_KEY=your-api-secret-key-for-internal-calls',
            `API_SECRET_KEY=${apiSecretKey}`
        );
        envContent = envContent.replace(
            'INTERNAL_API_KEY=your-internal-api-key-for-agent-communication',
            `INTERNAL_API_KEY=${internalApiKey}`
        );
        envContent = envContent.replace(
            'GHL_WEBHOOK_SECRET=your-ghl-webhook-secret',
            `GHL_WEBHOOK_SECRET=${ghlWebhookSecret}`
        );
        envContent = envContent.replace(
            'DEALERTRACK_WEBHOOK_SECRET=your-dealertrack-webhook-secret',
            `DEALERTRACK_WEBHOOK_SECRET=${dealertrackWebhookSecret}`
        );
        
        // Write the .env file
        fs.writeFileSync(envPath, envContent);
        console.log('   ✅ Created .env file with secure random values');
        console.log('   ⚠️  IMPORTANT: Update email and API credentials in .env file');
    } else {
        console.log('   ❌ .env.template not found, creating basic .env file');
        
        const basicEnv = `# Pinnacle Auto Finance Portal Configuration
NODE_ENV=development
PORT=3000

# Security (auto-generated)
JWT_SECRET=${crypto.randomBytes(64).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}

# Email Configuration (REQUIRED - Set these up!)
FREE_2FA_EMAIL=your.gmail@gmail.com
FREE_2FA_PASSWORD=your-16-char-gmail-app-password
EMAIL_TEST_MODE=true
TWO_FACTOR_ENABLED=true

# Add other configuration as needed
`;
        fs.writeFileSync(envPath, basicEnv);
        console.log('   ✅ Created basic .env file');
    }
} else {
    console.log('   ✓ .env file already exists');
}

// Create initial data structure
console.log('\n💾 Initializing data storage...');
const dataFiles = {
    'data/dealers.json': { dealers: [], lastUpdated: new Date().toISOString() },
    'data/applications.json': { applications: [], lastUpdated: new Date().toISOString() },
    'data/conversations.json': { conversations: [], lastUpdated: new Date().toISOString() },
    'data/2fa_codes.json': { codes: [], lastUpdated: new Date().toISOString() }
};

Object.entries(dataFiles).forEach(([filePath, defaultData]) => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, JSON.stringify(defaultData, null, 2));
        console.log(`   ✅ Created: ${filePath}`);
    } else {
        console.log(`   ✓ Exists: ${filePath}`);
    }
});

// Create .gitignore if it doesn't exist
console.log('\n📝 Checking .gitignore...');
const gitignorePath = path.join(__dirname, '..', '.gitignore');
const gitignoreContent = `# Environment variables
.env
.env.local
.env.production

# Data files (contains sensitive dealer information)
data/
logs/
uploads/

# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# MacOS
.DS_Store

# Windows
Thumbs.db
`;

if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('   ✅ Created .gitignore');
} else {
    console.log('   ✓ .gitignore already exists');
}

// Create helpful scripts
console.log('\n📜 Creating utility scripts...');

// Development start script
const devStartScript = `#!/bin/bash
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
`;

const devScriptPath = path.join(__dirname, 'dev.sh');
if (!fs.existsSync(devScriptPath)) {
    fs.writeFileSync(devScriptPath, devStartScript);
    // Make script executable
    try {
        fs.chmodSync(devScriptPath, '755');
        console.log('   ✅ Created: scripts/dev.sh');
    } catch (error) {
        console.log('   ✅ Created: scripts/dev.sh (make executable manually)');
    }
}

// Database maintenance script
const dbMaintenanceScript = `#!/usr/bin/env node
// scripts/db-maintenance.js - Database maintenance utilities

const db = require('../services/databaseService');
const { logger } = require('../utils/logger');

async function maintenance() {
    console.log('🔧 Running database maintenance...');
    
    try {
        // Clean up expired 2FA codes
        await db.cleanup();
        console.log('✅ Cleaned up expired 2FA codes');
        
        // Get statistics
        const stats = await db.getDatabaseStats();
        console.log('📊 Database Statistics:', JSON.stringify(stats, null, 2));
        
        console.log('✅ Maintenance completed');
    } catch (error) {
        console.error('❌ Maintenance failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    maintenance();
}

module.exports = { maintenance };
`;

const dbMaintenancePath = path.join(__dirname, 'db-maintenance.js');
if (!fs.existsSync(dbMaintenancePath)) {
    fs.writeFileSync(dbMaintenancePath, dbMaintenanceScript);
    console.log('   ✅ Created: scripts/db-maintenance.js');
}

// Check health script
const healthCheckScript = `#!/usr/bin/env node
// scripts/health-check.js - Health check utility

const http = require('http');

const PORT = process.env.PORT || 3000;

function checkHealth() {
    return new Promise((resolve, reject) => {
        const req = http.get(\`http://localhost:\${PORT}/api/health\`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const health = JSON.parse(data);
                    resolve(health);
                } catch (error) {
                    reject(new Error('Invalid health response'));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Health check timeout'));
        });
    });
}

async function main() {
    try {
        console.log(\`🏥 Checking health at http://localhost:\${PORT}/api/health...\`);
        const health = await checkHealth();
        
        console.log(\`\\n✅ Server Status: \${health.status}\`);
        console.log(\`📊 Uptime: \${Math.round(health.uptime)} seconds\`);
        console.log(\`🔧 Environment: \${health.environment}\`);
        console.log(\`📧 Email Service: \${health.services.email}\`);
        console.log(\`💾 Database: \${health.services.database}\`);
        
        if (health.database) {
            console.log(\`\\n📈 Database Stats:\`);
            console.log(\`   Dealers: \${health.database.dealers?.total || 0}\`);
            console.log(\`   Applications: \${health.database.applications?.total || 0}\`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error(\`❌ Health check failed: \${error.message}\`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
`;

const healthCheckPath = path.join(__dirname, 'health-check.js');
if (!fs.existsSync(healthCheckPath)) {
    fs.writeFileSync(healthCheckPath, healthCheckScript);
    console.log('   ✅ Created: scripts/health-check.js');
}

// Display next steps
console.log('\n🎉 Setup completed successfully!\n');
console.log('📋 Next Steps:');
console.log('   1. 📧 Configure email settings in .env file:');
console.log('      - Set FREE_2FA_EMAIL to your Gmail address');
console.log('      - Set FREE_2FA_PASSWORD to your Gmail App Password');
console.log('      - Set EMAIL_TEST_MODE=false for production');
console.log('');
console.log('   2. 🔗 Configure GoHighLevel integration (optional):');
console.log('      - Set GHL_API_KEY, GHL_LOCATION_ID, etc. in .env');
console.log('');
console.log('   3. 🚀 Start the development server:');
console.log('      npm run dev');
console.log('');
console.log('   4. 🧪 Test the authentication system:');
console.log('      npm run test:auth');
console.log('');
console.log('   5. 🌐 Open your browser and visit:');
console.log('      http://localhost:3000');
console.log('');
console.log('📚 Documentation:');
console.log('   - Gmail Setup: See .env.template for instructions');
console.log('   - GoHighLevel Setup: Configure API keys in .env');
console.log('   - Testing: Run npm run test:auth');
console.log('');
console.log('🔧 Utility Commands:');
console.log('   npm run health     - Check server health');
console.log('   npm run logs       - View application logs');
console.log('   npm run logs:error - View error logs only');
console.log('');

// Check if this is the first run
const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (pkg.version.startsWith('2.0')) {
        console.log('✨ Welcome to Pinnacle Auto Finance Portal v2.0!');
        console.log('   This version includes enhanced security, 2FA, and improved architecture.');
    }
}

console.log('');
console.log('❓ Need help? Check the documentation or run npm run test:auth');
console.log('');