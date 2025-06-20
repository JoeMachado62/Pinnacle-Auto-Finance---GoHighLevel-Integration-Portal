// /var/www/paf-ghl/utils/logger.js
console.log('[DEBUG] Entering utils/logger.js'); // ADD THIS
const winston = require('winston');
const path = require('path');
// Temporarily use direct process.env here for early debug, or ensure config is loaded first if it's complex
const LOG_LEVEL_FROM_ENV = process.env.LOG_LEVEL || 'info';
const LOG_FILE_PATH_FROM_ENV = process.env.LOG_FILE_PATH || path.resolve(__dirname, '..', 'logs', 'app.log');
const NODE_ENV_FROM_ENV = process.env.NODE_ENV || 'development';

const logDir = path.dirname(LOG_FILE_PATH_FROM_ENV);

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log stack traces
    winston.format.splat(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: LOG_LEVEL_FROM_ENV,
    format: logFormat,
    defaultMeta: { service: 'paf-ghl-portal-logger' }, // Changed service name slightly for this debug
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'), // Ensure logDir is defined based on LOG_FILE_PATH_FROM_ENV
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }),
        new winston.transports.File({
            filename: LOG_FILE_PATH_FROM_ENV, // Use the env var
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
    ],
    rejectionHandlers: [
        new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
    ]
});

// If not in production, also log to the console with a simpler format
if (NODE_ENV_FROM_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

console.log('[DEBUG] Exiting utils/logger.js - Logger created.'); // ADD THIS
module.exports = logger;
