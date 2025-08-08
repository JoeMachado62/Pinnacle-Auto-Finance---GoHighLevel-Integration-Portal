#!/usr/bin/env node

// upgrade-test-user.js - Upgrade joemachado62@live.com to premium for testing
const authService = require('./services/authService');
const db = require('./services/databaseService');
const { logger } = require('./utils/logger');

async function upgradeTestUser() {
    try {
        console.log('🔄 Starting test user upgrade process...');
        
        // Find the user by email
        const user = await db.getDealerByEmail('joemachado62@live.com');
        if (!user) {
            throw new Error('User not found: joemachado62@live.com');
        }
        
        console.log('✅ Found user:', {
            id: user.id,
            email: user.email,
            dealerName: user.dealerName,
            currentTier: user.subscriptionTier,
            hasApplications: 'checking...'
        });
        
        // Check if user has applications (to ensure data continuity)
        const applications = await db.getDealerApplications(user.id);
        console.log(`📋 User has ${applications.length} existing applications`);
        
        if (applications.length > 0) {
            console.log('📊 Sample application data:');
            console.log('   - First application:', {
                id: applications[0].id,
                applicantName: applications[0].applicantName,
                status: applications[0].status,
                amountFinanced: applications[0].amountFinanced
            });
        }
        
        // Since you mentioned this is an existing GHL user, we need the GHL user ID
        // For now, let's prompt for it or you can provide it as a command line argument
        const ghlUserId = process.argv[2]; // Pass GHL user ID as argument
        
        if (!ghlUserId) {
            console.log('⚠️  No GHL user ID provided.');
            console.log('💡 Usage: node upgrade-test-user.js <ghl-user-id>');
            console.log('   Example: node upgrade-test-user.js 12345678-abcd-efgh-ijkl-mnopqrstuvwx');
            console.log('');
            console.log('🔍 To find the GHL user ID:');
            console.log('   1. Login to GoHighLevel as admin');
            console.log('   2. Go to Settings > Team');
            console.log('   3. Find the user "Joe Machado" or "joemachado62@live.com"');
            console.log('   4. Copy their user ID');
            console.log('');
            console.log('🚀 Upgrading without GHL user ID (will require admin approval)...');
            
            // Upgrade without existing GHL user ID
            const upgradedUser = await authService.updateDealerSubscription(user.id, 'premium');
            
            console.log('✅ User upgraded to premium successfully!');
            console.log('📧 Admin will receive notification for GHL approval');
            
        } else {
            console.log(`🔗 Using existing GHL user ID: ${ghlUserId}`);
            
            // Upgrade with existing GHL user ID
            const upgradedUser = await authService.upgradeToPremiumWithGhlUser(user.id, ghlUserId);
            
            console.log('✅ User upgraded to premium with existing GHL user!');
            console.log('🚀 Auto-login should work immediately');
        }
        
        // Verify the upgrade
        const updatedUser = await db.getDealerByEmail('joemachado62@live.com');
        console.log('');
        console.log('🎉 Upgrade completed! Updated user data:');
        console.log({
            subscriptionTier: updatedUser.subscriptionTier,
            ghlIntegrationEnabled: updatedUser.ghlIntegrationEnabled,
            ghlUserId: updatedUser.ghlUserId,
            ghlContactId: updatedUser.ghlContactId,
            upgradedAt: updatedUser.upgradedAt
        });
        
        // Check registration status
        const ghlUserService = require('./services/ghlUserService');
        const registrationStatus = await ghlUserService.getRegistrationStatus(updatedUser.id);
        console.log('');
        console.log('📋 GHL Registration Status:', registrationStatus);
        
        console.log('');
        console.log('🧪 Testing Instructions:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Login at: http://localhost:3000/login.html');
        console.log('3. Use credentials: joemachado62@live.com / P1nn@cle2025!');
        console.log('4. Go to dashboard and click "Premium Services"');
        console.log('5. Test the auto-login functionality');
        console.log('');
        console.log('✨ All existing applications should still be visible in the premium dashboard!');
        
    } catch (error) {
        console.error('❌ Error upgrading test user:', error);
        process.exit(1);
    }
}

// Run the upgrade
if (require.main === module) {
    upgradeTestUser().then(() => {
        console.log('');
        console.log('🎯 Upgrade process completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Upgrade failed:', error);
        process.exit(1);
    });
}

module.exports = upgradeTestUser;