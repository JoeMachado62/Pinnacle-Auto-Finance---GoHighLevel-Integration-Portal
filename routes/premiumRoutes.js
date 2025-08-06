// routes/premiumRoutes.js - Premium GHL Integration Routes
const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateToken, authenticatePremiumDealer } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const config = require('../config');

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

// GHL iframe endpoint 
router.get('/ghl-interface',
    authenticateToken, 
    authenticatePremiumDealer,
    (req, res) => {
        try {
            logger.info(`GHL interface requested by premium user: ${req.user.email}`);
            
            // For now, serve the iframe container
            // Later we'll add auto-login functionality
            res.json({
                success: true,
                ghlUrl: 'https://app.gohighlevel.com',
                locationId: config.GHL_LOCATION_ID,
                message: 'GHL interface ready'
            });
        } catch (error) {
            logger.error('Error preparing GHL interface:', error);
            res.status(500).json({
                success: false,
                message: 'Error loading GHL interface'
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