// utils/logger.js - WINSTON LOGGER SETUP
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${level}] ${service || 'APP'}: ${message} ${metaStr}`;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { 
        service: 'pinnacle-portal',
        pid: process.pid
    },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        }),

        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 20,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Security and authentication specific logs
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 30, // Keep more security logs
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    // Only log security-related events
                    if (info.security || info.auth || info.level === 'warn' || info.level === 'error') {
                        return info;
                    }
                    return false;
                })()
            )
        }),

        // Application-specific logs
        new winston.transports.File({
            filename: path.join(logsDir, 'application.log'),
            level: 'debug',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    // Filter out HTTP requests and focus on business logic
                    if (info.http || info.request) {
                        return false;
                    }
                    return info;
                })()
            )
        })
    ],
    exitOnError: false
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// HTTP request logging transport
const httpLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Helper functions for structured logging
const logHelpers = {
    // Authentication and security events
    logAuth: (event, details) => {
        logger.info(event, {
            auth: true,
            security: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Security events (failed logins, suspicious activity)
    logSecurity: (event, details) => {
        logger.warn(event, {
            security: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Business logic events (applications, dealer actions)
    logBusiness: (event, details) => {
        logger.info(event, {
            business: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // HTTP requests
    logHttp: (method, url, statusCode, responseTime, details = {}) => {
        httpLogger.info('HTTP Request', {
            http: true,
            method,
            url,
            statusCode,
            responseTime,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Database operations
    logDatabase: (operation, details) => {
        logger.debug('Database Operation', {
            database: true,
            operation,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // External API calls (GHL, DealerTrack)
    logExternalAPI: (service, operation, details) => {
        logger.info('External API Call', {
            externalAPI: true,
            service,
            operation,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Email operations
    logEmail: (type, recipient, success, details = {}) => {
        logger.info('Email Operation', {
            email: true,
            type,
            recipient: recipient ? recipient.replace(/(.{2}).*(@.*)/, '$1***$2') : 'unknown', // Mask email
            success,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Performance monitoring
    logPerformance: (operation, duration, details = {}) => {
        const level = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';
        logger[level]('Performance Metric', {
            performance: true,
            operation,
            duration,
            slow: duration > 2000,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Error with context
    logError: (error, context = {}) => {
        logger.error('Application Error', {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            timestamp: new Date().toISOString()
        });
    }
};

// Middleware for HTTP request logging
const httpLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log the request
        logHelpers.logHttp(
            req.method,
            req.originalUrl,
            res.statusCode,
            responseTime,
            {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                userId: req.user ? req.user.id : null,
                dealerName: req.user ? req.user.dealerName : null
            }
        );
        
        originalEnd.apply(this, args);
    };
    
    next();
};

// Stream for Morgan HTTP logging (if using Morgan)
const morganStream = {
    write: (message) => {
        httpLogger.info(message.trim(), { morgan: true });
    }
};

// Log application startup
logger.info('Logger initialized', {
    level: logger.level,
    transports: logger.transports.length,
    environment: process.env.NODE_ENV,
    logDirectory: logsDir
});

module.exports = {
    logger,
    httpLogger,
    httpLoggingMiddleware,
    morganStream,
    ...logHelpers
};