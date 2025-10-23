// test-agent-api.js
// Test script for Pinnacle Autofill Agent API endpoints

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'joemachado62@live.com'; // MJM Motors dealer
const TEST_PASSWORD = 'Mj2024!@#'; // Update if different - this is a guess, may need to be changed

let authToken = null;
let testApplicationId = 'f12a5150-990b-406a-ac26-3c16828ca77f'; // Luz Markham application
let testSubmissionId = null;

async function runTests() {
    console.log('🧪 Starting Pinnacle Autofill Agent API Tests\n');

    try {
        // Test 1: Login
        await testLogin();

        // Test 2: Generate Plan
        await testGeneratePlan();

        // Test 3: Log Submission
        await testLogSubmission();

        // Test 4: Get Submissions
        await testGetSubmissions();

        // Test 5: Get Submission by ID
        await testGetSubmissionById();

        // Test 6: Update Submission Status
        await testUpdateSubmission();

        // Test 7: Get Stats
        await testGetStats();

        // Test 8: Delete Submission (optional - commented out)
        // await testDeleteSubmission();

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

async function testLogin() {
    console.log('1️⃣ Testing Login...');

    try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        authToken = response.data.token;
        console.log('   ✅ Login successful');
        console.log('   Token:', authToken.substring(0, 20) + '...');
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

async function testGeneratePlan() {
    console.log('\n2️⃣ Testing Generate Plan...');

    const sampleLenderUrl = 'https://www.chase.com/personal/auto/apply';
    const sampleDomContext = JSON.stringify([
        {
            id: 'credit-application-form',
            action: '/submit',
            inputs: [
                { type: 'text', name: 'firstName', id: 'first-name', placeholder: 'First Name', label: 'First Name' },
                { type: 'text', name: 'lastName', id: 'last-name', placeholder: 'Last Name', label: 'Last Name' },
                { type: 'tel', name: 'phone', id: 'phone', placeholder: 'Phone Number', label: 'Phone' },
                { type: 'email', name: 'email', id: 'email', placeholder: 'Email', label: 'Email Address' },
                { type: 'text', name: 'ssn', id: 'ssn', placeholder: '###-##-####', label: 'Social Security Number' }
            ]
        }
    ]);

    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/agent/generate-plan`,
            {
                applicationId: testApplicationId,
                lenderUrl: sampleLenderUrl,
                domContext: sampleDomContext
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Plan generated successfully');
        console.log('   Model:', response.data.model);
        console.log('   Steps:', response.data.plan.steps.length);
        console.log('   Input tokens:', response.data.usage.input_tokens);
        console.log('   Output tokens:', response.data.usage.output_tokens);
        console.log('   Submission ID:', response.data.submissionId);

        testSubmissionId = response.data.submissionId;

        // Show first 3 steps
        console.log('\n   First 3 steps:');
        response.data.plan.steps.slice(0, 3).forEach((step, i) => {
            console.log(`   ${i + 1}. ${step.type}: ${step.description || step.selector}`);
        });

    } catch (error) {
        throw new Error(`Generate plan failed: ${error.message}`);
    }
}

async function testLogSubmission() {
    console.log('\n3️⃣ Testing Log Submission...');

    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/agent/log-submission`,
            {
                applicationId: testApplicationId,
                lenderUrl: 'https://www.wellsfargo.com/auto-loans/apply',
                status: 'submitted',
                userInterventions: 1,
                submittedAt: new Date().toISOString()
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Submission logged successfully');
        console.log('   Submission ID:', response.data.submission.id);
        console.log('   Status:', response.data.submission.status);

    } catch (error) {
        throw new Error(`Log submission failed: ${error.message}`);
    }
}

async function testGetSubmissions() {
    console.log('\n4️⃣ Testing Get Submissions...');

    try {
        const response = await axios.get(
            `${API_BASE_URL}/api/agent/submissions`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Submissions retrieved successfully');
        console.log('   Total:', response.data.total);
        console.log('   Returned:', response.data.submissions.length);
        console.log('   Has more:', response.data.hasMore);

        if (response.data.submissions.length > 0) {
            console.log('\n   Recent submissions:');
            response.data.submissions.slice(0, 3).forEach(sub => {
                console.log(`   - ${sub.lenderName}: ${sub.status} (${new Date(sub.createdAt).toLocaleDateString()})`);
            });
        }

    } catch (error) {
        throw new Error(`Get submissions failed: ${error.message}`);
    }
}

async function testGetSubmissionById() {
    console.log('\n5️⃣ Testing Get Submission by ID...');

    if (!testSubmissionId) {
        console.log('   ⏭️ Skipped (no submission ID from plan generation)');
        return;
    }

    try {
        const response = await axios.get(
            `${API_BASE_URL}/api/agent/submissions/${testSubmissionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Submission retrieved successfully');
        console.log('   ID:', response.data.submission.id);
        console.log('   Lender:', response.data.submission.lenderName);
        console.log('   Status:', response.data.submission.status);
        console.log('   Has plan:', !!response.data.submission.automationPlan);

    } catch (error) {
        throw new Error(`Get submission by ID failed: ${error.message}`);
    }
}

async function testUpdateSubmission() {
    console.log('\n6️⃣ Testing Update Submission Status...');

    if (!testSubmissionId) {
        console.log('   ⏭️ Skipped (no submission ID)');
        return;
    }

    try {
        const response = await axios.patch(
            `${API_BASE_URL}/api/agent/submissions/${testSubmissionId}`,
            {
                status: 'approved'
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Submission updated successfully');
        console.log('   New status:', response.data.submission.status);

    } catch (error) {
        throw new Error(`Update submission failed: ${error.message}`);
    }
}

async function testGetStats() {
    console.log('\n7️⃣ Testing Get Stats...');

    try {
        const response = await axios.get(
            `${API_BASE_URL}/api/agent/stats`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Stats retrieved successfully');
        console.log('   Total submissions:', response.data.stats.total);
        console.log('   Pending:', response.data.stats.pending);
        console.log('   Submitted:', response.data.stats.submitted);
        console.log('   Approved:', response.data.stats.approved);
        console.log('   Declined:', response.data.stats.declined);
        console.log('   Errors:', response.data.stats.error);
        console.log('   Avg interventions:', response.data.stats.averageInterventions.toFixed(2));

    } catch (error) {
        throw new Error(`Get stats failed: ${error.message}`);
    }
}

async function testDeleteSubmission() {
    console.log('\n8️⃣ Testing Delete Submission...');

    if (!testSubmissionId) {
        console.log('   ⏭️ Skipped (no submission ID)');
        return;
    }

    try {
        const response = await axios.delete(
            `${API_BASE_URL}/api/agent/submissions/${testSubmissionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('   ✅ Submission deleted successfully');
        console.log('   Message:', response.data.message);

    } catch (error) {
        throw new Error(`Delete submission failed: ${error.message}`);
    }
}

// Run tests
runTests();
