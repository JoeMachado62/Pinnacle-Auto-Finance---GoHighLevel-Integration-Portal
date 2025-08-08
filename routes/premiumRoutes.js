// routes/premiumRoutes.js - Premium GHL Integration Routes
const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateToken, authenticatePremiumDealer } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const config = require('../config');
const ghlUserService = require('../services/ghlUserService');

// Basic premium dashboard route (accessible as static file with client-side auth check)
router.get('/dashboard', 
    authenticateToken,
    authenticatePremiumDealer,
    (req, res) => {
        try {
            logger.info(`Premium dashboard accessed by ${req.user.email}`);
            
            res.sendFile(path.join(__dirname, '../public/premium-dashboard.html'));
        } catch (error) {
            logger.error('Error serving premium dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error accessing premium features'
            });
        }
    }
);

// GHL auto-login endpoint with access token generation
router.get('/ghl-interface',
    authenticateToken, 
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            logger.info(`GHL interface requested by premium user: ${req.user.email}`);
            
            // Check GHL registration status
            const registrationStatus = await ghlUserService.getRegistrationStatus(req.user.id);
            
            if (registrationStatus.status === 'not_registered') {
                return res.status(400).json({
                    success: false,
                    message: 'GHL registration required',
                    action: 'register',
                    registrationStatus: registrationStatus.status
                });
            }
            
            if (registrationStatus.status === 'pending_approval') {
                return res.json({
                    success: false,
                    message: 'Your GHL registration is pending admin approval',
                    action: 'wait',
                    registrationStatus: registrationStatus.status
                });
            }
            
            if (registrationStatus.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: `GHL registration status: ${registrationStatus.status}`,
                    registrationStatus: registrationStatus.status
                });
            }
            
            // Generate access token for auto-login
            const accessToken = await ghlUserService.generateGhlAccessToken(req.user.id);
            
            res.json({
                success: true,
                ghlUrl: accessToken.loginUrl,
                locationId: config.GHL_LOCATION_ID,
                accessToken: accessToken.accessToken,
                ghlUserId: accessToken.ghlUserId,
                expiresAt: accessToken.expiresAt,
                registrationStatus: registrationStatus.status,
                message: 'GHL auto-login ready'
            });
        } catch (error) {
            logger.error('Error preparing GHL interface:', error);
            res.status(500).json({
                success: false,
                message: 'Error loading GHL interface',
                error: error.message
            });
        }
    }
);

// Auto-register premium user for GHL access
router.post('/register-ghl',
    authenticateToken,
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            logger.info(`GHL registration requested by: ${req.user.email}`);
            
            // Check if already registered
            const existingRegistration = await ghlUserService.getRegistrationStatus(req.user.id);
            if (existingRegistration.status !== 'not_registered') {
                return res.json({
                    success: true,
                    message: 'Already registered for GHL',
                    registrationStatus: existingRegistration.status,
                    registration: existingRegistration
                });
            }
            
            // Process premium upgrade and create GHL registration
            const registration = await ghlUserService.processPremiumUpgrade(req.user);
            
            res.json({
                success: true,
                message: 'GHL registration submitted successfully. Awaiting admin approval.',
                registrationId: registration.id,
                registrationStatus: registration.status,
                ghlContactId: registration.ghlContactId
            });
        } catch (error) {
            logger.error('Error registering for GHL:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to register for GHL access',
                error: error.message
            });
        }
    }
);

// Get GHL registration status
router.get('/ghl-status',
    authenticateToken,
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            const status = await ghlUserService.getRegistrationStatus(req.user.id);
            res.json({
                success: true,
                registrationStatus: status
            });
        } catch (error) {
            logger.error('Error getting GHL status:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting GHL status',
                error: error.message
            });
        }
    }
);

// Test endpoint to verify premium access
router.get('/test',
    authenticateToken,
    authenticatePremiumDealer, 
    (req, res) => {
        res.json({
            success: true,
            message: 'Premium access confirmed',
            user: {
                email: req.user.email,
                tier: req.user.subscriptionTier,
                ghlEnabled: req.user.ghlIntegrationEnabled
            }
        });
    }
);

module.exports = router;