#!/usr/bin/env node
// scripts/health-check.js - Health check utility

const http = require('http');

const PORT = process.env.PORT || 3000;

function checkHealth() {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
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
        console.log(`🏥 Checking health at http://localhost:${PORT}/api/health...`);
        const health = await checkHealth();
        
        console.log(`\n✅ Server Status: ${health.status}`);
        console.log(`📊 Uptime: ${Math.round(health.uptime)} seconds`);
        console.log(`🔧 Environment: ${health.environment}`);
        console.log(`📧 Email Service: ${health.services.email}`);
        console.log(`💾 Database: ${health.services.database}`);
        
        if (health.database) {
            console.log(`\n📈 Database Stats:`);
            console.log(`   Dealers: ${health.database.dealers?.total || 0}`);
            console.log(`   Applications: ${health.database.applications?.total || 0}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error(`❌ Health check failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
