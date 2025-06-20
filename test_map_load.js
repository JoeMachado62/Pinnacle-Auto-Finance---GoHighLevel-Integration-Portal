// /var/www/paf-ghl/test_map_load.js
const path = require('path');
// Simulate how config/index.js loads .env for LOG_LEVEL
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const LOG_LEVEL_FROM_ENV = process.env.LOG_LEVEL || 'info';

// Simplified logger for this test
const testLogger = {
    info: (message, ...args) => console.log(`INFO: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`WARN: ${message}`, ...args),
    error: (message, ...args) => console.error(`ERROR: ${message}`, ...args),
    debug: (message, ...args) => { if (LOG_LEVEL_FROM_ENV === 'debug') console.log(`DEBUG: ${message}`, ...args); }
};

testLogger.info('Starting ghlCustomFieldMap.json load test...');
const processedFieldMapTest = {};
let criticalError = false;

try {
    const rawFieldDataArray = require('./config/ghlCustomFieldMap.json'); // Path relative to test_map_load.js if in root
    
    if (Array.isArray(rawFieldDataArray)) {
        rawFieldDataArray.forEach(fieldObject => {
            let lookupKey = null;
            if (fieldObject && typeof fieldObject.fieldKey === 'string' && fieldObject.fieldKey.startsWith('contact.')) {
                lookupKey = fieldObject.fieldKey.substring('contact.'.length);
            } else if (fieldObject && typeof fieldObject.fieldName === 'string') {
                lookupKey = fieldObject.fieldName.trim().toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_');
            }

            if (lookupKey && typeof fieldObject.fieldId === 'string' && fieldObject.fieldId) {
                if (processedFieldMapTest[lookupKey]) {
                    testLogger.warn(`Duplicate lookupKey: '${lookupKey}'. fieldId ${fieldObject.fieldId} (from fieldName: "${fieldObject.fieldName}", fieldKey: "${fieldObject.fieldKey}")`);
                }
                processedFieldMapTest[lookupKey] = fieldObject.fieldId;
            } else {
                testLogger.debug('Skipping field object (missing lookupKey or fieldId):', fieldObject);
            }
        });
        testLogger.info(`Successfully processed. Map size: ${Object.keys(processedFieldMapTest).length}`);
        if (Object.keys(processedFieldMapTest).length === 0 && rawFieldDataArray.length > 0) {
            testLogger.warn('Processed map is empty. Check key generation or JSON content.');
        }
        // testLogger.debug('Processed Map:', processedFieldMapTest); // Uncomment to see the map
    } else {
        testLogger.error('CRITICAL: ghlCustomFieldMap.json is not an array or could not be loaded.');
        criticalError = true;
    }
} catch (error) {
    testLogger.error('CRITICAL: Failed to load or process ghlCustomFieldMap.json.', {
        message: error.message,
        stack: error.stack,
    });
    criticalError = true;
}

if (criticalError) {
    testLogger.error("Test failed due to critical error loading/processing the map.");
} else {
    testLogger.info("Test completed. If map size is > 0 and no critical errors, JSON and processing logic seems okay.");
}