// test-authentication.js - AUTHENTICATION SYSTEM TEST
// Run this file to test the new authentication system
const authService = require('./services/authService');
const emailService = require('./services/emailService');
const db = require('./services/databaseService');
const config = require('./config');

async function testAuthentication() {
    console.log('🧪 Testing Pinnacle Portal Authentication System...\n');
    console.log('='.repeat(60));

    let testsPassed = 0;
    let totalTests = 0;

    function logTest(testName, success, message = '') {
        totalTests++;
        if (success) {
            testsPassed++;
            console.log(`✅ ${testName}`);
            if (message) console.log(`   ${message}`);
        } else {
            console.log(`❌ ${testName}`);
            if (message) console.log(`   Error: ${message}`);
        }
    }

    try {
        // Test 1: Database initialization
        console.log('\n📊 Testing Database Service...');
        try {
            const stats = await db.getDatabaseStats();
            logTest('Database initialization', true, `Found ${stats.dealers.total} dealers, ${stats.applications.total} applications`);
        } catch (error) {
            logTest('Database initialization', false, error.message);
        }

        // Test 2: Email service connection
        console.log('\n📧 Testing Email Service...');
        try {
            const emailConnected = await emailService.testConnection();
            logTest('Email service connection', emailConnected, 
                config.EMAIL_TEST_MODE ? 'Running in TEST MODE' : 'Connected to Gmail SMTP');
        } catch (error) {
            logTest('Email service connection', false, error.message);
        }

        // Test 3: Create test dealer
        console.log('\n👤 Testing Dealer Creation...');
        const testDealerData = {
            email: 'test@pinnacletest.com',
            password: 'TestPassword123!',
            dealerName: 'Test Auto Sales',
            contactName: 'John Test',
            phone: '555-123-4567',
            address: '123 Test St, Test City, ST 12345',
            dealerLicenseNumber: 'DL123456',
            finNumber: 'FIN789',
            subscriptionTier: 'basic'
        };

        try {
            // Clean up any existing test dealer first
            const existingDealer = await db.getDealerByEmail(testDealerData.email);
            if (existingDealer) {
                console.log('   Cleaning up existing test dealer...');
            }

            const testDealer = await authService.createDealer(testDealerData);
            logTest('Dealer creation', true, `Created dealer: ${testDealer.dealerName}`);

            // Test 4: Authenticate dealer
            console.log('\n🔐 Testing Dealer Authentication...');
            try {
                const authResult = await authService.authenticateDealer(testDealerData.email, testDealerData.password);
                logTest('Dealer authentication', true, `Authenticated: ${authResult.dealer.dealerName}`);
                logTest('JWT token generation', !!authResult.token, `Token: ${authResult.token ? 'Generated' : 'Failed'}`);

                // Test 5: Token verification
                try {
                    const decoded = authService.verifyToken(authResult.token);
                    logTest('Token verification', true, `Decoded user ID: ${decoded.userId}`);
                } catch (tokenError) {
                    logTest('Token verification', false, tokenError.message);
                }

            } catch (authError) {
                logTest('Dealer authentication', false, authError.message);
            }

            // Test 6: 2FA code generation and storage
            console.log('\n🔢 Testing 2FA System...');
            try {
                const code = authService.generate2FACode();
                logTest('2FA code generation', authService.isValid2FACode(code), `Generated code: ${code}`);

                // Store 2FA code
                const storedCode = await db.store2FACode(testDealer.id, code, testDealer.email);
                logTest('2FA code storage', !!storedCode, `Stored with ID: ${storedCode.id}`);

                // Retrieve 2FA code
                const retrievedCode = await db.get2FACode(testDealer.id, code);
                logTest('2FA code retrieval', !!retrievedCode && retrievedCode.code === code, 'Retrieved matching code');

            } catch (twoFAError) {
                logTest('2FA system', false, twoFAError.message);
            }

            // Test 7: Email sending (2FA code)
            console.log('\n📬 Testing 2FA Email Sending...');
            try {
                const code = authService.generate2FACode();
                const emailSent = await emailService.send2FACode(testDealer.email, code, testDealer.contactName);
                logTest('2FA email sending', emailSent, 
                    config.EMAIL_TEST_MODE ? 'Simulated in TEST MODE' : 'Real email sent');
            } catch (emailError) {
                logTest('2FA email sending', false, emailError.message);
            }

            // Test 8: Application creation
            console.log('\n📋 Testing Application System...');
            try {
                const testApplication = {
                    dealerId: testDealer.id,
                    applicantName: 'Jane Doe',
                    vehicleInfo: '2023 Honda Accord',
                    amountFinanced: 25000,
                    applicantData: {
                        borrower1_firstName: 'Jane',
                        borrower1_lastName: 'Doe',
                        borrower1_email: 'jane@example.com',
                        vehicle_year: '2023',
                        vehicle_make_model: 'Honda Accord'
                    }
                };

                const application = await db.createApplication(testApplication);
                logTest('Application creation', !!application.id, `Created application: ${application.id}`);

                // Test conversation logging
                const conversation = await db.addConversationNote(application.id, {
                    content: 'Test application submitted successfully',
                    createdBy: testDealer.id,
                    createdByName: testDealer.contactName,
                    noteType: 'system_note'
                });
                logTest('Conversation logging', !!conversation.id, `Created conversation log: ${conversation.id}`);

            } catch (appError) {
                logTest('Application system', false, appError.message);
            }

            // Test 9: Subscription upgrade
            console.log('\n⬆️ Testing Subscription System...');
            try {
                const upgradedDealer = await authService.updateDealerSubscription(testDealer.id, 'premium');
                logTest('Subscription upgrade', upgradedDealer.subscriptionTier === 'premium', 
                    `Upgraded to: ${upgradedDealer.subscriptionTier}`);
            } catch (subError) {
                logTest('Subscription upgrade', false, subError.message);
            }

            // Test 10: Password change
            console.log('\n🔒 Testing Password Change...');
            try {
                const newPassword = 'NewTestPassword123!';
                const passwordChanged = await authService.changePassword(testDealer.id, testDealerData.password, newPassword);
                logTest('Password change', passwordChanged, 'Password updated successfully');

                // Verify new password works
                const newAuthResult = await authService.authenticateDealer(testDealerData.email, newPassword);
                logTest('New password authentication', !!newAuthResult.token, 'Authentication with new password successful');
            } catch (passError) {
                logTest('Password change', false, passError.message);
            }

        } catch (dealerError) {
            logTest('Dealer creation', false, dealerError.message);
        }

        // Test 11: Invalid authentication attempts
        console.log('\n🚫 Testing Security Features...');
        try {
            await authService.authenticateDealer('nonexistent@test.com', 'wrongpassword');
            logTest('Invalid email rejection', false, 'Should have failed');
        } catch (error) {
            logTest('Invalid email rejection', error.message === 'Invalid credentials', 'Correctly rejected invalid email');
        }

        try {
            await authService.authenticateDealer(testDealerData.email, 'wrongpassword');
            logTest('Invalid password rejection', false, 'Should have failed');
        } catch (error) {
            logTest('Invalid password rejection', error.message === 'Invalid credentials', 'Correctly rejected invalid password');
        }

        // Test 12: Database cleanup
        console.log('\n🧹 Testing Database Cleanup...');
        try {
            const cleanupResult = await db.cleanup();
            logTest('Database cleanup', cleanupResult, 'Expired 2FA codes cleaned up');
        } catch (cleanupError) {
            logTest('Database cleanup', false, cleanupError.message);
        }

    } catch (error) {
        console.error('\n💥 Critical test failure:', error);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`📊 TEST SUMMARY: ${testsPassed}/${totalTests} tests passed`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 All tests passed! Authentication system is ready.');
        console.log('\n✅ Next steps:');
        console.log('   1. Set up your .env file with real Gmail credentials');
        console.log('   2. Configure GoHighLevel API keys');
        console.log('   3. Test the web interface');
        console.log('   4. Set EMAIL_TEST_MODE=false for production');
    } else {
        console.log(`❌ ${totalTests - testsPassed} tests failed. Please review the errors above.`);
        console.log('\n🔧 Common fixes:');
        console.log('   - Ensure all npm dependencies are installed');
        console.log('   - Check your .env file configuration');
        console.log('   - Verify Gmail app password setup');
        console.log('   - Make sure the data directory is writable');
    }

    console.log('\n🌐 To test the web interface:');
    console.log('   1. Run: npm start');
    console.log('   2. Visit: http://localhost:3000');
    console.log('   3. Try registering a new dealer');
    console.log('   4. Test the 2FA login flow');
}

// Helper function to create test data
async function createSampleData() {
    console.log('\n🗂️ Creating sample data for testing...');
    
    try {
        // Create a few sample dealers
        const sampleDealers = [
            {
                email: 'basic.dealer@example.com',
                password: 'BasicDealer123!',
                dealerName: 'Basic Auto Sales',
                contactName: 'Bob Basic',
                phone: '555-111-2222',
                dealerLicenseNumber: 'DL001',
                subscriptionTier: 'basic'
            },
            {
                email: 'premium.dealer@example.com',
                password: 'PremiumDealer123!',
                dealerName: 'Premium Auto Group',
                contactName: 'Pete Premium',
                phone: '555-333-4444',
                dealerLicenseNumber: 'DL002',
                subscriptionTier: 'premium'
            }
        ];

        for (const dealerData of sampleDealers) {
            try {
                const dealer = await authService.createDealer(dealerData);
                console.log(`   ✅ Created sample dealer: ${dealer.dealerName}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`   ⚠️ Sample dealer already exists: ${dealerData.dealerName}`);
                } else {
                    console.log(`   ❌ Failed to create ${dealerData.dealerName}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error creating sample data:', error);
    }
}

// Run the tests
if (require.main === module) {
    testAuthentication()
        .then(() => {
            console.log('\n🎯 Test run completed.');
            
            // Ask if user wants to create sample data
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('\nWould you like to create sample dealer data for testing? (y/n): ', (answer) => {
                if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                    createSampleData().then(() => {
                        console.log('✅ Sample data creation completed.');
                        rl.close();
                    });
                } else {
                    console.log('✅ Skipping sample data creation.');
                    rl.close();
                }
            });
        })
        .catch(error => {
            console.error('💥 Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = { testAuthentication, createSampleData };
