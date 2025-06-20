// /var/www/paf-ghl/config/index.js
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const configValues = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'], // Default for dev

    GHL_API_BASE_URL: process.env.GHL_API_BASE_URL,
    GHL_API_KEY: process.env.GHL_API_KEY,
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
    GHL_API_VERSION: '2021-07-28', // Standard V2 version

    GHL_DEALS_PIPELINE_ID: process.env.GHL_DEALS_PIPELINE_ID,
    GHL_DEALS_STAGE_NEW_DEAL_SUBMITTED: process.env.GHL_DEALS_STAGE_NEW_DEAL_SUBMITTED,
    // Add other stage IDs here as you define them in .env
    // GHL_DEALS_STAGE_CONDITIONAL_APPROVAL: process.env.GHL_DEALS_STAGE_CONDITIONAL_APPROVAL,
    // ... etc.

    API_SECRET_KEY: process.env.API_SECRET_KEY, // For Local DT Agent auth
    JWT_SECRET: process.env.JWT_SECRET, // For dealer authentication

    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENCRYPTION_IV_KEY: process.env.ENCRYPTION_IV_KEY,

    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || path.resolve(__dirname, '..', 'logs', 'app.log'),

    ENABLE_WEBHOOK_VALIDATION: process.env.ENABLE_WEBHOOK_VALIDATION === 'true',
    ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING === 'true',
};

module.exports = configValues;
