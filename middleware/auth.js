// /var/www/paf-ghl/middleware/auth.js
console.log('[DEBUG] Entering middleware/auth.js');
const authService = require('../services/authService');
console.log('[DEBUG] middleware/auth.js: authService loaded.');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                message: 'Access token required',
                error: 'MISSING_TOKEN'
            });
        }

        const decoded = authService.verifyToken(token);
        
        // Get full user data
        const user = await authService.getUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                message: 'Invalid token - user not found',
                error: 'INVALID_USER'
            });
        }

        // Add user info to request object
        req.user = user;
        req.dealerIdentifier = {
            dealerLicenseNumber: user.dealerLicenseNumber,
            finNumber: user.finNumber
        };

        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(403).json({ 
            message: 'Invalid or expired token',
            error: 'INVALID_TOKEN'
        });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = authService.verifyToken(token);
            const user = await authService.getUserById(decoded.userId);
            
            if (user) {
                req.user = user;
                req.dealerIdentifier = {
                    dealerLicenseNumber: user.dealerLicenseNumber,
                    finNumber: user.finNumber
                };
            }
        }

        next();
    } catch (error) {
        // For optional auth, we don't fail on invalid tokens
        logger.debug('Optional auth failed, continuing without user:', error.message);
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth
};
console.log('[DEBUG] Exiting middleware/auth.js - Middleware functions exported.');
