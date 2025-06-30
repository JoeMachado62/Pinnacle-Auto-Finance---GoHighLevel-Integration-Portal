// /var/www/paf-ghl/server.js
process.stdout.write('[DEBUG] server.js execution started with process.stdout.write\\n');
console.log('[DEBUG] Starting server.js with console.log...');

const express = require('express');
console.log('[DEBUG] Express loaded.');
const cors = require('cors');
console.log('[DEBUG] CORS loaded.');

const helmet = require('helmet');
console.log('[DEBUG] Helmet loaded.');

const path = require('path');
console.log('[DEBUG] Path loaded.');

const config = require('./config');
console.log('[DEBUG] Config loaded from ./config.');

const logger = require('./utils/logger');
console.log('[DEBUG] Logger loaded from ./utils/logger.');

const applicationRoutes = require('./routes/applicationRoutes');
console.log('[DEBUG] applicationRoutes loaded from ./routes/applicationRoutes.');

const authRoutes = require('./routes/authRoutes');
console.log('[DEBUG] authRoutes loaded from ./routes/authRoutes.');

const dashboardRoutes = require('./routes/dashboardRoutes');
console.log('[DEBUG] dashboardRoutes loaded from ./routes/dashboardRoutes.');

// const dealertrackProxyRoutes = require('./routes/dealertrackProxyRoutes');
// console.log('[DEBUG] dealertrackProxyRoutes commented out but loaded if uncommented.');

const app = express();
console.log('[DEBUG] Express app initialized.');

// Security Middleware
app.use(helmet());

// CORS Middleware
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || config.ALLOWED_ORIGINS.includes(origin) || config.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logger.warn(`CORS: Blocked origin - ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-API-Key'], // Add X-Internal-API-Key
    credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight requests

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' })); // For JSON payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // For URL-encoded data

// Static Files (for credit_application.html and other assets)
// Serve files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Logging Middleware (simple request logger)
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
    res.on('finish', () => {
        logger.info(`${res.statusCode} ${res.statusMessage}; ${res.get('Content-Length') || 0}b sent`);
    });
    next();
});

// Basic Route for testing
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'PAF GHL Portal API is running.' });
});

// Root route - redirect to registration page for new users
app.get('/', (req, res) => {
    res.redirect('/register.html');
});

// API Routes
app.use('/api/credit-application', applicationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/dealertrack', dealertrackProxyRoutes); // For Local DT Agent (Phase 4)
console.log('[DEBUG] All middleware and routes configured.');

// Catch-all for 404 Not Found (API routes)
app.use('/api/*', (req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'API endpoint not found.' });
});

// Global Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
console.log('[DEBUG] Global error handler configured.');
    logger.error('Global Error Handler:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: err.message || 'An unexpected error occurred.',
        ...(config.NODE_ENV === 'development' && { stack: err.stack }), // Send stack trace in development
    });
});

// Start Server
const server = app.listen(config.PORT, '0.0.0.0', () => {
    // These will now use the Winston logger if it initialized correctly
    logger.info(`PAF GHL Portal Server started successfully - NOW REALLY LISTENING!`);
    logger.info(`Listening on port ${config.PORT}`);
console.log('[DEBUG] app.listen() callback executed. Server is listening.');
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Allowed origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
    logger.info(`GHL API Key Loaded: ${config.GHL_API_KEY ? 'Yes' : 'NO (CRITICAL ERROR!)'}`);
    logger.info(`GHL Location ID Loaded: ${config.GHL_LOCATION_ID || 'NO (CRITICAL ERROR!)'}`);
    logger.info(`GHL Deals Pipeline ID Loaded: ${config.GHL_DEALS_PIPELINE_ID || 'NO (CRITICAL ERROR!)'}`);
});
console.log('[DEBUG] app.listen() called. Waiting for server to start or error...');

server.on('error', (error) => {
    logger.error('Server failed to start:', error);
});

// Handle Unhandled Rejections and Uncaught Exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason.stack || reason });
    // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { message: error.message, stack: error.stack });
    // Graceful shutdown logic might be needed here for production
    process.exit(1);
});
