// test-browserbase-simple.js
// Simple BrowserBase connection test

require('dotenv').config();
const { Stagehand } = require('@browserbasehq/stagehand');

async function testConnection() {
    console.log('\n🧪 BrowserBase Connection Test\n');
    console.log('================================\n');

    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    console.log('Credentials:');
    console.log(`  ✅ BrowserBase API Key: ${apiKey?.substring(0, 15)}...`);
    console.log(`  ✅ Project ID: ${projectId}`);
    console.log(`  ✅ Anthropic API Key: ${anthropicKey?.substring(0, 15)}...\n`);

    let stagehand;
    try {
        console.log('Initializing Stagehand...');

        stagehand = new Stagehand({
            apiKey,
            projectId,
            env: 'BROWSERBASE',
            modelName: 'claude-3-5-sonnet-20241022',
            modelApiKey: anthropicKey,
            verbose: 0
        });

        await stagehand.init();
        console.log('✅ Stagehand initialized!\n');

        console.log('Navigating to example.com...');
        await stagehand.page.goto('https://example.com');
        await stagehand.page.waitForLoadState('networkidle');
        console.log('✅ Navigation successful!\n');

        const title = await stagehand.page.title();
        console.log(`Page title: "${title}"\n`);

        const screenshot = await stagehand.page.screenshot({ type: 'png' });
        console.log(`✅ Screenshot captured: ${screenshot.length} bytes\n`);

        console.log('================================');
        console.log('🎉 SUCCESS! BrowserBase is working!\n');
        console.log('Ready to automate lender forms!');
        console.log('================================\n');

        return true;

    } catch (error) {
        console.error('\n❌ ERROR:', error.message, '\n');
        return false;

    } finally {
        if (stagehand) {
            await stagehand.close();
        }
    }
}

testConnection().then(success => process.exit(success ? 0 : 1));
