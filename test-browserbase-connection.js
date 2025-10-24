// test-browserbase-connection.js
// Test BrowserBase + Stagehand connection

require('dotenv').config();
const { Stagehand } = require('@browserbasehq/stagehand');

async function testBrowserBaseConnection() {
    console.log('\n🧪 Testing BrowserBase + Stagehand Connection\n');
    console.log('================================================\n');

    // Check credentials
    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;

    console.log('📋 Configuration Check:');
    console.log(`  API Key: ${apiKey ? '✅ ' + apiKey.substring(0, 15) + '...' : '❌ Missing'}`);
    console.log(`  Project ID: ${projectId ? '✅ ' + projectId : '❌ Missing'}`);
    console.log('');

    if (!apiKey || !projectId) {
        console.error('❌ Missing BrowserBase credentials in .env file\n');
        process.exit(1);
    }

    let stagehand;
    try {
        console.log('🚀 Initializing Stagehand with BrowserBase...\n');

        stagehand = new Stagehand({
            apiKey: apiKey,
            projectId: projectId,
            env: 'BROWSERBASE',
            verbose: 1,
            debugDom: true,
            // Use Anthropic Claude for AI vision
            modelName: 'claude-3-5-sonnet-20241022',
            modelApiKey: process.env.ANTHROPIC_API_KEY
        });

        await stagehand.init();

        console.log('✅ Stagehand initialized successfully!\n');

        // Test navigation
        console.log('🌐 Testing navigation to example.com...\n');
        await stagehand.page.goto('https://example.com');
        await stagehand.page.waitForLoadState('networkidle', { timeout: 30000 });

        console.log('✅ Navigation successful!\n');

        // Test extraction
        console.log('🔍 Testing AI extraction...\n');
        const result = await stagehand.extract({
            instruction: 'Extract the main heading text from this page',
            schema: {
                heading: 'string - the main heading/title of the page'
            }
        });

        console.log('✅ Extraction successful!');
        console.log(`  Extracted heading: "${result.heading}"\n`);

        // Test action
        console.log('🎯 Testing AI action (finding and describing elements)...\n');
        await stagehand.act('Observe the "More information" link on the page');

        console.log('✅ Action successful!\n');

        // Take screenshot
        console.log('📸 Taking screenshot...\n');
        const screenshot = await stagehand.page.screenshot({
            type: 'png',
            fullPage: false
        });

        console.log(`✅ Screenshot captured (${screenshot.length} bytes)\n`);

        console.log('================================================');
        console.log('🎉 All tests passed! BrowserBase is working!\n');
        console.log('Next steps:');
        console.log('  1. ✅ BrowserBase connection verified');
        console.log('  2. ✅ Stagehand AI vision working');
        console.log('  3. ✅ Navigation, extraction, and actions functional');
        console.log('  4. 🚀 Ready to test with real lender forms!');
        console.log('================================================\n');

        return true;

    } catch (error) {
        console.error('\n❌ Test failed!\n');
        console.error('Error:', error.message);
        console.error('\nStack trace:', error.stack);
        console.error('\n================================================\n');

        if (error.message.includes('API key')) {
            console.error('💡 Tip: Check that your BROWSERBASE_API_KEY is correct');
        } else if (error.message.includes('project')) {
            console.error('💡 Tip: Check that your BROWSERBASE_PROJECT_ID is correct');
        } else if (error.message.includes('timeout')) {
            console.error('💡 Tip: BrowserBase might be slow, try increasing timeout');
        } else {
            console.error('💡 Tip: Check the Stagehand documentation: https://github.com/browserbase/stagehand');
        }
        console.error('\n================================================\n');

        return false;

    } finally {
        // Always close Stagehand
        if (stagehand) {
            console.log('🔒 Closing Stagehand...\n');
            try {
                await stagehand.close();
                console.log('✅ Stagehand closed successfully\n');
            } catch (closeError) {
                console.error('⚠️  Error closing Stagehand:', closeError.message);
            }
        }
    }
}

// Run the test
testBrowserBaseConnection()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('\n💥 Unexpected error:', error);
        process.exit(1);
    });
