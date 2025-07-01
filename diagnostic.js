// diagnostic.js - PINNACLE AUTO FINANCE PORTAL DIAGNOSTIC TOOL
const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🔍 PINNACLE AUTO FINANCE PORTAL - COMPREHENSIVE DIAGNOSTIC TOOL');
console.log('='.repeat(70));

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

async function runDiagnostics() {
    console.log(`📍 Testing server at: ${BASE_URL}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}\n`);

    const results = {
        serverRunning: false,
        healthCheck: false,
        authEndpoint: false,
        dashboardEndpoint: false,
        applicationEndpoint: false,
        staticFiles: false,
        databaseFiles: false,
        logFiles: false,
        endpointMappings: false
    };

    // Test 1: Basic connectivity
    console.log('1️⃣ Testing basic server connectivity...');
    try {
        const response = await axios.get(BASE_URL, { 
            timeout: 5000,
            maxRedirects: 5,
            validateStatus: () => true // Accept any status code
        });
        console.log(`   ✅ Server responding (${response.status})`);
        if (response.status === 302 || response.status === 301) {
            console.log(`   🔄 Redirected to: ${response.headers.location}`);
        }
        results.serverRunning = true;
    } catch (error) {
        console.log(`   ❌ Server not responding: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            console.log(`   💡 Server appears to be down. Try: node server.js`);
        } else if (error.code === 'ENOTFOUND') {
            console.log(`   💡 DNS resolution failed. Check domain configuration.`);
        }
        return results;
    }

    // Test 2: Health endpoint
    console.log('\n2️⃣ Testing health endpoint...');
    try {
        const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        console.log(`   ✅ Health check passed (${response.status})`);
        console.log(`   📊 Server version: ${response.data.version || 'Unknown'}`);
        console.log(`   🌍 Environment: ${response.data.environment || 'Unknown'}`);
        console.log(`   ⏱️ Uptime: ${Math.floor(response.data.uptime || 0)}s`);
        console.log(`   💾 Memory usage: ${Math.floor((response.data.memory?.heapUsed || 0) / 1024 / 1024)}MB`);
        
        if (response.data.services) {
            console.log(`   🗄️ Database: ${response.data.services.database}`);
            console.log(`   📧 Email: ${response.data.services.email}`);
            console.log(`   🔐 Auth: ${response.data.services.auth}`);
        }
        
        results.healthCheck = true;
    } catch (error) {
        console.log(`   ❌ Health check failed: ${error.message}`);
        if (error.response) {
            console.log(`   📊 Status: ${error.response.status}`);
            console.log(`   📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }

    // Test 3: Auth endpoints
    console.log('\n3️⃣ Testing authentication endpoints...');
    try {
        const response = await axios.post(`${API_BASE}/auth/login`, {
            email: 'test@example.com',
            password: 'wrongpassword'
        }, { 
            timeout: 5000,
            validateStatus: () => true // Accept any status code
        });
        console.log(`   ✅ Auth endpoint responding (${response.status})`);
        
        if (response.status === 401 || response.status === 400) {
            console.log(`   ℹ️ Correctly rejecting invalid credentials`);
        } else if (response.status === 404) {
            console.log(`   ⚠️ Auth endpoint not found - check route mounting`);
        }
        
        results.authEndpoint = true;
    } catch (error) {
        console.log(`   ❌ Auth endpoint failed: ${error.message}`);
        if (error.response?.status === 404) {
            console.log(`   💡 Route not found. Check if /api/auth routes are mounted correctly.`);
        }
    }

    // Test 4: Dashboard endpoints (without auth)
    console.log('\n4️⃣ Testing dashboard endpoints...');
    try {
        const response = await axios.get(`${API_BASE}/dashboard/recent-applications`, { 
            timeout: 5000,
            validateStatus: () => true 
        });
        console.log(`   ✅ Dashboard endpoint responding (${response.status})`);
        if (response.status === 401) {
            console.log(`   ℹ️ Correctly requiring authentication`);
        } else if (response.status === 404) {
            console.log(`   ⚠️ Dashboard endpoint not found - check route mounting`);
        }
        results.dashboardEndpoint = true;
    } catch (error) {
        console.log(`   ❌ Dashboard endpoint failed: ${error.message}`);
    }

    // Test 5: Application endpoints - TEST BOTH ROUTES
    console.log('\n5️⃣ Testing application submission endpoints...');
    const applicationEndpoints = [
        '/api/applications/submit',
        '/api/credit-application/submit'
    ];
    
    let applicationEndpointWorking = false;
    for (const endpoint of applicationEndpoints) {
        try {
            const response = await axios.post(`${BASE_URL}${endpoint}`, {
                applicantName: 'Test User',
                vehicleYear: '2020',
                vehicleInfo: 'Test Vehicle'
            }, { 
                timeout: 5000,
                validateStatus: () => true 
            });
            
            console.log(`   ✅ ${endpoint} responding (${response.status})`);
            if (response.status === 401) {
                console.log(`   ℹ️ Correctly requiring authentication`);
                applicationEndpointWorking = true;
            } else if (response.status === 404) {
                console.log(`   ⚠️ ${endpoint} not found`);
            } else {
                console.log(`   ℹ️ ${endpoint} accessible`);
                applicationEndpointWorking = true;
            }
        } catch (error) {
            console.log(`   ❌ ${endpoint} failed: ${error.message}`);
        }
    }
    results.applicationEndpoint = applicationEndpointWorking;

    // Test 6: Static files
    console.log('\n6️⃣ Testing static file serving...');
    const staticFiles = ['login.html', 'dashboard.html', 'credit_application.html'];
    let staticWorking = true;
    
    for (const file of staticFiles) {
        try {
            const response = await axios.get(`${BASE_URL}/${file}`, { timeout: 5000 });
            console.log(`   ✅ ${file} accessible (${response.status})`);
            
            // Check if it's actually HTML
            if (response.headers['content-type']?.includes('text/html')) {
                console.log(`   📄 ${file} is valid HTML`);
            }
        } catch (error) {
            console.log(`   ❌ ${file} failed: ${error.message}`);
            staticWorking = false;
        }
    }
    results.staticFiles = staticWorking;

    // Test 7: Database files
    console.log('\n7️⃣ Checking database files...');
    const dataDir = path.join(__dirname, 'data');
    const requiredFiles = ['dealers.json', 'applications.json', 'conversations.json'];
    
    let dbFilesOk = true;
    for (const file of requiredFiles) {
        const filePath = path.join(dataDir, file);
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                console.log(`   ✅ ${file} exists (${stats.size} bytes)`);
                
                if (file === 'dealers.json') {
                    console.log(`      👥 Dealers: ${data.dealers?.length || 0}`);
                    if (data.dealers?.length > 0) {
                        const firstDealer = data.dealers[0];
                        console.log(`      📧 First dealer: ${firstDealer.email || 'No email'}`);
                        console.log(`      🏢 Dealer name: ${firstDealer.dealerName || 'No name'}`);
                    }
                }
                if (file === 'applications.json') {
                    console.log(`      📋 Applications: ${data.applications?.length || 0}`);
                }
            } else {
                console.log(`   ❌ ${file} missing`);
                dbFilesOk = false;
            }
        } catch (error) {
            console.log(`   ❌ ${file} error: ${error.message}`);
            dbFilesOk = false;
        }
    }
    results.databaseFiles = dbFilesOk;

    // Test 8: Log files
    console.log('\n8️⃣ Checking log files...');
    const logsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir);
        console.log(`   ✅ Logs directory exists`);
        console.log(`   📝 Log files: ${logFiles.join(', ')}`);
        
        // Show recent log entries from combined.log
        const combinedLog = path.join(logsDir, 'combined.log');
        if (fs.existsSync(combinedLog)) {
            const logContent = fs.readFileSync(combinedLog, 'utf8');
            const lines = logContent.split('\n').filter(line => line.trim());
            console.log(`   📄 Recent log entries (last 5):`);
            lines.slice(-5).forEach((line, index) => {
                console.log(`      ${index + 1}. ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
            });
        }
        
        // Check error log
        const errorLog = path.join(logsDir, 'error.log');
        if (fs.existsSync(errorLog)) {
            const errorContent = fs.readFileSync(errorLog, 'utf8');
            const errorLines = errorContent.split('\n').filter(line => line.trim());
            if (errorLines.length > 0) {
                console.log(`   ⚠️ Recent errors (last 3):`);
                errorLines.slice(-3).forEach((line, index) => {
                    console.log(`      ${index + 1}. ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
                });
            } else {
                console.log(`   ✅ No recent errors`);
            }
        }
        
        results.logFiles = true;
    } else {
        console.log(`   ❌ Logs directory missing`);
        console.log(`   💡 Create with: mkdir logs`);
    }

    // Test 9: Route endpoint mappings
    console.log('\n9️⃣ Testing endpoint route mappings...');
    const endpointTests = [
        { name: 'Auth Login', url: '/api/auth/login', method: 'POST' },
        { name: 'Dashboard Profile', url: '/api/dashboard/profile', method: 'GET' },
        { name: 'Applications Submit (NEW)', url: '/api/applications/submit', method: 'POST' },
        { name: 'Applications Submit (OLD)', url: '/api/credit-application/submit', method: 'POST' }
    ];
    
    let mappingWorking = true;
    for (const test of endpointTests) {
        try {
            const config = {
                method: test.method.toLowerCase(),
                url: `${BASE_URL}${test.url}`,
                timeout: 3000,
                validateStatus: () => true
            };
            
            if (test.method === 'POST') {
                config.data = {}; // Empty data for POST requests
            }
            
            const response = await axios(config);
            
            if (response.status === 404) {
                console.log(`   ❌ ${test.name}: Route not found (404)`);
                mappingWorking = false;
            } else if (response.status === 401) {
                console.log(`   ✅ ${test.name}: Route exists, requires auth (401)`);
            } else {
                console.log(`   ✅ ${test.name}: Route accessible (${response.status})`);
            }
        } catch (error) {
            console.log(`   ❌ ${test.name}: ${error.message}`);
            mappingWorking = false;
        }
    }
    results.endpointMappings = mappingWorking;

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSTIC SUMMARY:');
    console.log('='.repeat(70));
    
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(Boolean).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        const emoji = passed ? '✅' : '❌';
        const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        console.log(`   ${emoji} ${testName}`);
    });
    
    console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    
    if (passed === total) {
        console.log('🎉 All diagnostics passed! Server appears to be working correctly.');
    } else {
        console.log('⚠️ Some issues detected. Check the failed tests above.');
    }

    // Specific recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (!results.serverRunning) {
        console.log('   • Start the server: node server.js');
        console.log('   • Check if port 3000 is already in use: netstat -tlnp | grep 3000');
        console.log('   • Verify environment variables are set');
    }
    if (!results.databaseFiles) {
        console.log('   • Initialize database files: npm run setup');
        console.log('   • Check data directory permissions');
    }
    if (!results.logFiles) {
        console.log('   • Create logs directory: mkdir logs');
        console.log('   • Check file system permissions');
    }
    if (!results.endpointMappings) {
        console.log('   • Verify route mounting in server.js');
        console.log('   • Check for typos in route definitions');
        console.log('   • Ensure all route files exist and export correctly');
    }
    if (results.serverRunning && !results.healthCheck) {
        console.log('   • Server is running but health endpoint failed');
        console.log('   • Check server logs for startup errors');
        console.log('   • Verify all dependencies are installed');
    }

    return results;
}

// Test with browser flow simulation
async function testBrowserFlow() {
    console.log('\n🌐 BROWSER FLOW SIMULATION:');
    console.log('='.repeat(50));
    
    const pages = [
        { name: 'Login Page', url: '/login.html' },
        { name: 'Dashboard Page', url: '/dashboard.html' },
        { name: 'Credit Application Page', url: '/credit_application.html' }
    ];
    
    for (const page of pages) {
        try {
            const response = await axios.get(`${BASE_URL}${page.url}`, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            console.log(`✅ ${page.name} accessible (${response.status})`);
            
            // Check for critical elements in HTML
            const html = response.data;
            if (page.name === 'Credit Application Page') {
                if (html.includes('/api/credit-application/submit')) {
                    console.log(`   ⚠️ Uses OLD endpoint: /api/credit-application/submit`);
                }
                if (html.includes('/api/applications/submit')) {
                    console.log(`   ✅ Uses NEW endpoint: /api/applications/submit`);
                }
                if (html.includes('Authorization')) {
                    console.log(`   ✅ Includes authorization headers`);
                } else {
                    console.log(`   ⚠️ Missing authorization headers`);
                }
            }
            
        } catch (error) {
            console.log(`❌ ${page.name} failed: ${error.message}`);
        }
    }
}

// Test network connectivity
async function testNetworkConnectivity() {
    console.log('\n🌐 NETWORK CONNECTIVITY TEST:');
    console.log('='.repeat(40));
    
    const tests = [
        { name: 'Localhost', url: 'http://localhost:3000' },
        { name: '127.0.0.1', url: 'http://127.0.0.1:3000' }
    ];
    
    if (process.env.DOMAIN) {
        tests.push({ name: 'Domain', url: `http://${process.env.DOMAIN}:3000` });
    }
    
    for (const test of tests) {
        try {
            const response = await axios.get(`${test.url}/api/health`, { timeout: 3000 });
            console.log(`✅ ${test.name}: Accessible`);
        } catch (error) {
            console.log(`❌ ${test.name}: ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    try {
        const results = await runDiagnostics();
        await testBrowserFlow();
        await testNetworkConnectivity();
        
        console.log('\n🏁 Diagnostic complete!');
        console.log('💡 Run this again after making changes to verify fixes.');
        console.log(`📊 Timestamp: ${new Date().toISOString()}`);
        
        // Exit with error code if critical tests failed
        const criticalTests = ['serverRunning', 'healthCheck', 'databaseFiles'];
        const criticalPassed = criticalTests.every(test => results[test]);
        
        if (!criticalPassed) {
            console.log('\n❌ Critical tests failed. Server may not be functional.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('💥 Diagnostic failed:', error.message);
        process.exit(1);
    }
}

// Run diagnostics if called directly
if (require.main === module) {
    main();
}

module.exports = { runDiagnostics, testBrowserFlow, testNetworkConnectivity };
