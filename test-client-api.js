// test-client-api.js
// Test script for client and lender API endpoints

const testClientAndLenderAPI = async () => {
    const baseUrl = 'http://localhost:3000';

    console.log('🧪 Testing Client & Lender API Endpoints\n');

    try {
        // Test 1: Create a lender (as admin/dealer)
        console.log('📝 Test 1: Create Lender');
        const lenderResponse = await fetch(`${baseUrl}/api/lenders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token-here' // Replace with real dealer token
            },
            body: JSON.stringify({
                name: 'Test Credit Union',
                url: 'https://testcu.com/apply',
                category: 'credit_union',
                active: true
            })
        });
        const lenderData = await lenderResponse.json();
        console.log('✅ Lender created:', lenderData);
        console.log('');

        // Test 2: Get all lenders
        console.log('📋 Test 2: Get All Lenders');
        const lendersResponse = await fetch(`${baseUrl}/api/lenders?active=true`, {
            headers: {
                'Authorization': 'Bearer test-token-here'
            }
        });
        const lendersData = await lendersResponse.json();
        console.log('✅ Lenders retrieved:', lendersData);
        console.log('');

        // Test 3: Client Registration
        console.log('👤 Test 3: Client Registration');
        const registerResponse = await fetch(`${baseUrl}/api/client/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'testclient@gmail.com',
                password: 'SecurePass123!',
                firstName: 'John',
                lastName: 'Doe',
                phone: '555-1234',
                dealerId: 'dealer-id-here' // Replace with real dealer ID
            })
        });
        const registerData = await registerResponse.json();
        console.log('✅ Client registered:', registerData);
        console.log('');

        // Store client token for next tests
        const clientToken = registerData.token;

        // Test 4: Client Login
        console.log('🔐 Test 4: Client Login');
        const loginResponse = await fetch(`${baseUrl}/api/client/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'testclient@gmail.com',
                password: 'SecurePass123!'
            })
        });
        const loginData = await loginResponse.json();
        console.log('✅ Client logged in:', loginData);
        console.log('');

        // Test 5: Get Client Profile
        console.log('👤 Test 5: Get Client Profile');
        const profileResponse = await fetch(`${baseUrl}/api/client/profile`, {
            headers: {
                'Authorization': `Bearer ${clientToken}`
            }
        });
        const profileData = await profileResponse.json();
        console.log('✅ Profile retrieved:', profileData);
        console.log('');

        // Test 6: Get Client Applications
        console.log('📄 Test 6: Get Client Applications');
        const appsResponse = await fetch(`${baseUrl}/api/client/applications`, {
            headers: {
                'Authorization': `Bearer ${clientToken}`
            }
        });
        const appsData = await appsResponse.json();
        console.log('✅ Applications retrieved:', appsData);
        console.log('');

        // Test 7: Get Client Submissions
        console.log('📊 Test 7: Get Client Submissions');
        const subsResponse = await fetch(`${baseUrl}/api/client/submissions`, {
            headers: {
                'Authorization': `Bearer ${clientToken}`
            }
        });
        const subsData = await subsResponse.json();
        console.log('✅ Submissions retrieved:', subsData);
        console.log('');

        console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    }
};

// Run tests
testClientAndLenderAPI();
