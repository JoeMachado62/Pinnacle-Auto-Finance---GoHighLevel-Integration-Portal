// server.js - REFACTORED PINNACLE AUTO FINANCE PORTAL WITH COMPREHENSIVE LOGGING
// Version 2.0 - Complete authentication and security overhaul with enhanced debugging

// FORCE CONSOLE LOGGING - Add this at the very top
const originalLog = console.log;
console.log = function(...args) {
    originalLog(new Date().toISOString(), '|', ...args);
};

console.log('🔥 FORCED LOGGING ENABLED - SERVER STARTING');
console.log('📍 Working directory:', process.cwd());
console.log('🔧 Node version:', process.version);
console.log('🔧 Command line:', process.argv.join(' '));

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

console.log('✅ All core modules imported successfully');

// Load environment variables first
require('dotenv').config();
console.log('✅ Environment variables loaded');

// Initialize configuration and logger
const config = require('./config');
console.log('✅ Configuration loaded');

const { logger, httpLoggingMiddleware, logBusiness, logSecurity, logDebug } = require('./utils/logger');
console.log('✅ Logger initialized');

// Services
console.log('📦 Loading services...');
const db = require('./services/databaseService');
console.log('✅ Database service loaded');
const emailService = require('./services/emailService');
console.log('✅ Email service loaded');

// Routes
console.log('📡 Loading routes...');
const applicationRoutes = require('./routes/applicationRoutes');
console.log('✅ Application routes loaded');
const authRoutes = require('./routes/authRoutes');
console.log('✅ Auth routes loaded');
const dashboardRoutes = require('./routes/dashboardRoutes');
console.log('✅ Dashboard routes loaded');

// Initialize Express app
console.log('🏗️ Initializing Express app...');
const app = express();
console.log('✅ Express app initialized');

// Log startup information
logger.info('🎯 SERVER STARTUP INITIATED', {
    category: 'STARTUP',
    workingDirectory: process.cwd(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV,
    port: process.env.PORT || config.PORT
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);
logDebug('EXPRESS', 'Trust proxy configured');

// ===== SECURITY MIDDLEWARE =====
logDebug('MIDDLEWARE', 'Setting up security middleware...');

// Helmet for security headers
logDebug('SECURITY', 'Configuring Helmet security headers');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
logDebug('SECURITY', '✅ Helmet configured successfully');

// Rate limiting
logDebug('SECURITY', 'Setting up rate limiting...');
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS, // 15 minutes
    max: config.RATE_LIMIT_MAX_REQUESTS, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logSecurity('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method
        });
        res.status(429).json({
            success: false,
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
        });
    }
});
logDebug('SECURITY', '✅ Rate limiter configured successfully');

// Apply rate limiting to API routes, but exclude authenticated dashboard routes
logDebug('SECURITY', 'Applying rate limiting to API routes...');
app.use('/api', (req, res, next) => {
    logDebug('RATE_LIMIT', `Checking rate limit for ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        path: req.path
    });
    // Skip rate limiting for authenticated dashboard routes
    if (req.path.startsWith('/dashboard') || req.path.startsWith('/auth/profile')) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // If user is authenticated, skip rate limiting for dashboard routes
            return next();
        }
    }
    limiter(req, res, next);
});

// Stricter rate limiting for auth endpoints
logDebug('SECURITY', 'Setting up stricter rate limiting for auth endpoints...');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 auth requests per windowMs
    skipSuccessfulRequests: true
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-2fa', authLimiter);
logDebug('SECURITY', '✅ Auth rate limiters applied');

// ===== CORS CONFIGURATION =====
logDebug('SECURITY', 'Configuring CORS...');
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (config.ALLOWED_ORIGINS.includes(origin) || config.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logSecurity('CORS: Blocked origin', { origin: origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-API-Key'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
logDebug('SECURITY', '✅ CORS configured successfully');

// ===== BODY PARSING MIDDLEWARE =====
logDebug('MIDDLEWARE', 'Setting up body parsing middleware...');
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook signature verification
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
logDebug('MIDDLEWARE', '✅ Body parsing middleware configured');

// ===== LOGGING MIDDLEWARE =====
logDebug('MIDDLEWARE', 'Setting up HTTP logging middleware...');
app.use(httpLoggingMiddleware);
logDebug('MIDDLEWARE', '✅ HTTP logging middleware configured');

// ===== STATIC FILES =====
logDebug('STATIC_FILES', 'Configuring static file serving...');
const staticPath = path.join(__dirname, 'public');
logDebug('STATIC_FILES', `Static files directory: ${staticPath}`);

app.use(express.static(staticPath, {
    maxAge: config.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
}));

// Serve uploaded files (profile pictures, documents, etc.)
const uploadsPath = path.join(__dirname, 'uploads');
logDebug('STATIC_FILES', `Uploads directory: ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath, {
    maxAge: config.NODE_ENV === 'production' ? '7d' : '0',
    etag: true,
    lastModified: true
}));

// Add middleware to log static file requests
app.use((req, res, next) => {
    if (req.url.includes('.html') || req.url.includes('.css') || req.url.includes('.js')) {
        logDebug('STATIC_FILES', `Serving static file: ${req.url}`, {
            method: req.method,
            path: req.url,
            ip: req.ip
        });
    }
    next();
});

logDebug('STATIC_FILES', '✅ Static file serving configured');

// ===== API HEALTH CHECK =====
logDebug('ROUTES', 'Setting up health check endpoint...');
app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: config.NODE_ENV,
            services: {
                database: 'healthy',
                email: await emailService.testConnection() ? 'healthy' : 'degraded',
                auth: 'healthy'
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            features: {
                twoFactorAuth: config.TWO_FACTOR_ENABLED,
                emailMode: config.EMAIL_TEST_MODE ? 'test' : 'production',
                ghlIntegration: !!config.GHL_API_KEY,
                premiumFeatures: config.PREMIUM_FEATURES_ENABLED
            }
        };

        // Add database statistics
        try {
            const dbStats = await db.getDatabaseStats();
            health.database = dbStats;
        } catch (dbError) {
            health.services.database = 'degraded';
            logger.warn('Database health check failed:', dbError);
        }

        res.json(health);
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== ROOT ROUTE =====
logDebug('ROUTES', 'Setting up root route...');
app.get('/', (req, res) => {
    logDebug('ROOT_ROUTE', 'Root route accessed', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    // Always redirect to dashboard - let the dashboard's JavaScript handle auth checking
    // This prevents the redirect loop when users navigate to "/" after successful login
    logDebug('ROOT_ROUTE', 'Redirecting to dashboard for client-side auth check');
    res.redirect('/dashboard.html');
});

// ===== API ROUTES =====
logDebug('ROUTES', 'Mounting API routes...');
logDebug('ROUTES', 'Mounting /api/auth routes...');
app.use('/api/auth', authRoutes);
logDebug('ROUTES', '✅ Auth routes mounted');

logDebug('ROUTES', 'Mounting /api/applications routes...');
app.use('/api/applications', applicationRoutes); // Fix: Mount at /api/applications
logDebug('ROUTES', '✅ Application routes mounted');

logDebug('ROUTES', 'Mounting /api/dashboard routes...');
app.use('/api/dashboard', dashboardRoutes);
logDebug('ROUTES', '✅ Dashboard routes mounted');

// Also mount legacy route for backward compatibility
logDebug('ROUTES', 'Mounting legacy /api/credit-application routes...');
app.use('/api/credit-application', applicationRoutes);
logDebug('ROUTES', '✅ Legacy application routes mounted');

// ===== WEBHOOK ENDPOINTS (for future DealerTrack integration) =====
app.post('/api/webhooks/dealertrack', express.raw({ type: 'application/json' }), (req, res) => {
    // TODO: Implement DealerTrack webhook handling
    logger.info('DealerTrack webhook received', {
        headers: req.headers,
        bodyLength: req.body ? req.body.length : 0
    });
    
    res.status(200).json({ received: true });
});

app.post('/api/webhooks/ghl', express.raw({ type: 'application/json' }), (req, res) => {
    // TODO: Implement GHL webhook handling
    logger.info('GHL webhook received', {
        headers: req.headers,
        bodyLength: req.body ? req.body.length : 0
    });
    
    res.status(200).json({ received: true });
});

// ===== API 404 HANDLER =====
app.use('/api/*', (req, res) => {
    logSecurity('API endpoint not found', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    res.status(404).json({ 
        success: false,
        message: 'API endpoint not found',
        path: req.path
    });
});

// ===== CATCH-ALL FOR SPA ROUTING =====
// This is a fallback for any route that doesn't match an API endpoint or a static file.
// It's useful for single-page applications, but in our case, we want to serve specific HTML files.
app.get('*', (req, res) => {
    const requestedPath = req.path;

    // Define a list of valid HTML pages
    const validPages = [
        '/login.html',
        '/dashboard.html',
        '/credit_application.html',
        '/deal-jacket.html',
        '/register.html'
    ];

    // If the requested path is a valid page, serve it
    if (validPages.includes(requestedPath)) {
        res.sendFile(path.join(__dirname, 'public', requestedPath));
    } 
    // If the path looks like a file but wasn't found by express.static, return 404
    else if (requestedPath.includes('.')) {
        res.status(404).json({ success: false, message: 'File not found' });
    } 
    // For any other route, redirect to the login page
    else {
        res.redirect('/login.html');
    }
});

// ===== GLOBAL ERROR HANDLER =====
app.use((err, req, res, next) => {
    // Log the error
    logger.error('Global error handler:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        body: req.body,
        headers: req.headers
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;
    
    // Security: Don't leak sensitive error information in production
    const errorResponse = {
        success: false,
        message: statusCode >= 500 ? 'Internal server error' : err.message,
        timestamp: new Date().toISOString()
    };

    // Include stack trace in development
    if (config.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.details = err;
    }

    res.status(statusCode).json(errorResponse);
});

// ===== DATABASE CLEANUP SCHEDULER =====
if (config.NODE_ENV === 'production') {
    const cron = require('node-cron');
    
    // Clean up expired 2FA codes every hour
    cron.schedule('0 * * * *', async () => {
        try {
            await db.cleanup();
            logger.info('Scheduled database cleanup completed');
        } catch (error) {
            logger.error('Scheduled database cleanup failed:', error);
        }
    });
    
    // Generate daily statistics
    cron.schedule('0 6 * * *', async () => {
        try {
            const stats = await db.getDatabaseStats();
            logBusiness('Daily statistics', stats);
        } catch (error) {
            logger.error('Daily statistics generation failed:', error);
        }
    });
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    
    server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections, cleanup, etc.
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Starting graceful shutdown...');
    
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

// ===== UNCAUGHT EXCEPTION HANDLERS =====
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
        reason: reason,
        promise: promise,
        stack: reason instanceof Error ? reason.stack : undefined
    });
    
    // In production, you might want to restart the process
    if (config.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack
    });
    
    // Attempt graceful shutdown
    process.exit(1);
});

// ===== START SERVER =====
logDebug('SERVER', 'Starting server...');
const server = app.listen(config.PORT, '0.0.0.0', async () => {
    logger.info('🎉 SERVER SUCCESSFULLY STARTED', {
        category: 'STARTUP',
        port: config.PORT,
        host: '0.0.0.0',
        environment: config.NODE_ENV
    });
    
    // Initialize services
    try {
        logDebug('SERVICES', 'Initializing services...');
        
        // Test database connection
        logDebug('DATABASE', 'Testing database connection...');
        await db.getDatabaseStats();
        logger.info('✅ Database service initialized');
        
        // Test email service
        logDebug('EMAIL', 'Testing email service connection...');
        const emailHealthy = await emailService.testConnection();
        logger.info(`✅ Email service initialized (${config.EMAIL_TEST_MODE ? 'TEST MODE' : 'PRODUCTION'})`);
        
        // Log startup information
        logBusiness('Server started', {
            port: config.PORT,
            environment: config.NODE_ENV,
            version: '2.0.0',
            features: {
                twoFactorAuth: config.TWO_FACTOR_ENABLED,
                emailMode: config.EMAIL_TEST_MODE ? 'test' : 'production',
                ghlIntegration: !!config.GHL_API_KEY,
                premiumFeatures: config.PREMIUM_FEATURES_ENABLED
            },
            pid: process.pid,
            nodeVersion: process.version
        });
        
        console.log('🚀 Pinnacle Auto Finance Portal Server Started');
        console.log(`📍 Listening on port ${config.PORT}`);
        console.log(`🌍 Environment: ${config.NODE_ENV}`);
        console.log(`🔐 2FA Enabled: ${config.TWO_FACTOR_ENABLED}`);
        console.log(`📧 Email Mode: ${config.EMAIL_TEST_MODE ? 'TEST' : 'PRODUCTION'}`);
        console.log(`🔗 GHL Integration: ${config.GHL_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
        console.log(`💼 Premium Features: ${config.PREMIUM_FEATURES_ENABLED ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📊 Allowed Origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
        
        if (config.NODE_ENV === 'development') {
            console.log('\n🧪 Development URLs:');
            console.log(`   Login: http://localhost:${config.PORT}/login.html`);
            console.log(`   Register: http://localhost:${config.PORT}/register.html`);
            console.log(`   Dashboard: http://localhost:${config.PORT}/dashboard.html`);
            console.log(`   Health Check: http://localhost:${config.PORT}/api/health`);
            console.log(`   Test Auth: npm run test:auth`);
        }
        
    } catch (error) {
        logger.error('Server startup error:', error);
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
});

server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof config.PORT === 'string'
        ? 'Pipe ' + config.PORT
        : 'Port ' + config.PORT;

    switch (error.code) {
        case 'EACCES':
            console.error(`❌ ${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`❌ ${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

module.exports = app;
