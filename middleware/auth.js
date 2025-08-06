// middleware/auth.js - UPDATED FOR NEW AUTHENTICATION SYSTEM WITH COMPREHENSIVE LOGGING
const authService = require('../services/authService');
const { logger, logAuth, logSecurity, logDebug } = require('../utils/logger');
const config = require('../config');

const authenticateToken = async (req, res, next) => {
    const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
        logDebug('AUTH', `🔑 Authentication request started [${requestId}]`, {
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        const authHeader = req.headers['authorization'];
        logDebug('AUTH', `🔍 Checking auth header [${requestId}]`, {
            hasAuthHeader: !!authHeader,
            authHeaderType: authHeader ? authHeader.split(' ')[0] : 'none'
        });

        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            logSecurity('🚫 Missing authentication token', {
                requestId,
                path: req.path,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({ 
                success: false,
                message: 'Access token required',
                error: 'MISSING_TOKEN'
            });
        }

        logDebug('AUTH', `✅ Token present [${requestId}]`, {
            tokenLength: token.length,
            tokenStart: token.substring(0, 10) + '...'
        });

        // Verify and decode token
        logDebug('AUTH', `🔐 Verifying token [${requestId}]`);
        const decoded = authService.verifyToken(token);
        
        logDebug('AUTH', `✅ Token decoded successfully [${requestId}]`, {
            userId: decoded.userId,
            tokenExp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'no-exp'
        });
        
        // Get full dealer data from database
        logDebug('AUTH', `👤 Fetching dealer data [${requestId}]`, {
            userId: decoded.userId
        });
        
        const dealer = await authService.getDealerById(decoded.userId);
        if (!dealer) {
            logSecurity('🚫 Dealer not found in database', {
                requestId,
                userId: decoded.userId,
                path: req.path,
                ip: req.ip
            });
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token - dealer not found',
                error: 'INVALID_USER'
            });
        }

        logDebug('AUTH', `✅ Dealer found [${requestId}]`, {
            dealerId: dealer.id,
            dealerName: dealer.dealerName,
            email: dealer.email,
            status: dealer.status,
            tier: dealer.subscriptionTier
        });

        // Check if dealer account is still active
        if (dealer.status !== 'active') {
            logSecurity('🚫 Account is disabled', {
                requestId,
                userId: dealer.id,
                dealerEmail: dealer.email,
                status: dealer.status,
                ip: req.ip
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
            logSecurity('🔒 Account is locked', {
                requestId,
                userId: dealer.id,
                dealerEmail: dealer.email,
                lockTimeRemaining,
                lockUntil: dealer.accountLockedUntil,
                ip: req.ip
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
        
        logAuth('✅ Authentication successful', {
            requestId,
            userId: dealer.id,
            dealerName: dealer.dealerName,
            dealerEmail: dealer.email,
            subscriptionTier: dealer.subscriptionTier,
            path: req.path,
            method: req.method,
            duration: `${duration}ms`,
            ip: req.ip
        });

        logDebug('AUTH', `🎯 Request authenticated successfully [${requestId}]`, {
            dealer: {
                id: dealer.id,
                name: dealer.dealerName,
                tier: dealer.subscriptionTier,
                lastLogin: dealer.lastLogin
            },
            request: {
                path: req.path,
                method: req.method
            },
            duration: `${duration}ms`
        });

        next();
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logSecurity('💥 Authentication failed', {
            requestId,
            error: error.message,
            errorType: error.name,
            stack: error.stack,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            duration: `${duration}ms`
        });

        logDebug('AUTH', `❌ Authentication error [${requestId}]`, {
            errorMessage: error.message,
            errorName: error.name,
            tokenPresent: !!req.headers['authorization'],
            path: req.path
        });

        // Handle specific JWT errors
        if (error.message === 'Token has expired' || error.message.includes('expired')) {
            return res.status(401).json({ 
                success: false,
                message: 'Token has expired. Please login again.',
                error: 'TOKEN_EXPIRED',
                requestId
            });
        } else if (error.message === 'Invalid token' || error.message.includes('invalid')) {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid token format',
                error: 'INVALID_TOKEN_FORMAT',
                requestId
            });
        } else if (error.message.includes('jwt')) {
            return res.status(403).json({ 
                success: false,
                message: 'Token verification failed',
                error: 'TOKEN_VERIFICATION_FAILED',
                requestId
            });
        } else {
            // Database or other errors
            return res.status(500).json({ 
                success: false,
                message: 'Authentication service error',
                error: 'AUTH_SERVICE_ERROR',
                requestId
            });
        }
    }
};

// Middleware for premium dealers only
const authenticatePremiumDealer = async (req, res, next) => {
    const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
    
    // First run standard authentication
    await authenticateToken(req, res, (err) => {
        if (err) return next(err);
        
        logDebug('AUTH', `🔍 Checking premium access [${requestId}]`, {
            dealerId: req.user.id,
            currentTier: req.user.subscriptionTier
        });
        
        // Check if dealer has premium subscription
        if (req.user.subscriptionTier !== 'premium') {
            logSecurity('🚫 Premium access denied', {
                requestId,
                dealerId: req.user.id,
                dealerEmail: req.user.email,
                currentTier: req.user.subscriptionTier,
                requiredTier: 'premium',
                path: req.path,
                ip: req.ip
            });
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
            logSecurity('🚫 GHL integration required', {
                requestId,
                dealerId: req.user.id,
                dealerEmail: req.user.email,
                ghlEnabled: req.user.ghlIntegrationEnabled,
                path: req.path
            });
            return res.status(403).json({
                success: false,
                message: 'GoHighLevel integration setup required',
                error: 'GHL_INTEGRATION_REQUIRED'
            });
        }
        
        logAuth('✅ Premium access granted', {
            requestId,
            dealerId: req.user.id,
            dealerEmail: req.user.email,
            path: req.path
        });
        
        next();
    });
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
    
    try {
        logDebug('AUTH', `🔍 Optional authentication check [${requestId}]`, {
            path: req.path,
            hasAuthHeader: !!req.headers['authorization']
        });
        
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
                
                logDebug('AUTH', `✅ Optional auth successful [${requestId}]`, {
                    dealerId: dealer.id,
                    dealerName: dealer.dealerName
                });
            }
        }

        next();
    } catch (error) {
        // For optional auth, we don't fail on invalid tokens
        logDebug('AUTH', `⚠️ Optional auth failed, continuing without user [${requestId}]`, {
            error: error.message,
            path: req.path
        });
        next();
    }
};

// Middleware to check if user has specific permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
        
        logDebug('AUTH', `🔐 Checking permission: ${permission} [${requestId}]`, {
            hasUser: !!req.user,
            userId: req.user?.id,
            userTier: req.user?.subscriptionTier
        });
        
        if (!req.user) {
            logSecurity('🚫 Permission denied - no user', {
                requestId,
                requiredPermission: permission,
                path: req.path,
                ip: req.ip
            });
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
            ],
            admin: [
                // All basic and premium permissions
                'view_own_applications',
                'submit_applications',
                'view_own_dashboard',
                'manage_own_profile',
                'add_conversation_notes',
                'access_ghl_portal',
                'trigger_ghl_workflows',
                'view_marketing_contacts',
                'advanced_reporting',
                'marketing_tools',
                // Admin-specific permissions
                'view_all_applications',
                'view_all_dealers',
                'manage_all_dealers',
                'access_admin_panel',
                'system_configuration',
                'view_system_logs',
                'manage_dealer_subscriptions',
                'view_financial_reports',
                'export_data',
                'manage_admin_users',
                'view_audit_logs'
            ]
        };

        const userPermissions = permissions[req.user.subscriptionTier] || permissions.basic;

        if (!userPermissions.includes(permission)) {
            logSecurity('🚫 Insufficient permissions', {
                requestId,
                dealerId: req.user.id,
                dealerEmail: req.user.email,
                requiredPermission: permission,
                userTier: req.user.subscriptionTier,
                userPermissions: userPermissions,
                path: req.path,
                ip: req.ip
            });
            return res.status(403).json({
                success: false,
                message: `Permission denied: ${permission}`,
                error: 'INSUFFICIENT_PERMISSIONS',
                requiredPermission: permission,
                userTier: req.user.subscriptionTier
            });
        }

        logDebug('AUTH', `✅ Permission granted: ${permission} [${requestId}]`, {
            dealerId: req.user.id,
            userTier: req.user.subscriptionTier
        });

        next();
    };
};

// Rate limiting middleware for sensitive endpoints
const rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();

    return (req, res, next) => {
        const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
        const clientIP = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        logDebug('AUTH', `🚥 Rate limit check [${requestId}]`, {
            ip: clientIP,
            maxAttempts,
            windowMs
        });

        // Get existing attempts for this IP
        const ipAttempts = attempts.get(clientIP) || [];
        
        // Filter out attempts outside the window
        const recentAttempts = ipAttempts.filter(timestamp => timestamp > windowStart);

        if (recentAttempts.length >= maxAttempts) {
            logSecurity('🚫 Rate limit exceeded', {
                requestId,
                ip: clientIP,
                attempts: recentAttempts.length,
                maxAttempts,
                path: req.path,
                userAgent: req.headers['user-agent']
            });
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

        logDebug('AUTH', `✅ Rate limit passed [${requestId}]`, {
            ip: clientIP,
            attempts: recentAttempts.length,
            maxAttempts
        });

        next();
    };
};

// Middleware to log security events
const logSecurityEvent = (eventType) => {
    return (req, res, next) => {
        const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
        const originalSend = res.send;
        
        res.send = function(data) {
            // Log the security event
            logSecurity(`🔐 Security Event: ${eventType}`, {
                requestId,
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
    const requestId = req.requestId || Math.random().toString(36).substr(2, 9);
    
    await authenticateToken(req, res, (err) => {
        if (err) return next(err);
        
        logDebug('AUTH', `🔍 Checking admin access [${requestId}]`, {
            dealerId: req.user.id,
            userRole: req.user.role
        });
        
        // Check if user has admin role or admin subscription tier
        if (req.user.role !== 'admin' && req.user.subscriptionTier !== 'admin') {
            logSecurity('🚫 Admin access denied', {
                requestId,
                dealerId: req.user.id,
                dealerEmail: req.user.email,
                userRole: req.user.role,
                subscriptionTier: req.user.subscriptionTier,
                path: req.path,
                ip: req.ip
            });
            return res.status(403).json({
                success: false,
                message: 'Admin access required',
                error: 'ADMIN_REQUIRED'
            });
        }
        
        logAuth('✅ Admin access granted', {
            requestId,
            dealerId: req.user.id,
            dealerEmail: req.user.email,
            path: req.path
        });
        
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
