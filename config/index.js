// config/index.js - UPDATED WITH LEAD ROUTER PRO SETTINGS
require('dotenv').config();

const requiredEnvVars = [
    'JWT_SECRET',
    'NODE_ENV',
    'PORT'
];

// Check for required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
}

const configValues = {
    // Basic server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 3000,
    
    // Security configuration
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    
    // CORS configuration
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
        [
            'http://localhost:3000', 
            'http://localhost:8080',
            'https://portal.pinnacleautofinance.com',
            'https://pinnacleautofinance.com'
        ],
 
    // Email configuration (Lead Router Pro + SMTP compatibility)
    FREE_2FA_EMAIL: process.env.FREE_2FA_EMAIL,
    FREE_2FA_PASSWORD: process.env.FREE_2FA_PASSWORD,
    SMTP_USERNAME: process.env.SMTP_USERNAME,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    EMAIL_TEST_MODE: process.env.EMAIL_TEST_MODE === 'true',
      
    // Two-factor authentication settings
    TWO_FACTOR_ENABLED: process.env.TWO_FACTOR_ENABLED === 'true',
    TWO_FACTOR_CODE_LENGTH: parseInt(process.env.TWO_FACTOR_CODE_LENGTH) || 6,
    TWO_FACTOR_CODE_EXPIRE_MINUTES: parseInt(process.env.TWO_FACTOR_CODE_EXPIRE_MINUTES) || 10,
    
    // GoHighLevel API configuration
    GHL_API_KEY: process.env.GHL_API_KEY,
    GHL_API_BASE_URL: process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com',
    GHL_API_VERSION: process.env.GHL_API_VERSION || '2021-07-28',
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID,
    
    // GHL Pipeline configuration
    GHL_DEALS_PIPELINE_ID: process.env.GHL_DEALS_PIPELINE_ID,
    GHL_DEALS_STAGE_NEW: process.env.GHL_DEALS_STAGE_NEW,
    GHL_DEALS_STAGE_PROCESSING: process.env.GHL_DEALS_STAGE_PROCESSING,
    GHL_DEALS_STAGE_APPROVED: process.env.GHL_DEALS_STAGE_APPROVED,
    GHL_DEALS_STAGE_DECLINED: process.env.GHL_DEALS_STAGE_DECLINED,
    GHL_DEALS_STAGE_FUNDED: process.env.GHL_DEALS_STAGE_FUNDED,
    
    // GHL V1 API for user management (from Lead Router Pro)
    GHL_AGENCY_API_KEY: process.env.GHL_AGENCY_API_KEY,
    GHL_COMPANY_ID: process.env.GHL_COMPANY_ID,
    GHL_PRIVATE_TOKEN: process.env.GHL_PRIVATE_TOKEN, // V2 API fallback
    
    // DealerTrack configuration
    DEALERTRACK_QUEUE_POLL_INTERVAL: parseInt(process.env.DEALERTRACK_QUEUE_POLL_INTERVAL) || 30000, // 30 seconds
    DEALERTRACK_MAX_RETRY_ATTEMPTS: parseInt(process.env.DEALERTRACK_MAX_RETRY_ATTEMPTS) || 3,
    DEALERTRACK_TIMEOUT: parseInt(process.env.DEALERTRACK_TIMEOUT) || 60000, // 60 seconds
    
    // Database configuration (for future PostgreSQL migration)
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL: process.env.DATABASE_SSL === 'true',
    
    // Redis configuration (for production caching)
    REDIS_URL: process.env.REDIS_URL,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    
    // Logging configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || 'logs/pinnacle-portal.log',
    
    // Security settings
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    
    // Session and token configuration
    SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 60,
    TOKEN_REFRESH_THRESHOLD_MINUTES: parseInt(process.env.TOKEN_REFRESH_THRESHOLD_MINUTES) || 15,
    
    // File upload configuration
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES ? 
        process.env.ALLOWED_FILE_TYPES.split(',').map(type => type.trim()) : 
        ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    
    // API Keys and secrets
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    
    // Webhook configuration
    GHL_WEBHOOK_SECRET: process.env.GHL_WEBHOOK_SECRET,
    DEALERTRACK_WEBHOOK_SECRET: process.env.DEALERTRACK_WEBHOOK_SECRET,
    
    // Monitoring and health checks
    HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 300000, // 5 minutes
    CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL) || 3600000, // 1 hour
      
    // Business logic configuration
    DEFAULT_SUBSCRIPTION_TIER: process.env.DEFAULT_SUBSCRIPTION_TIER || 'basic',
    PREMIUM_FEATURES_ENABLED: process.env.PREMIUM_FEATURES_ENABLED === 'true',
    BASIC_TIER_PRICE: parseInt(process.env.BASIC_TIER_PRICE) || 0, // FREE
    PREMIUM_TIER_PRICE: parseInt(process.env.PREMIUM_TIER_PRICE) || 297, // $297/month
    
    // External service timeouts
    GHL_API_TIMEOUT: parseInt(process.env.GHL_API_TIMEOUT) || 30000, // 30 seconds
    EMAIL_TIMEOUT: parseInt(process.env.EMAIL_TIMEOUT) || 10000, // 10 seconds
    
    // Development/Testing flags
    SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION === 'true',
    MOCK_DEALERTRACK: process.env.MOCK_DEALERTRACK === 'true',
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    
    // Data retention policies
    CONVERSATION_LOG_RETENTION_DAYS: parseInt(process.env.CONVERSATION_LOG_RETENTION_DAYS) || 365,
    AUDIT_LOG_RETENTION_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 2555, // 7 years
    APPLICATION_DATA_RETENTION_DAYS: parseInt(process.env.APPLICATION_DATA_RETENTION_DAYS) || 2555 // 7 years
};

// Validate critical configurations
const criticalValidations = [
    {
        condition: !configValues.FREE_2FA_EMAIL && !configValues.EMAIL_TEST_MODE,
        message: 'FREE_2FA_EMAIL is required when EMAIL_TEST_MODE is false'
    },
    {
        condition: !configValues.FREE_2FA_PASSWORD && !configValues.EMAIL_TEST_MODE,
        message: 'FREE_2FA_PASSWORD is required when EMAIL_TEST_MODE is false'
    },
    {
        condition: configValues.TWO_FACTOR_ENABLED && (!configValues.FREE_2FA_EMAIL && !configValues.EMAIL_TEST_MODE),
        message: '2FA requires email configuration or test mode'
    },
    {
        condition: configValues.JWT_SECRET && configValues.JWT_SECRET.length < 32,
        message: 'JWT_SECRET should be at least 32 characters long'
    }
];

const validationErrors = criticalValidations
    .filter(validation => validation.condition)
    .map(validation => validation.message);

if (validationErrors.length > 0) {
    console.error('❌ Configuration validation errors:');
    validationErrors.forEach(error => console.error(`  - ${error}`));
    
    if (configValues.NODE_ENV === 'production') {
        process.exit(1);
    } else {
        console.warn('⚠️  Running in development mode with configuration warnings');
    }
}

// Log configuration status (excluding sensitive values)
if (configValues.NODE_ENV === 'development' && configValues.DEBUG_MODE) {
    console.log('🔧 Configuration loaded:');
    console.log(`  - Environment: ${configValues.NODE_ENV}`);
    console.log(`  - Port: ${configValues.PORT}`);
    console.log(`  - Email Test Mode: ${configValues.EMAIL_TEST_MODE}`);
    console.log(`  - 2FA Enabled: ${configValues.TWO_FACTOR_ENABLED}`);
    console.log(`  - GHL API Key: ${configValues.GHL_API_KEY ? 'Set' : 'Not Set'}`);
    console.log(`  - GHL Location ID: ${configValues.GHL_LOCATION_ID ? 'Set' : 'Not Set'}`);
    console.log(`  - Database: ${configValues.DATABASE_URL ? 'Configured' : 'File-based'}`);
}

module.exports = configValues;
