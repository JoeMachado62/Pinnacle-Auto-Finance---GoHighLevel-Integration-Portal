// test-claude-plan.js
// Test Claude Sonnet 4.5 plan generation directly

const autofillAgentService = require('./services/autofillAgentService');
const db = require('./services/databaseService');

async function testClaudePlanGeneration() {
    console.log('🤖 Testing Claude Sonnet 4.5 Plan Generation\n');

    try {
        // Get a real application from the database
        console.log('1️⃣ Loading sample application...');
        const applicationsData = await db.readFile(db.applicationsFile);
        const application = applicationsData.applications[0]; // Luz Markham

        if (!application) {
            throw new Error('No applications found in database');
        }

        console.log('   ✅ Loaded application for:', application.applicantName);
        console.log('   Application ID:', application.id);

        // Test lender URL
        const lenderUrl = 'https://www.chase.com/personal/auto/apply';

        // Sample DOM context
        const domContext = JSON.stringify([
            {
                id: 'credit-application-form',
                action: '/personal/auto/submit',
                inputs: [
                    { type: 'text', name: 'firstName', id: 'first-name', placeholder: 'First Name', label: 'First Name' },
                    { type: 'text', name: 'lastName', id: 'last-name', placeholder: 'Last Name', label: 'Last Name' },
                    { type: 'text', name: 'middleInitial', id: 'middle-initial', placeholder: 'M.I.', label: 'Middle Initial (optional)' },
                    { type: 'tel', name: 'phoneNumber', id: 'phone', placeholder: '(555) 555-5555', label: 'Phone Number' },
                    { type: 'email', name: 'emailAddress', id: 'email', placeholder: 'email@example.com', label: 'Email Address' },
                    { type: 'text', name: 'ssn', id: 'ssn', placeholder: '###-##-####', label: 'Social Security Number' },
                    { type: 'date', name: 'dateOfBirth', id: 'dob', label: 'Date of Birth' },
                    { type: 'text', name: 'streetAddress', id: 'address', placeholder: 'Street Address', label: 'Address' },
                    { type: 'text', name: 'city', id: 'city', placeholder: 'City', label: 'City' },
                    { type: 'select', name: 'state', id: 'state', label: 'State' },
                    { type: 'text', name: 'zipCode', id: 'zip', placeholder: '12345', label: 'ZIP Code' },
                    { type: 'number', name: 'annualIncome', id: 'income', placeholder: '$50,000', label: 'Annual Income' },
                    { type: 'text', name: 'employerName', id: 'employer', placeholder: 'Employer Name', label: 'Employer' },
                    { type: 'number', name: 'vehiclePrice', id: 'price', placeholder: 'Vehicle Price', label: 'Vehicle Price' },
                    { type: 'text', name: 'vehicleYear', id: 'year', placeholder: 'Year', label: 'Vehicle Year' },
                    { type: 'text', name: 'vehicleMake', id: 'make', placeholder: 'Make', label: 'Vehicle Make' },
                    { type: 'text', name: 'vehicleModel', id: 'model', placeholder: 'Model', label: 'Vehicle Model' },
                    { type: 'text', name: 'vin', id: 'vin', placeholder: 'VIN', label: 'Vehicle VIN' },
                    { type: 'submit', name: 'submit', id: 'submit-btn', label: 'Submit Application' }
                ]
            }
        ]);

        console.log('\n2️⃣ Generating automation plan with Claude Sonnet 4.5...');
        console.log('   Lender:', lenderUrl);
        console.log('   DOM fields:', 19);

        const startTime = Date.now();

        const result = await autofillAgentService.generateAutomationPlan(
            application,
            lenderUrl,
            domContext
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n   ✅ Plan generated successfully in', duration, 'seconds');
        console.log('   Model:', result.model);
        console.log('   Steps:', result.plan.steps.length);
        console.log('   Warnings:', result.plan.warnings.length);
        console.log('   CAPTCHA likely:', result.plan.captchaLikely);
        console.log('   Input tokens:', result.usage.input_tokens);
        console.log('   Output tokens:', result.usage.output_tokens);

        // Calculate cost
        const inputCost = (result.usage.input_tokens / 1000000) * 3; // $3 per million
        const outputCost = (result.usage.output_tokens / 1000000) * 15; // $15 per million
        const totalCost = inputCost + outputCost;

        console.log('   Cost: $' + totalCost.toFixed(4));

        // Show first 5 steps
        console.log('\n3️⃣ Generated Steps (showing first 5):');
        result.plan.steps.slice(0, 5).forEach((step, i) => {
            console.log(`   ${i + 1}. [${step.type}] ${step.description || step.selector}`);
            if (step.value && step.type !== 'wait') {
                const displayValue = step.value.length > 30 ? step.value.substring(0, 27) + '...' : step.value;
                console.log(`      Value: "${displayValue}"`);
            }
            if (step.confidence) {
                console.log(`      Confidence: ${(step.confidence * 100).toFixed(0)}%`);
            }
        });

        // Validate the plan
        console.log('\n4️⃣ Validating plan structure...');
        const validation = autofillAgentService.validatePlan(result.plan);

        if (validation.valid) {
            console.log('   ✅ Plan is valid and executable');
        } else {
            console.log('   ❌ Plan validation failed:');
            validation.errors.forEach(err => console.log('      -', err));
        }

        // Show warnings if any
        if (result.plan.warnings && result.plan.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.plan.warnings.forEach(warning => {
                console.log('   -', warning);
            });
        }

        console.log('\n✅ Claude plan generation test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testClaudePlanGeneration();
