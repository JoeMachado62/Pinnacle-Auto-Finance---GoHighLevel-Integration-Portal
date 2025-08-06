// routes/authRoutes.js - COMPLETE REWRITE WITH 2FA SYSTEM
// Adapted from Lead Router Pro's auth_routes.py
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const db = require('../services/databaseService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

// In-memory store for 2FA sessions (use Redis in production)
const twoFactorSessions = new Map();

// Utility functions
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
}

function getUserAgent(req) {
    return req.headers['user-agent'] || 'unknown';
}

// Clean up expired 2FA sessions
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of twoFactorSessions.entries()) {
        if (now > session.expiresAt) {
            twoFactorSessions.delete(sessionId);
        }
    }
}, 60000); // Clean up every minute

// ===== DEALER REGISTRATION =====
router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            confirmPassword,
            dealerName,
            contactName,
            phone,
            address,
            dealerLicenseNumber,
            finNumber,
            subscriptionTier = 'basic'
        } = req.body;

        // Validation
        if (!email || !password || !dealerName || !contactName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: email, password, dealerName, contactName'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (!dealerLicenseNumber && !finNumber) {
            return res.status(400).json({
                success: false,
                message: 'Either Dealer License Number or FIN Number is required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Create dealer
        const dealerData = {
            email,
            password,
            dealerName,
            contactName,
            phone,
            address,
            dealerLicenseNumber,
            finNumber,
            subscriptionTier
        };

        const newDealer = await authService.createDealer(dealerData);

        // Log registration
        logger.info(`New dealer registered: ${email} from IP: ${getClientIP(req)}`);

        // Send welcome email
        try {
            await emailService.sendWelcomeEmail(newDealer.email, newDealer.dealerName, newDealer.subscriptionTier);
        } catch (emailError) {
            logger.warn('Failed to send welcome email:', emailError);
            // Don't fail registration if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Dealer registered successfully',
            dealer: {
                id: newDealer.id,
                email: newDealer.email,
                dealerName: newDealer.dealerName,
                contactName: newDealer.contactName,
                subscriptionTier: newDealer.subscriptionTier
            }
        });

    } catch (error) {
        logger.error('Registration error:', {
            error: error.message,
            ip: getClientIP(req),
            userAgent: getUserAgent(req)
        });

        if (error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: 'A dealer with this email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===== LOGIN STEP 1: VALIDATE CREDENTIALS & SEND 2FA =====
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getUserAgent(req);

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Authenticate dealer
        const { dealer, token } = await authService.authenticateDealer(email, password);

        // Generate 2FA code
        const code = authService.generate2FACode();
        const sessionId = crypto.randomUUID();

        // Store 2FA session
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
        twoFactorSessions.set(sessionId, {
            code: code,
            dealerId: dealer.id,
            email: dealer.email,
            dealerName: dealer.dealerName,
            subscriptionTier: dealer.subscriptionTier,
            expiresAt: expiresAt,
            attempts: 0,
            maxAttempts: 3,
            clientIP: clientIP,
            userAgent: userAgent,
            createdAt: Date.now()
        });

        // Store 2FA code in database for audit
        await db.store2FACode(dealer.id, code, dealer.email, 'login', 10);

        // Send 2FA code via email
        const emailSent = await emailService.send2FACode(dealer.email, code, dealer.contactName);

        if (!emailSent) {
            // Clean up session if email fails
            twoFactorSessions.delete(sessionId);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification code. Please try again.'
            });
        }

        logger.info(`2FA code sent to dealer: ${dealer.email} from IP: ${clientIP}`);

        res.json({
            success: true,
            message: '2FA code sent to your email',
            sessionId: sessionId,
            email: dealer.email,
            expiresAt: expiresAt
        });

    } catch (error) {
        logger.error('Login error:', {
            error: error.message,
            ip: getClientIP(req),
            userAgent: getUserAgent(req),
            email: req.body.email
        });
        
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (error.message.includes('Account locked')) {
            return res.status(423).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// ===== LOGIN STEP 2: VERIFY 2FA CODE & COMPLETE LOGIN =====
router.post('/verify-2fa', async (req, res) => {
    try {
        const { sessionId, code } = req.body;
        const clientIP = getClientIP(req);

        if (!sessionId || !code) {
            return res.status(400).json({
                success: false,
                message: 'Session ID and verification code are required'
            });
        }

        // Validate code format
        if (!authService.isValid2FACode(code)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid code format'
            });
        }

        // Get 2FA session
        const session = twoFactorSessions.get(sessionId);
        if (!session) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired session. Please start login again.'
            });
        }

        // Check expiration
        if (Date.now() > session.expiresAt) {
            twoFactorSessions.delete(sessionId);
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please login again.'
            });
        }

        // Check attempts
        if (session.attempts >= session.maxAttempts) {
            twoFactorSessions.delete(sessionId);
            await db.increment2FAAttempts(session.dealerId, code);
            
            logger.warn(`2FA max attempts exceeded for dealer: ${session.email} from IP: ${clientIP}`);
            
            return res.status(429).json({
                success: false,
                message: 'Too many failed attempts. Please login again.'
            });
        }

        // Verify code
        if (session.code !== code.toString()) {
            session.attempts++;
            await db.increment2FAAttempts(session.dealerId, code);
            
            logger.warn(`Invalid 2FA code attempt for dealer: ${session.email} from IP: ${clientIP}`);
            
            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${session.maxAttempts - session.attempts} attempts remaining.`
            });
        }

        // Code is valid - complete login
        const dealer = await authService.getDealerById(session.dealerId);
        if (!dealer) {
            twoFactorSessions.delete(sessionId);
            return res.status(400).json({
                success: false,
                message: 'Dealer not found. Please register again.'
            });
        }

        // Generate new JWT token for authenticated session
        const { token } = await authService.authenticateDealer(dealer.email, null, true); // Skip password check

        // Mark 2FA code as used
        await db.use2FACode(session.dealerId, code);

        // Clean up 2FA session
        twoFactorSessions.delete(sessionId);

        logger.info(`Dealer logged in successfully: ${dealer.email} from IP: ${clientIP}`);

        // Determine redirect and features based on subscription tier and role
        let redirectUrl = '/dashboard.html';
        let features = {
            basicFeatures: true,
            premiumFeatures: dealer.subscriptionTier === 'premium' || dealer.subscriptionTier === 'admin',
            adminFeatures: dealer.role === 'admin' || dealer.subscriptionTier === 'admin'
        };

        // Admin users get redirected to admin dashboard
        if (dealer.role === 'admin' || dealer.subscriptionTier === 'admin') {
            redirectUrl = '/admin-dashboard.html';
            features.adminFeatures = true;
            features.premiumFeatures = true; // Admins have all premium features too
            features.ghlPortalAvailable = true;
            features.advancedReporting = true;
            features.marketingTools = true;
            features.crossDealerAccess = true;
            features.systemManagement = true;
            
            // Log admin login for debugging
            logger.info(`🔥 ADMIN LOGIN DETECTED - Redirecting to admin dashboard`, {
                dealerId: dealer.id,
                dealerEmail: dealer.email,
                role: dealer.role,
                subscriptionTier: dealer.subscriptionTier,
                redirectUrl: redirectUrl
            });
        } else if (dealer.subscriptionTier === 'premium') {
            features.ghlPortalAvailable = true;
            features.advancedReporting = true;
            features.marketingTools = true;
            // TODO: Generate GHL SSO URL when GHL integration is implemented
        }

        // Log the final response for debugging
        logger.info(`🚀 SENDING LOGIN RESPONSE`, {
            dealerId: dealer.id,
            dealerEmail: dealer.email,
            redirectUrl: redirectUrl,
            isAdmin: dealer.role === 'admin' || dealer.subscriptionTier === 'admin',
            features: features
        });

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            dealer: {
                id: dealer.id,
                email: dealer.email,
                dealerName: dealer.dealerName,
                contactName: dealer.contactName,
                subscriptionTier: dealer.subscriptionTier,
                role: dealer.role,
                lastLogin: dealer.lastLogin,
                ghlIntegrationEnabled: dealer.ghlIntegrationEnabled
            },
            redirectUrl: redirectUrl,
            features: features
        });

    } catch (error) {
        logger.error('2FA verification error:', {
            error: error.message,
            ip: getClientIP(req),
            sessionId: req.body.sessionId
        });
        
        res.status(500).json({
            success: false,
            message: 'Verification failed. Please try again.'
        });
    }
});

// ===== RESEND 2FA CODE =====
router.post('/resend-2fa', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        const session = twoFactorSessions.get(sessionId);
        if (!session) {
            return res.status(400).json({
                success: false,
                message: 'Invalid session. Please start login again.'
            });
        }

        // Check if enough time has passed since last code (prevent spam)
        const timeSinceCreated = Date.now() - session.createdAt;
        if (timeSinceCreated < 30000) { // 30 seconds
            return res.status(429).json({
                success: false,
                message: 'Please wait 30 seconds before requesting a new code'
            });
        }

        // Generate new code
        const newCode = authService.generate2FACode();
        
        // Update session
        session.code = newCode;
        session.attempts = 0;
        session.expiresAt = Date.now() + (10 * 60 * 1000); // New 10 minute expiration
        session.createdAt = Date.now();

        // Store new code in database
        await db.store2FACode(session.dealerId, newCode, session.email, 'login', 10);

        // Send new code
        const emailSent = await emailService.send2FACode(session.email, newCode, session.dealerName);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification code. Please try again.'
            });
        }

        logger.info(`2FA code resent to dealer: ${session.email}`);

        res.json({
            success: true,
            message: 'New verification code sent to your email',
            expiresAt: session.expiresAt
        });

    } catch (error) {
        logger.error('Resend 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend code. Please try again.'
        });
    }
});

// ===== GET DEALER PROFILE =====
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const dealer = req.user;
        
        // Get additional stats
        const applications = await db.getDealerApplications(dealer.id, 10);
        const stats = {
            totalApplications: applications.length,
            pendingApplications: applications.filter(app => app.status === 'submitted').length,
            lastApplicationDate: applications.length > 0 ? applications[0].createdAt : null
        };

        res.json({
            success: true,
            dealer: {
                ...dealer,
                stats: stats
            }
        });
    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// ===== FORGOT PASSWORD =====
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const clientIP = getClientIP(req);

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
        }

        // Check if dealer exists
        const dealer = await db.getDealerByEmail(email.toLowerCase().trim());
        if (!dealer) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with that email exists, password reset instructions have been sent.'
            });
        }

        // Generate reset code (using same 2FA system)
        const resetCode = authService.generate2FACode();
        const sessionId = crypto.randomBytes(32).toString('hex');
        
        // Store reset session (expires in 30 minutes)
        const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
        twoFactorSessions.set(sessionId, {
            dealerId: dealer.id,
            email: dealer.email,
            code: resetCode,
            type: 'password_reset',
            attempts: 0,
            maxAttempts: 3,
            expiresAt: expiresAt,
            clientIP: clientIP
        });

        // Store in database as well
        await db.store2FACode(dealer.id, resetCode, dealer.email, 'password_reset', 30);

        // Send reset email
        try {
            await emailService.send2FACode(dealer.email, resetCode, 'password_reset', {
                dealerName: dealer.dealerName,
                resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?session=${sessionId}`
            });
        } catch (emailError) {
            logger.error('Failed to send password reset email:', emailError);
            twoFactorSessions.delete(sessionId);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send reset instructions. Please try again.'
            });
        }

        logger.info(`Password reset requested for dealer: ${dealer.email} from IP: ${clientIP}`);

        res.json({
            success: true,
            message: 'If an account with that email exists, password reset instructions have been sent.',
            sessionId: sessionId // Include for frontend handling
        });

    } catch (error) {
        logger.error('Forgot password error:', {
            error: error.message,
            ip: getClientIP(req),
            email: req.body.email
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request. Please try again.'
        });
    }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
    try {
        const { sessionId, code, newPassword, confirmPassword } = req.body;
        const clientIP = getClientIP(req);

        if (!sessionId || !code || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Get reset session
        const session = twoFactorSessions.get(sessionId);
        if (!session || session.type !== 'password_reset') {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset session'
            });
        }

        // Check expiration
        if (Date.now() > session.expiresAt) {
            twoFactorSessions.delete(sessionId);
            return res.status(400).json({
                success: false,
                message: 'Reset session has expired. Please request a new password reset.'
            });
        }

        // Check attempts
        if (session.attempts >= session.maxAttempts) {
            twoFactorSessions.delete(sessionId);
            return res.status(429).json({
                success: false,
                message: 'Too many failed attempts. Please request a new password reset.'
            });
        }

        // Verify code
        if (session.code !== code.toString()) {
            session.attempts++;
            return res.status(400).json({
                success: false,
                message: `Invalid reset code. ${session.maxAttempts - session.attempts} attempts remaining.`
            });
        }

        // Code is valid - reset password
        const dealer = await db.getDealerById(session.dealerId);
        if (!dealer) {
            twoFactorSessions.delete(sessionId);
            return res.status(400).json({
                success: false,
                message: 'Dealer not found'
            });
        }

        // Update password
        await authService.resetPassword(dealer.id, newPassword);

        // Mark code as used and clean up
        await db.use2FACode(session.dealerId, code);
        twoFactorSessions.delete(sessionId);

        logger.info(`Password reset completed for dealer: ${dealer.email} from IP: ${clientIP}`);

        res.json({
            success: true,
            message: 'Password has been reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        logger.error('Reset password error:', {
            error: error.message,
            ip: getClientIP(req),
            sessionId: req.body.sessionId
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
});

// ===== CHANGE PASSWORD =====
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const dealerId = req.user.id;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All password fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        await authService.changePassword(dealerId, currentPassword, newPassword);

        logger.info(`Password changed for dealer: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        logger.error('Change password error:', error);
        
        if (error.message === 'Current password is incorrect') {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

// ===== LOGOUT =====
router.post('/logout', authenticateToken, (req, res) => {
    // In a full implementation, you'd invalidate the token in a blacklist
    logger.info(`Dealer logged out: ${req.user.email} from IP: ${getClientIP(req)}`);
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// ===== SUBSCRIPTION UPGRADE =====
router.post('/upgrade-subscription', authenticateToken, async (req, res) => {
    try {
        const { subscriptionTier, paymentInfo } = req.body;
        const dealerId = req.user.id;

        if (!['basic', 'premium'].includes(subscriptionTier)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription tier'
            });
        }

        if (req.user.subscriptionTier === subscriptionTier) {
            return res.status(400).json({
                success: false,
                message: `Already on ${subscriptionTier} tier`
            });
        }

        // TODO: Process payment here
        // TODO: Create GHL user for premium tier

        const updatedDealer = await authService.updateDealerSubscription(dealerId, subscriptionTier);

        logger.info(`Dealer ${req.user.email} upgraded to ${subscriptionTier} tier`);

        res.json({
            success: true,
            message: `Successfully upgraded to ${subscriptionTier} tier`,
            dealer: updatedDealer
        });

    } catch (error) {
        logger.error('Subscription upgrade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upgrade subscription'
        });
    }
});

// ===== HEALTH CHECK =====
router.get('/health', async (req, res) => {
    try {
        const emailHealth = await emailService.testConnection();
        const activeSessions = twoFactorSessions.size;
        
        res.json({
            success: true,
            status: 'healthy',
            services: {
                email: emailHealth ? 'healthy' : 'degraded',
                database: 'healthy', // JSON file based
                auth: 'healthy'
            },
            metrics: {
                activeTwoFactorSessions: activeSessions
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;