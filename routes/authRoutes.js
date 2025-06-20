// /var/www/paf-ghl/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// POST /api/auth/register - Dealer registration
router.post('/register', async (req, res) => {
    try {
        const {
            username,
            password,
            confirmPassword,
            dealerName,
            dealerLicenseNumber,
            finNumber,
            contactName,
            email,
            phone,
            address
        } = req.body;

        // Basic validation
        if (!username || !password || !dealerName || !contactName || !email) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['username', 'password', 'dealerName', 'contactName', 'email']
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: 'Passwords do not match'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long'
            });
        }

        if (!dealerLicenseNumber && !finNumber) {
            return res.status(400).json({
                message: 'Either Dealer License Number or FIN Number is required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Invalid email format'
            });
        }

        const registrationData = {
            username: username.trim().toLowerCase(),
            password,
            dealerName: dealerName.trim(),
            dealerLicenseNumber: dealerLicenseNumber?.trim() || null,
            finNumber: finNumber?.trim() || null,
            contactName: contactName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || null,
            address: address?.trim() || null
        };

        const newUser = await authService.registerDealer(registrationData);

        logger.info(`New dealer registered: ${newUser.username} (${newUser.dealerName})`);

        res.status(201).json({
            message: 'Dealer registered successfully',
            user: {
                userId: newUser.userId,
                username: newUser.username,
                dealerName: newUser.dealerName,
                contactName: newUser.contactName,
                email: newUser.email,
                createdAt: newUser.createdAt
            }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        
        if (error.message.includes('already exists') || 
            error.message.includes('Missing required fields') ||
            error.message.includes('Either Dealer License Number')) {
            return res.status(400).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/auth/login - Dealer login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: 'Username and password are required'
            });
        }

        const result = await authService.authenticateDealer(
            username.trim().toLowerCase(), 
            password
        );

        logger.info(`Dealer logged in: ${result.user.username}`);

        res.json({
            message: 'Login successful',
            user: {
                userId: result.user.userId,
                username: result.user.username,
                dealerName: result.user.dealerName,
                contactName: result.user.contactName,
                email: result.user.email,
                dealerLicenseNumber: result.user.dealerLicenseNumber,
                finNumber: result.user.finNumber,
                lastLogin: result.user.lastLogin
            },
            token: result.token
        });

    } catch (error) {
        logger.error('Login error:', error);
        
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({
                message: 'Invalid username or password'
            });
        }

        res.status(500).json({
            message: 'Login failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/auth/profile - Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            user: {
                userId: req.user.userId,
                username: req.user.username,
                dealerName: req.user.dealerName,
                contactName: req.user.contactName,
                email: req.user.email,
                phone: req.user.phone,
                address: req.user.address,
                dealerLicenseNumber: req.user.dealerLicenseNumber,
                finNumber: req.user.finNumber,
                createdAt: req.user.createdAt,
                lastLogin: req.user.lastLogin
            }
        });
    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            message: 'Failed to fetch profile'
        });
    }
});

// POST /api/auth/verify-token - Verify if token is valid
router.post('/verify-token', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: {
            userId: req.user.userId,
            username: req.user.username,
            dealerName: req.user.dealerName
        }
    });
});

module.exports = router;
