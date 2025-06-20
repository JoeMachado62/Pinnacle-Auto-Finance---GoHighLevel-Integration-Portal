// /var/www/paf-ghl/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/dashboard/deals - Get all deals for the authenticated dealer
router.get('/deals', authenticateToken, async (req, res) => {
    try {
        const { dealerLicenseNumber, finNumber } = req.dealerIdentifier;
        
        logger.info(`Fetching deals for dealer: ${req.user.dealerName} (License: ${dealerLicenseNumber}, FIN: ${finNumber})`);

        const deals = await dashboardService.getDealsForDealer(dealerLicenseNumber, finNumber);

        res.json({
            success: true,
            dealer: {
                name: req.user.dealerName,
                licenseNumber: dealerLicenseNumber,
                finNumber: finNumber
            },
            deals: deals,
            totalDeals: deals.length
        });

    } catch (error) {
        logger.error('Error fetching dealer deals:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/dashboard/deal/:opportunityId - Get detailed deal jacket for specific opportunity
router.get('/deal/:opportunityId', authenticateToken, async (req, res) => {
    try {
        const { opportunityId } = req.params;
        const { dealerLicenseNumber, finNumber } = req.dealerIdentifier;

        logger.info(`Fetching deal details for opportunity: ${opportunityId}, dealer: ${req.user.dealerName}`);

        const dealJacket = await dashboardService.getDealDetails(opportunityId, dealerLicenseNumber, finNumber);

        res.json({
            success: true,
            dealJacket: dealJacket
        });

    } catch (error) {
        logger.error('Error fetching deal details:', error);
        
        if (error.message.includes('not found') || error.message.includes('access denied')) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to fetch deal details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/dashboard/featured-vehicles - Get featured vehicle cards for sidebar
router.get('/featured-vehicles', async (req, res) => {
    try {
        // For now, return placeholder data
        // TODO: Implement admin-managed featured vehicles
        const featuredVehicles = [
            {
                id: 1,
                title: "CERTIFIED USED 2.4L 2021 ACURA ILX...",
                price: "$12,000",
                badge: "FEATURED CLASSIFIED",
                image: "/images/placeholder-car1.jpg",
                details: "2.4L • 2021 • Manual",
                active: true
            },
            {
                id: 2,
                title: "USED 2.0L 2020 KIA SPORTAGE",
                price: "$22,000",
                badge: "SPECIAL",
                image: "/images/placeholder-car2.jpg",
                details: "2.0L • 2020 • Automatic",
                active: true
            },
            {
                id: 3,
                title: "NEW ELECTRICAL 2022 TESLA ROADSTER...",
                price: "$120,000",
                badge: "SPECIAL",
                image: "/images/placeholder-car3.jpg",
                details: "Electrical • 2022 • Automatic",
                active: true
            }
        ];

        res.json({
            success: true,
            vehicles: featuredVehicles.filter(v => v.active)
        });

    } catch (error) {
        logger.error('Error fetching featured vehicles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured vehicles',
            vehicles: []
        });
    }
});

// GET /api/dashboard/account-manager - Get account manager info for dealer
router.get('/account-manager', authenticateToken, async (req, res) => {
    try {
        // For now, return placeholder data
        // TODO: Implement dealer-specific account manager assignment
        const accountManager = {
            name: "J.C. Lopez",
            title: "Broker Finance Sales",
            email: "financebrokerdealss@gmail.com",
            phone: "(786) 731 - 8403",
            address: "Miami, Florida",
            officeAddress: "346 Washington Street, Stoughton,MA02072",
            photo: "/images/account-manager-placeholder.jpg"
        };

        res.json({
            success: true,
            accountManager: accountManager
        });

    } catch (error) {
        logger.error('Error fetching account manager:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account manager info'
        });
    }
});

// GET /api/dashboard/stats - Get dashboard statistics for dealer
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { dealerLicenseNumber, finNumber } = req.dealerIdentifier;
        
        const deals = await dashboardService.getDealsForDealer(dealerLicenseNumber, finNumber);
        
        // Calculate statistics
        const stats = {
            totalDeals: deals.length,
            pendingDeals: deals.filter(d => ['New Deal Submitted', 'Underwriting', 'Pending Docs'].includes(d.status)).length,
            approvedDeals: deals.filter(d => ['Conditional Approval', 'Final Approval'].includes(d.status)).length,
            fundedDeals: deals.filter(d => d.status === 'Deal Funded').length,
            declinedDeals: deals.filter(d => d.status === 'Declined').length,
            totalVolume: deals.reduce((sum, deal) => sum + (deal.monetaryValue || 0), 0),
            averageDealSize: deals.length > 0 ? deals.reduce((sum, deal) => sum + (deal.monetaryValue || 0), 0) / deals.length : 0
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        logger.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics'
        });
    }
});

module.exports = router;
