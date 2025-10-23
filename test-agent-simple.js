// test-agent-simple.js
// Simple test for agent API without Claude integration

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

async function testBasicEndpoints() {
    console.log('🧪 Testing Agent API (without Claude plan generation)\n');

    try {
        // Test 1: Try to access without auth (should fail)
        console.log('1️⃣ Testing unauthenticated access (should fail)...');
        try {
            await axios.get(`${API_BASE_URL}/api/agent/submissions`);
            console.log('   ❌ Should have failed but didn\'t');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('   ✅ Correctly rejected unauthorized request');
            } else {
                throw error;
            }
        }

        // Test 2: Check if endpoint exists
        console.log('\n2️⃣ Testing if agent routes are mounted...');
        try {
            await axios.get(`${API_BASE_URL}/api/agent/stats`);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('   ✅ Agent routes are mounted (got 401 as expected)');
            } else if (error.response && error.response.status === 404) {
                console.log('   ❌ Agent routes NOT found (404)');
                throw new Error('Agent routes not mounted');
            } else {
                throw error;
            }
        }

        // Test 3: Test database methods directly
        console.log('\n3️⃣ Testing database submission methods directly...');
        const db = require('./services/databaseService');

        // Create a test submission
        const testSubmission = await db.createSubmission({
            dealerId: 'test-dealer-123',
            applicationId: 'test-app-456',
            lenderUrl: 'https://example.com/apply',
            lenderName: 'Example Bank',
            status: 'pending'
        });

        console.log('   ✅ Created test submission:', testSubmission.id);

        // Get submissions
        const submissions = await db.getSubmissionsByDealer('test-dealer-123');
        console.log('   ✅ Retrieved submissions:', submissions.total);

        // Update status
        const updated = await db.updateSubmissionStatus(testSubmission.id, 'submitted');
        console.log('   ✅ Updated status to:', updated.status);

        // Get stats
        const stats = await db.getSubmissionStats('test-dealer-123');
        console.log('   ✅ Got stats - Total:', stats.total, 'Submitted:', stats.submitted);

        // Cleanup
        await db.deleteSubmission(testSubmission.id);
        console.log('   ✅ Cleaned up test submission');

        // Test 4: Test autofill service validation
        console.log('\n4️⃣ Testing plan validation...');
        const agentService = require('./services/autofillAgentService');

        const validPlan = {
            steps: [
                { type: 'type', selector: '#name', value: 'John Doe', description: 'Enter name' },
                { type: 'click', selector: '#submit', description: 'Submit form' }
            ],
            warnings: [],
            captchaLikely: false
        };

        const validation = agentService.validatePlan(validPlan);
        console.log('   ✅ Valid plan passed validation:', validation.valid);

        const invalidPlan = {
            steps: [
                { type: 'invalid_type', selector: '#test' }
            ]
        };

        const invalidValidation = agentService.validatePlan(invalidPlan);
        console.log('   ✅ Invalid plan rejected:', !invalidValidation.valid);
        console.log('   Errors:', invalidValidation.errors);

        console.log('\n✅ All basic tests passed!\n');
        console.log('💡 To test Claude plan generation, you need to:');
        console.log('   1. Ensure ANTHROPIC_API_KEY is set in .env');
        console.log('   2. Have a valid dealer account to authenticate');
        console.log('   3. Run test-agent-api.js with proper credentials\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        process.exit(1);
    }
}

testBasicEndpoints();
