// test-auth-flow.js - AUTHENTICATION FLOW TEST FOR CREDIT APPLICATION LIFECYCLE
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test configuration
const TEST_DEALER = {
    email: 'mjm@mjmmotors.com',  // Use a real dealer email from your system
    password: 'test123'          // Use a real password
};

async function testFullAuthFlow() {
    console.log('🧪 COMPREHENSIVE AUTHENTICATION FLOW TEST');
    console.log('='.repeat(60));
    console.log(`📍 Testing against: ${BASE_URL}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}\n`);

    let authToken = null;

    // Step 1: Test login endpoint
    console.log('1️⃣ Testing login flow...');
    try {
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: TEST_DEALER.email,
            password: TEST_DEALER.password
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`   ✅ Login response: ${loginResponse.status}`);
        console.log(`   📄 Response data:`, JSON.stringify(loginResponse.data, null, 2));

        if (loginResponse.data.success && loginResponse.data.token) {
            authToken = loginResponse.data.token;
            console.log(`   🎯 JWT Token received (length: ${authToken.length})`);
            console.log(`   🔑 Token starts with: ${authToken.substring(0, 20)}...`);
            
            // Store token for localStorage simulation
            console.log(`   💾 Token would be stored in localStorage as 'pinnacle_auth_token'`);
        } else {
            console.log(`   ❌ Login failed - no token received`);
            return;
        }

    } catch (error) {
        console.log(`   ❌ Login request failed:`, error.response?.data || error.message);
        console.log(`   📊 Status: ${error.response?.status}`);
        console.log(`   📄 Response headers:`, error.response?.headers);
        return;
    }

    // Step 2: Test dashboard profile endpoint
    console.log('\n2️⃣ Testing dashboard profile access...');
    try {
        const profileResponse = await axios.get(`${API_BASE}/dashboard/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`   ✅ Dashboard profile response: ${profileResponse.status}`);
        console.log(`   📄 Profile data:`, JSON.stringify(profileResponse.data, null, 2));

    } catch (error) {
        console.log(`   ❌ Dashboard profile failed:`, error.response?.data || error.message);
        console.log(`   📊 Status: ${error.response?.status}`);
    }

    // Step 3: Test recent applications endpoint
    console.log('\n3️⃣ Testing recent applications access...');
    try {
        const applicationsResponse = await axios.get(`${API_BASE}/dashboard/recent-applications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`   ✅ Recent applications response: ${applicationsResponse.status}`);
        console.log(`   📄 Applications data:`, JSON.stringify(applicationsResponse.data, null, 2));

    } catch (error) {
        console.log(`   ❌ Recent applications failed:`, error.response?.data || error.message);
        console.log(`   📊 Status: ${error.response?.status}`);
    }

    // Step 4: Test both application submission endpoints
    console.log('\n4️⃣ Testing application submission endpoints...');
    
    const testApplicationData = {
        applicantName: 'John Test Dealer',
        email: 'test@testdealer.com',
        phone: '555-123-4567',
        vehicleYear: '2020',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleInfo: '2020 Toyota Camry SE',
        vehiclePrice: '25000',
        downPayment: '5000',
        amountFinanced: '20000',
        creditScore: '720',
        monthlyIncome: '5000',
        employment: 'Full-time',
        residenceType: 'Own'
    };

    // Test NEW endpoint (/api/applications/submit)
    console.log('\n   🔍 Testing NEW endpoint: /api/applications/submit');
    try {
        const newEndpointResponse = await axios.post(`${API_BASE}/applications/submit`, testApplicationData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`   ✅ NEW endpoint response: ${newEndpointResponse.status}`);
        console.log(`   📄 Response data:`, JSON.stringify(newEndpointResponse.data, null, 2));

    } catch (error) {
        console.log(`   ❌ NEW endpoint failed:`, error.response?.data || error.message);
        console.log(`   📊 Status: ${error.response?.status}`);
        
        if (error.response?.status === 404) {
            console.log(`   💡 Route not found - check server.js route mounting`);
        }
    }

    // Test OLD endpoint (/api/credit-application/submit)
    console.log('\n   🔍 Testing OLD endpoint: /api/credit-application/submit');
    try {
        const oldEndpointResponse = await axios.post(`${API_BASE}/credit-application/submit`, testApplicationData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`   ✅ OLD endpoint response: ${oldEndpointResponse.status}`);
        console.log(`   📄 Response data:`, JSON.stringify(oldEndpointResponse.data, null, 2));

    } catch (error) {
        console.log(`   ❌ OLD endpoint failed:`, error.response?.data || error.message);
        console.log(`   📊 Status: ${error.response?.status}`);
    }

    // Step 5: Test without authentication
    console.log('\n5️⃣ Testing endpoints without authentication...');
    
    try {
        const noAuthResponse = await axios.get(`${API_BASE}/dashboard/recent-applications`, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        console.log(`   ⚠️ No auth request succeeded: ${noAuthResponse.status}`);
        console.log(`   📄 This should not happen - check auth middleware`);

    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`   ✅ Correctly rejected unauthenticated request (401)`);
        } else {
            console.log(`   ❌ Unexpected error:`, error.response?.data || error.message);
        }
    }

    // Step 6: Test with invalid token
    console.log('\n6️⃣ Testing with invalid token...');
    
    try {
        const invalidTokenResponse = await axios.get(`${API_BASE}/dashboard/recent-applications`, {
            headers: {
                'Authorization': 'Bearer invalid.token.here',
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        console.log(`   ⚠️ Invalid token request succeeded: ${invalidTokenResponse.status}`);
        console.log(`   📄 This should not happen - check token validation`);

    } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.log(`   ✅ Correctly rejected invalid token (${error.response.status})`);
        } else {
            console.log(`   ❌ Unexpected error:`, error.response?.data || error.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 AUTHENTICATION FLOW TEST COMPLETE');
    console.log('='.repeat(60));
}

// Test credit application form simulation
async function testCreditApplicationFlow() {
    console.log('\n🌐 CREDIT APPLICATION FORM FLOW SIMULATION');
    console.log('='.repeat(60));

    // Step 1: Simulate getting the credit application page
    console.log('1️⃣ Simulating credit application page access...');
    try {
        const pageResponse = await axios.get(`${BASE_URL}/credit_application.html`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });

        console.log(`   ✅ Credit application page accessible: ${pageResponse.status}`);
        
        // Check what endpoint the form is using
        const html = pageResponse.data;
        if (html.includes('/api/credit-application/submit')) {
            console.log(`   ⚠️ Form uses OLD endpoint: /api/credit-application/submit`);
        }
        if (html.includes('/api/applications/submit')) {
            console.log(`   ✅ Form uses NEW endpoint: /api/applications/submit`);
        }
        if (html.includes('Authorization')) {
            console.log(`   ✅ Form includes authorization headers`);
        } else {
            console.log(`   ⚠️ Form missing authorization headers`);
        }
        if (html.includes('localStorage')) {
            console.log(`   ✅ Form checks localStorage for token`);
        } else {
            console.log(`   ⚠️ Form doesn't check localStorage for token`);
        }

    } catch (error) {
        console.log(`   ❌ Credit application page failed: ${error.message}`);
    }

    // Step 2: Simulate the browser flow
    console.log('\n2️⃣ Simulating browser authentication flow...');
    console.log('   📱 1. User logs in on login.html');
    console.log('   💾 2. Token stored in localStorage');
    console.log('   🔄 3. User navigates to dashboard.html');
    console.log('   🔗 4. User clicks "Submit New Deal" button');
    console.log('   📄 5. Browser navigates to credit_application.html');
    console.log('   🔍 6. credit_application.html checks localStorage for token');
    console.log('   📝 7. User fills out and submits form');
    console.log('   🚀 8. Form submits to /api/applications/submit with Authorization header');
    
    console.log('\n   💡 POTENTIAL ISSUES:');
    console.log('   • Token not being passed from dashboard to credit app');
    console.log('   • Credit app not checking localStorage for token');
    console.log('   • Credit app not including Authorization header');
    console.log('   • Wrong endpoint URL in credit app form');
    console.log('   • Server routes not mounted correctly');
}

// Test server health and availability
async function testServerHealth() {
    console.log('\n🏥 SERVER HEALTH CHECK');
    console.log('='.repeat(40));

    try {
        const healthResponse = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        console.log(`✅ Server health: ${healthResponse.status}`);
        console.log(`📊 Uptime: ${Math.floor(healthResponse.data.uptime)}s`);
        console.log(`🌍 Environment: ${healthResponse.data.environment}`);
        console.log(`🔐 Auth service: ${healthResponse.data.services?.auth}`);
        console.log(`🗄️ Database: ${healthResponse.data.services?.database}`);
        
        return true;
    } catch (error) {
        console.log(`❌ Server health check failed: ${error.message}`);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🔧 PINNACLE AUTO FINANCE - AUTHENTICATION FLOW TESTING');
    console.log('='.repeat(70));
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`📍 Target URL: ${BASE_URL}\n`);

    // Test server health first
    const serverHealthy = await testServerHealth();
    if (!serverHealthy) {
        console.log('\n❌ Server is not healthy. Please start the server first.');
        console.log('💡 Run: node server.js');
        process.exit(1);
    }

    // Run the authentication flow tests
    await testFullAuthFlow();
    
    // Run the credit application flow simulation
    await testCreditApplicationFlow();

    console.log('\n🎯 DEBUGGING TIPS:');
    console.log('1. Check server logs for detailed authentication attempts');
    console.log('2. Verify dealer credentials in data/dealers.json');
    console.log('3. Check route mounting in server.js');
    console.log('4. Verify credit_application.html uses correct endpoint');
    console.log('5. Check browser console for JavaScript errors');
    console.log('6. Verify localStorage token handling');
    
    console.log(`\n🏁 Test completed at: ${new Date().toISOString()}`);
}

// Run the tests
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = {
    testFullAuthFlow,
    testCreditApplicationFlow,
    testServerHealth
};
