// middleware/auth.js - UPDATED FOR NEW AUTHENTICATION SYSTEM
const authService = require('../services/authService');
const { logger } = require('../utils/logger');
const config = require('../config');

const authenticateToken = async (req, res, next) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
        // Enhanced logging for debugging loops
        logger.info('AUTH_REQUEST_START', {
            requestId,
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            logger.warn('AUTH_MISSING_TOKEN', {
                requestId,
                path: req.path,
                ip: req.ip
            });
            return res.status(401).json({ 
                success: false,
                message: 'Access token required',
                error: 'MISSING_TOKEN'
            });
        }

        logger.info('AUTH_TOKEN_PRESENT', {
            requestId,
            path: req.path,
            tokenLength: token.length
        });

        // Verify and decode token
        const decoded = authService.verifyToken(token);
        
        logger.info('AUTH_TOKEN_DECODED', {
            requestId,
            userId: decoded.userId,
            path: req.path
        });
        
        // Get full dealer data from database
        const dealer = await authService.getDealerById(decoded.userId);
        if (!dealer) {
            logger.warn('AUTH_USER_NOT_FOUND', {
                requestId,
                userId: decoded.userId,
                path: req.path
            });
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token - dealer not found',
                error: 'INVALID_USER'
            });
        }

        // Check if dealer account is still active
        if (dealer.status !== 'active') {
            logger.warn('AUTH_ACCOUNT_DISABLED', {
                requestId,
                userId: dealer.id,
                dealerEmail: dealer.email,
                status: dealer.status
            });
            return res.status(401).json({
                success: false,
                message: 'Account is disabled',
                error: 'ACCOUNT_DISABLED'
            });
        }

        // Check if account is locked
        if (dealer.accountLockedUntil && new Date(dealer.accountLockedUntil) > new Date()) {
            const lockTimeRemaining = Math.ceil((new Date(dealer.accountLockedUntil) - new Date()) / (1000 * 60));
            logger.warn('AUTH_ACCOUNT_LOCKED', {
                requestId,
                userId: dealer.id,
                dealerEmail: dealer.email,
                lockTimeRemaining
            });
            return res.status(423).json({
                success: false,
                message: `Account locked. Try again in ${lockTimeRemaining} minutes.`,
                error: 'ACCOUNT_LOCKED'
            });
        }

        // Add dealer info to request object
        req.user = dealer;
        
        // Add dealer identifiers for backward compatibility
        req.dealerIdentifier = {
            dealerLicenseNumber: dealer.dealerLicenseNumber,
            finNumber: dealer.finNumber
        };

        // Add subscription tier info for feature gating
        req.subscriptionTier = dealer.subscriptionTier;
        req.isPremium = dealer.subscriptionTier === 'premium';

        const duration = Date.now() - startTime;
        logger.info('AUTH_SUCCESS', {
            requestId,
            userId: dealer.id,
            dealerEmail: dealer.email,
            path: req.path,
            duration: `${duration}ms`
        });

        next();
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('AUTH_ERROR', {
            requestId,
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            duration: `${duration}ms`
        });

        // Handle specific JWT errors
        if (error.message === 'Token has expired') {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired. Please login again.',
                error: 'TOKEN_EXPIRED'
            });
        } else if (error.message === 'Invalid token') {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid token format',
                error: 'INVALID_TOKEN_FORMAT'
            });
        } else {
            return res.status(403).json({ 
                success: false,
                message: 'Token verification failed',
                error: 'TOKEN_VERIFICATION_FAILED'
            });
        }
    }
};

// Middleware for premium dealers only
const authenticatePremiumDealer = async (req, res, next) => {
    // First run standard authentication
    await authenticateToken(req, res, (err) => {
        if (err) return next(err);
        
        // Check if dealer has premium subscription
        if (req.user.subscriptionTier !== 'premium') {
            logger.warn(`Premium access denied for dealer: ${req.user.email}`);
            return res.status(403).json({
                success: false,
                message: 'Premium subscription required for this feature',
                error: 'PREMIUM_REQUIRED',
                currentTier: req.user.subscriptionTier,
                upgradeUrl: '/api/auth/upgrade-subscription'
            });
        }
        
        // Check if GHL integration is enabled for premium features
        if (!req.user.ghlIntegrationEnabled && config.PREMIUM_FEATURES_ENABLED) {
            logger.warn(`GHL integration required for dealer: ${req.user.email}`);
            return res.status(403).json({
                success: false,
                message: 'GoHighLevel integration setup required',
                error: 'GHL_INTEGRATION_REQUIRED'
            });
        }
        
        next();
    });
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = authService.verifyToken(token);
            const dealer = await authService.getDealerById(decoded.userId);
            
            if (dealer && dealer.status === 'active') {
                req.user = dealer;
                req.dealerIdentifier = {
                    dealerLicenseNumber: dealer.dealerLicenseNumber,
                    finNumber: dealer.finNumber
                };
                req.subscriptionTier = dealer.subscriptionTier;
                req.isPremium = dealer.subscriptionTier === 'premium';
            }
        }

        next();
    } catch (error) {
        // For optional auth, we don't fail on invalid tokens
        logger.debug('Optional auth failed, continuing without user:', error.message);
        next();
    }
};

// Middleware to check if user has specific permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'AUTH_REQUIRED'
            });
        }

        // Define permissions based on subscription tier
        const permissions = {
            basic: [
                'view_own_applications',
                'submit_applications',
                'view_own_dashboard',
                'manage_own_profile',
                'add_conversation_notes'
            ],
            premium: [
                'view_own_applications',
                'submit_applications',
                'view_own_dashboard',
                'manage_own_profile',
                'add_conversation_notes',
                'access_ghl_portal',
                'trigger_ghl_workflows',
                'view_marketing_contacts',
                'advanced_reporting',
                'marketing_tools'
            ]
        };

        const userPermissions = permissions[req.user.subscriptionTier] || permissions.basic;

        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: `Permission denied: ${permission}`,
                error: 'INSUFFICIENT_PERMISSIONS',
                requiredPermission: permission,
                userTier: req.user.subscriptionTier
            });
        }

        next();
    };
};

// Rate limiting middleware for sensitive endpoints
const rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();

    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get existing attempts for this IP
        const ipAttempts = attempts.get(clientIP) || [];
        
        // Filter out attempts outside the window
        const recentAttempts = ipAttempts.filter(timestamp => timestamp > windowStart);

        if (recentAttempts.length >= maxAttempts) {
            logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
            return res.status(429).json({
                success: false,
                message: 'Too many attempts. Please try again later.',
                error: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        // Add current attempt
        recentAttempts.push(now);
        attempts.set(clientIP, recentAttempts);

        // Clean up old entries periodically
        if (Math.random() < 0.01) { // 1% chance
            for (const [ip, timestamps] of attempts.entries()) {
                const validTimestamps = timestamps.filter(ts => ts > windowStart);
                if (validTimestamps.length === 0) {
                    attempts.delete(ip);
                } else {
                    attempts.set(ip, validTimestamps);
                }
            }
        }

        next();
    };
};

// Middleware to log security events
const logSecurityEvent = (eventType) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Log the security event
            logger.info(`Security Event: ${eventType}`, {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                dealerId: req.user ? req.user.id : null,
                dealerEmail: req.user ? req.user.email : null,
                success: res.statusCode < 400,
                statusCode: res.statusCode,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            });

            originalSend.call(this, data);
        };

        next();
    };
};

// Admin authentication (for future admin features)
const authenticateAdmin = async (req, res, next) => {
    await authenticateToken(req, res, (err) => {
        if (err) return next(err);
        
        // Check if user has admin role (future enhancement)
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required',
                error: 'ADMIN_REQUIRED'
            });
        }
        
        next();
    });
};

module.exports = {
    authenticateToken,
    authenticatePremiumDealer,
    optionalAuth,
    requirePermission,
    rateLimitAuth,
    logSecurityEvent,
    authenticateAdmin
};
