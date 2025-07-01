// utils/logger.js - ENHANCED WINSTON LOGGER WITH COMPREHENSIVE DEBUGGING
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`📁 Created logs directory: ${logsDir}`);
}

// Enhanced custom log format with emojis and better structure
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Enhanced console format for development with emojis and colors
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
    }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, category, ...meta }) => {
        let emoji = '';
        switch(level) {
            case 'error': emoji = '💥'; break;
            case 'warn': emoji = '⚠️'; break;
            case 'info': emoji = '📘'; break;
            case 'debug': emoji = '🔧'; break;
            default: emoji = '📝'; break;
        }
        
        let categoryPrefix = '';
        if (category) {
            categoryPrefix = `[${category}] `;
        }
        
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = ' | ' + JSON.stringify(meta, null, 0);
        }
        
        return `[${timestamp}] ${emoji} ${level.toUpperCase()} ${categoryPrefix}${message}${metaStr}`;
    })
);

// Create the enhanced logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: logFormat,
    defaultMeta: { 
        service: 'pinnacle-portal',
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Enhanced error logging
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 15,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        }),

        // Enhanced combined logging
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 25,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Enhanced security logging
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'debug', // Capture all security events including debug
            maxsize: 10485760, // 10MB
            maxFiles: 50, // Keep many security logs
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    // Log all security/auth related events
                    if (info.security || info.auth || info.category === 'AUTH' || 
                        info.category === 'SECURITY' || info.level === 'warn' || info.level === 'error') {
                        return info;
                    }
                    return false;
                })()
            )
        }),

        // Enhanced application logic logging
        new winston.transports.File({
            filename: path.join(logsDir, 'application.log'),
            level: 'debug',
            maxsize: 10485760, // 10MB
            maxFiles: 15,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // New: Detailed debug logging for troubleshooting
        new winston.transports.File({
            filename: path.join(logsDir, 'debug.log'),
            level: 'debug',
            maxsize: 20971520, // 20MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.prettyPrint()
            )
        })
    ],
    exitOnError: false
});

// Enhanced console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Enhanced HTTP request logging
const httpLogger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10
        })
    ]
});

// Enhanced helper functions for structured logging
const logHelpers = {
    // Authentication and security events with detailed context
    logAuth: (event, details = {}) => {
        logger.info(`🔑 ${event}`, {
            category: 'AUTH',
            auth: true,
            security: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Security events (failed logins, suspicious activity) with enhanced details
    logSecurity: (event, details = {}) => {
        logger.warn(`🛡️ ${event}`, {
            category: 'SECURITY',
            security: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Business logic events with enhanced tracking
    logBusiness: (event, details = {}) => {
        logger.info(`💼 ${event}`, {
            category: 'BUSINESS',
            business: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Enhanced debug logging with categories
    logDebug: (category, event, details = {}) => {
        logger.debug(`🔧 DEBUG [${category}]: ${event}`, {
            category: `DEBUG_${category}`,
            debug: true,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Enhanced HTTP requests with full context
    logHttp: (method, url, statusCode, responseTime, details = {}) => {
        const emoji = statusCode >= 500 ? '💥' : statusCode >= 400 ? '⚠️' : statusCode >= 300 ? '🔄' : '✅';
        httpLogger.info(`${emoji} HTTP ${method} ${url} ${statusCode} ${responseTime}ms`, {
            category: 'HTTP',
            http: true,
            method,
            url,
            statusCode,
            responseTime,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Database operations with enhanced tracking
    logDatabase: (operation, details = {}) => {
        logger.debug(`🗄️ DATABASE [${operation}]`, {
            category: 'DATABASE',
            database: true,
            operation,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // External API calls with comprehensive logging
    logExternalAPI: (service, operation, details = {}) => {
        logger.info(`🌐 EXTERNAL_API [${service}] ${operation}`, {
            category: 'EXTERNAL_API',
            externalAPI: true,
            service,
            operation,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Email operations with privacy protection
    logEmail: (type, recipient, success, details = {}) => {
        const maskedRecipient = recipient ? recipient.replace(/(.{2}).*(@.*)/, '$1***$2') : 'unknown';
        logger.info(`📧 EMAIL [${type}] to ${maskedRecipient} - ${success ? 'SUCCESS' : 'FAILED'}`, {
            category: 'EMAIL',
            email: true,
            type,
            recipient: maskedRecipient,
            success,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Enhanced performance monitoring
    logPerformance: (operation, duration, details = {}) => {
        const emoji = duration > 10000 ? '🐌' : duration > 5000 ? '⏰' : duration > 2000 ? '⚡' : '🚀';
        const level = duration > 10000 ? 'error' : duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';
        
        logger[level](`${emoji} PERFORMANCE [${operation}] ${duration}ms`, {
            category: 'PERFORMANCE',
            performance: true,
            operation,
            duration,
            slow: duration > 2000,
            verySlow: duration > 5000,
            critical: duration > 10000,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Enhanced error logging with full context
    logError: (error, context = {}) => {
        logger.error(`💥 APPLICATION_ERROR: ${error.message}`, {
            category: 'ERROR',
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code
            },
            context,
            timestamp: new Date().toISOString()
        });
    },

    // Request lifecycle tracking
    logRequestStart: (req, requestId) => {
        logger.info(`🌐 INCOMING REQUEST`, {
            category: 'REQUEST_START',
            requestId,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });
    },

    logRequestEnd: (req, res, requestId, duration) => {
        const emoji = res.statusCode >= 500 ? '💥' : res.statusCode >= 400 ? '⚠️' : '✅';
        logger.info(`${emoji} REQUEST COMPLETE`, {
            category: 'REQUEST_END',
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id,
            dealerName: req.user?.dealerName,
            timestamp: new Date().toISOString()
        });
    }
};

// Enhanced middleware for HTTP request logging with request ID tracking
const httpLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    // Add request ID to request object for tracking throughout the request lifecycle
    req.requestId = requestId;
    
    // Log incoming request
    logHelpers.logRequestStart(req, requestId);
    
    // Override res.end to capture response time and details
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log the completed request
        logHelpers.logHttp(
            req.method,
            req.originalUrl,
            res.statusCode,
            responseTime,
            {
                requestId,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                userId: req.user ? req.user.id : null,
                dealerName: req.user ? req.user.dealerName : null,
                contentLength: res.get('content-length')
            }
        );
        
        logHelpers.logRequestEnd(req, res, requestId, responseTime);
        
        originalEnd.apply(this, args);
    };
    
    next();
};

// Stream for Morgan HTTP logging (if using Morgan)
const morganStream = {
    write: (message) => {
        httpLogger.info(message.trim(), { 
            category: 'MORGAN',
            morgan: true 
        });
    }
};

// Enhanced startup logging
logger.info('🚀 LOGGER INITIALIZED', {
    category: 'STARTUP',
    level: logger.level,
    transports: logger.transports.length,
    environment: process.env.NODE_ENV,
    logDirectory: logsDir,
    timestamp: new Date().toISOString()
});

// Export enhanced logger with all helpers
module.exports = {
    logger,
    httpLogger,
    httpLoggingMiddleware,
    morganStream,
    ...logHelpers
};
