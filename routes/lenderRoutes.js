// routes/lenderRoutes.js
// Lender management API endpoints

const express = require('express');
const router = express.Router();
const db = require('../services/databaseService');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

// ===== LENDER MANAGEMENT ENDPOINTS =====

/**
 * GET /api/lenders
 * Get all lenders (dealer-specific + global)
 * Query params: ?dealerId=xxx&active=true
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { dealerId, active } = req.query;

        // Determine which dealer's lenders to show
        let targetDealerId = dealerId;

        // If dealer is logged in, only show their lenders
        if (req.user.type === 'dealer') {
            targetDealerId = req.user.id;
        }

        let lenders;
        if (active === 'true') {
            lenders = await db.getActiveLenders(targetDealerId);
        } else if (targetDealerId) {
            lenders = await db.getLendersByDealer(targetDealerId);
        } else {
            lenders = await db.getAllLenders();
        }

        res.json({
            success: true,
            count: lenders.length,
            lenders
        });

    } catch (error) {
        logger.error('Get lenders error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get lenders',
            error: error.message
        });
    }
});

/**
 * GET /api/lenders/:id
 * Get specific lender by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const lender = await db.getLenderById(req.params.id);

        if (!lender) {
            return res.status(404).json({
                success: false,
                message: 'Lender not found'
            });
        }

        // Check access permissions
        if (req.user.type === 'dealer' && lender.dealerId && lender.dealerId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            lender
        });

    } catch (error) {
        logger.error('Get lender error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get lender',
            error: error.message
        });
    }
});

/**
 * POST /api/lenders
 * Create new lender
 * Body: { name, url, category, dealerId, active }
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, url, category, dealerId, active } = req.body;

        if (!name || !url) {
            return res.status(400).json({
                success: false,
                message: 'Name and URL are required'
            });
        }

        // Validate category
        const validCategories = ['bank', 'credit_union', 'specialty'];
        if (category && !validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Must be: bank, credit_union, or specialty'
            });
        }

        // Determine dealer association
        let lenderDealerId = dealerId;

        // If dealer is creating lender, associate with their account
        if (req.user.type === 'dealer') {
            lenderDealerId = req.user.id;
        }

        // Only admin can create global lenders (dealerId = null)
        if (!lenderDealerId && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create global lenders'
            });
        }

        const lender = await db.createLender({
            name,
            url,
            category,
            dealerId: lenderDealerId,
            active
        });

        logger.info('Lender created', {
            lenderId: lender.id,
            name: lender.name,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'Lender created successfully',
            lender
        });

    } catch (error) {
        logger.error('Create lender error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to create lender',
            error: error.message
        });
    }
});

/**
 * PUT /api/lenders/:id
 * Update lender
 * Body: { name, url, category, active }
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const lender = await db.getLenderById(req.params.id);

        if (!lender) {
            return res.status(404).json({
                success: false,
                message: 'Lender not found'
            });
        }

        // Check permissions
        if (req.user.type === 'dealer' && lender.dealerId && lender.dealerId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Can only modify your own lenders'
            });
        }

        // Only admin can modify global lenders
        if (!lender.dealerId && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can modify global lenders'
            });
        }

        const { name, url, category, active } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (url) updates.url = url;
        if (category) {
            const validCategories = ['bank', 'credit_union', 'specialty'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category'
                });
            }
            updates.category = category;
        }
        if (active !== undefined) updates.active = active;

        const updatedLender = await db.updateLender(req.params.id, updates);

        res.json({
            success: true,
            message: 'Lender updated successfully',
            lender: updatedLender
        });

    } catch (error) {
        logger.error('Update lender error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to update lender',
            error: error.message
        });
    }
});

/**
 * DELETE /api/lenders/:id
 * Delete lender
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const lender = await db.getLenderById(req.params.id);

        if (!lender) {
            return res.status(404).json({
                success: false,
                message: 'Lender not found'
            });
        }

        // Check permissions
        if (req.user.type === 'dealer' && lender.dealerId && lender.dealerId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Can only delete your own lenders'
            });
        }

        // Only admin can delete global lenders
        if (!lender.dealerId && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can delete global lenders'
            });
        }

        await db.deleteLender(req.params.id);

        logger.info('Lender deleted', {
            lenderId: req.params.id,
            deletedBy: req.user.id
        });

        res.json({
            success: true,
            message: 'Lender deleted successfully'
        });

    } catch (error) {
        logger.error('Delete lender error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to delete lender',
            error: error.message
        });
    }
});

/**
 * GET /api/lenders/stats/overview
 * Get lender statistics
 * Query params: ?dealerId=xxx
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        const { dealerId } = req.query;

        let targetDealerId = dealerId;

        // If dealer is logged in, only show their stats
        if (req.user.type === 'dealer') {
            targetDealerId = req.user.id;
        }

        const stats = await db.getLenderStats(targetDealerId);

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Get lender stats error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get lender stats',
            error: error.message
        });
    }
});

/**
 * PATCH /api/lenders/:id/stats
 * Update lender stats (called after submission outcome)
 * Body: { outcome: 'approved' | 'declined' }
 * NOTE: This is typically called internally, not by users
 */
router.patch('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { outcome } = req.body;

        if (!['approved', 'declined'].includes(outcome)) {
            return res.status(400).json({
                success: false,
                message: 'Outcome must be "approved" or "declined"'
            });
        }

        const lender = await db.getLenderById(req.params.id);
        if (!lender) {
            return res.status(404).json({
                success: false,
                message: 'Lender not found'
            });
        }

        const updatedLender = await db.updateLenderStats(req.params.id, outcome);

        res.json({
            success: true,
            message: 'Lender stats updated',
            lender: updatedLender
        });

    } catch (error) {
        logger.error('Update lender stats error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to update lender stats',
            error: error.message
        });
    }
});

module.exports = router;
