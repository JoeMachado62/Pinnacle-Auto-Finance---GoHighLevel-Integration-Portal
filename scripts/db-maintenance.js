#!/usr/bin/env node
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
