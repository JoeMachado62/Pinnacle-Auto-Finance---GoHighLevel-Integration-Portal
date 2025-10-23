// routes/clientRoutes.js
// Client API endpoints for Auto Fill Agent

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../services/databaseService');
const logger = require('../utils/logger');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// ===== AUTHENTICATION ENDPOINTS =====

/**
 * POST /api/client/register
 * Register new client account
 * Body: { email, password, firstName, lastName, phone, dealerId }
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, dealerId } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName || !dealerId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: email, password, firstName, lastName, dealerId'
            });
        }

        // Validate email format (must be Gmail for integration)
        if (!email.endsWith('@gmail.com')) {
            return res.status(400).json({
                success: false,
                message: 'Only Gmail accounts are supported for lender communication'
            });
        }

        // Check if dealer exists
        const dealer = await db.getDealerById(dealerId);
        if (!dealer) {
            return res.status(404).json({
                success: false,
                message: 'Dealer not found'
            });
        }

        // Check if client already exists
        const existingClient = await db.getClientByEmail(email);
        if (existingClient) {
            return res.status(409).json({
                success: false,
                message: 'Client with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create client
        const client = await db.createClient({
            email,
            passwordHash,
            firstName,
            lastName,
            phone,
            dealerId
        });

        // Remove sensitive data from response
        delete client.passwordHash;
        delete client.gmailAppPassword;

        // Generate JWT token
        const token = jwt.sign(
            {
                id: client.id,
                email: client.email,
                type: 'client'
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('Client registered', { clientId: client.id, email: client.email });

        res.status(201).json({
            success: true,
            message: 'Client registered successfully',
            token,
            client
        });

    } catch (error) {
        logger.error('Client registration error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

/**
 * POST /api/client/login
 * Client login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required'
            });
        }

        // Get client
        const client = await db.getClientByEmail(email);
        if (!client) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check status
        if (client.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact your dealer.'
            });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, client.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        await db.updateClientLastLogin(client.id);

        // Remove sensitive data
        delete client.passwordHash;
        delete client.gmailAppPassword;

        // Generate JWT token
        const token = jwt.sign(
            {
                id: client.id,
                email: client.email,
                type: 'client'
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('Client login', { clientId: client.id, email: client.email });

        res.json({
            success: true,
            token,
            client
        });

    } catch (error) {
        logger.error('Client login error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// ===== CLIENT DATA ENDPOINTS (PROTECTED) =====

/**
 * GET /api/client/profile
 * Get client profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const client = await db.getClientById(req.user.id);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // Remove sensitive data
        delete client.passwordHash;
        delete client.gmailAppPassword;

        res.json({
            success: true,
            client
        });

    } catch (error) {
        logger.error('Get client profile error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: error.message
        });
    }
});

/**
 * PATCH /api/client/profile
 * Update client profile
 * Body: { firstName, lastName, phone, gmailAppPassword }
 */
router.patch('/profile', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const { firstName, lastName, phone, gmailAppPassword } = req.body;

        const updates = {};
        if (firstName) updates.firstName = firstName;
        if (lastName) updates.lastName = lastName;
        if (phone) updates.phone = phone;
        if (gmailAppPassword) updates.gmailAppPassword = gmailAppPassword; // Should be encrypted

        const client = await db.updateClient(req.user.id, updates);

        // Remove sensitive data
        delete client.passwordHash;
        delete client.gmailAppPassword;

        res.json({
            success: true,
            message: 'Profile updated',
            client
        });

    } catch (error) {
        logger.error('Update client profile error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

/**
 * GET /api/client/applications
 * Get client's credit applications
 */
router.get('/applications', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const client = await db.getClientById(req.user.id);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // Get applications by email match
        const allApplications = await db.getAllApplications();
        const clientApplications = allApplications.filter(app => {
            const appEmail = app.applicantData?.borrower1_email || app.applicant?.email;
            return appEmail === client.email;
        });

        res.json({
            success: true,
            count: clientApplications.length,
            applications: clientApplications
        });

    } catch (error) {
        logger.error('Get client applications error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get applications',
            error: error.message
        });
    }
});

/**
 * GET /api/client/submissions
 * Get client's lender submissions
 */
router.get('/submissions', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get all submissions and filter by client email
        // TODO: Add clientId field to submissions schema for more efficient querying
        const allSubmissions = await db.getAllSubmissions();
        const clientSubmissions = allSubmissions.filter(sub => {
            // Match by application data
            return sub.applicationData?.email === req.user.email;
        });

        res.json({
            success: true,
            count: clientSubmissions.length,
            submissions: clientSubmissions
        });

    } catch (error) {
        logger.error('Get client submissions error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get submissions',
            error: error.message
        });
    }
});

/**
 * POST /api/client/submit-to-lenders
 * Trigger automated submission to multiple lenders
 * Body: { applicationId, lenderIds }
 */
router.post('/submit-to-lenders', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'client') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const { applicationId, lenderIds } = req.body;

        if (!applicationId || !lenderIds || !Array.isArray(lenderIds)) {
            return res.status(400).json({
                success: false,
                message: 'applicationId and lenderIds array required'
            });
        }

        // Get application
        const application = await db.getApplicationById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Verify client owns this application
        const appEmail = application.applicantData?.borrower1_email || application.applicant?.email;
        if (appEmail !== req.user.email) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Not your application'
            });
        }

        // TODO: Trigger Python automation service (Phase 2)
        // For now, just create submission records

        const submissions = [];
        for (const lenderId of lenderIds) {
            const lender = await db.getLenderById(lenderId);
            if (lender && lender.active) {
                const submission = await db.createSubmission({
                    dealerId: application.dealerId,
                    applicationId: application.id,
                    lenderUrl: lender.url,
                    lenderName: lender.name,
                    status: 'pending',
                    applicationData: application.applicantData || application
                });
                submissions.push(submission);
            }
        }

        logger.info('Lender submissions queued', {
            clientId: req.user.id,
            applicationId,
            submissionCount: submissions.length
        });

        res.json({
            success: true,
            message: `Queued ${submissions.length} submissions`,
            submissions
        });

    } catch (error) {
        logger.error('Submit to lenders error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to queue submissions',
            error: error.message
        });
    }
});

module.exports = router;
