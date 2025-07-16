// routes/dashboardRoutes.js - REFACTORED FOR NEW SYSTEM
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, authenticatePremiumDealer, requirePermission } = require('../middleware/auth');
const dashboardService = require('../services/dashboardService');
const db = require('../services/databaseService');
const ghlApiService = require('../services/ghlApiService');
const { logger, logBusiness, logSecurity } = require('../utils/logger');

// ===== MULTER CONFIGURATION FOR PROFILE PICTURES =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/profile-pictures');
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: dealerId-timestamp.extension
        const extension = path.extname(file.originalname);
        const filename = `${req.user.id}-${Date.now()}${extension}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// ===== GET DEALER DASHBOARD DATA =====
router.get('/', 
    authenticateToken,
    requirePermission('view_own_dashboard'),
    async (req, res) => {
        try {
            const dealer = req.user;
            
            logBusiness('Dashboard access', {
                dealerId: dealer.id,
                dealerName: dealer.dealerName,
                subscriptionTier: dealer.subscriptionTier
            });

            const dashboardData = await dashboardService.getDealerDashboardData(dealer);

            res.json({
                success: true,
                dashboard: dashboardData
            });

        } catch (error) {
            logger.error('Dashboard data fetch error:', {
                error: error.message,
                dealerId: req.user ? req.user.id : null,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard data'
            });
        }
    }
);

// ===== GET DEALER STATISTICS =====
router.get('/stats', 
    authenticateToken,
    requirePermission('view_own_dashboard'),
    async (req, res) => {
        try {
            const dealer = req.user;
            const { timeframe = '30d' } = req.query;

            const stats = await dashboardService.getDealerPerformanceMetrics(dealer, timeframe);

            res.json({
                success: true,
                statistics: stats,
                dealer: {
                    name: dealer.dealerName,
                    tier: dealer.subscriptionTier
                }
            });

        } catch (error) {
            logger.error('Dashboard stats error:', {
                error: error.message,
                dealerId: req.user ? req.user.id : null
            });

            res.status(500).json({
                success: false,
                message: 'Failed to fetch statistics'
            });
        }
    }
);

// ===== GET RECENT APPLICATIONS =====
router.get('/recent-applications', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const dealer = req.user;
            const { limit = 10 } = req.query;

            const applications = await db.getDealerApplications(dealer.id, parseInt(limit));
            
            // Format for dashboard display
            const formattedApps = applications.map(app => ({
                id: app.id,
                applicantName: app.applicantName,
                vehicleInfo: app.vehicleInfo,
                amountFinanced: app.amountFinanced,
                status: app.status,
                dtStatus: app.dtStatus,
                createdAt: app.createdAt,
                timeAgo: getTimeAgo(app.createdAt),
                urgency: calculateUrgency(app)
            }));

            res.json({
                success: true,
                applications: formattedApps
            });

        } catch (error) {
            logger.error('Recent applications error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recent applications'
            });
        }
    }
);

// ===== GET ACTIVITY FEED =====
router.get('/activity', 
    authenticateToken,
    requirePermission('view_own_dashboard'),
    async (req, res) => {
        try {
            const dealer = req.user;
            const { limit = 20 } = req.query;

            const applications = await db.getDealerApplications(dealer.id, 50);
            const recentActivity = await dashboardService.getRecentActivity(dealer.id, applications);

            res.json({
                success: true,
                activity: recentActivity.slice(0, parseInt(limit))
            });

        } catch (error) {
            logger.error('Activity feed error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch activity feed'
            });
        }
    }
);

// ===== PREMIUM: GET GHL DASHBOARD DATA =====
router.get('/ghl-data', 
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            const dealer = req.user;

            if (!dealer.ghlIntegrationEnabled) {
                return res.status(403).json({
                    success: false,
                    message: 'GHL integration not enabled'
                });
            }

            const applications = await db.getDealerApplications(dealer.id, 100);
            const ghlData = await dashboardService.getGHLDashboardData(dealer, applications);

            logBusiness('GHL dashboard access', {
                dealerId: dealer.id,
                integratedApps: ghlData.integratedApplications || 0
            });

            res.json({
                success: true,
                ghlData: ghlData
            });

        } catch (error) {
            logger.error('GHL dashboard data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch GHL data'
            });
        }
    }
);

// ===== GET DEALER PROFILE FOR DASHBOARD =====
router.get('/profile', 
    authenticateToken,
    async (req, res) => {
        try {
            const dealer = req.user;
            
            // Get additional profile stats
            const applications = await db.getDealerApplications(dealer.id, 10);
            const stats = {
                totalApplications: applications.length,
                pendingApplications: applications.filter(app => app.status === 'submitted').length,
                lastApplicationDate: applications.length > 0 ? applications[0].createdAt : null,
                memberSince: dealer.createdAt,
                lastLogin: dealer.lastLogin
            };

            const profileData = {
                dealer: {
                    id: dealer.id,
                    email: dealer.email,
                    dealerName: dealer.dealerName,
                    contactName: dealer.contactName,
                    phone: dealer.phone,
                    address: dealer.address,
                    dealerLicenseNumber: dealer.dealerLicenseNumber,
                    finNumber: dealer.finNumber,
                    subscriptionTier: dealer.subscriptionTier,
                    ghlIntegrationEnabled: dealer.ghlIntegrationEnabled,
                    profilePictureUrl: dealer.profilePictureUrl,
                    stats: stats
                },
                features: {
                    canSubmitApplications: true,
                    canViewApplications: true,
                    canManageProfile: true,
                    hasBasicReporting: true,
                    hasAdvancedReporting: dealer.subscriptionTier === 'premium',
                    hasGHLIntegration: dealer.subscriptionTier === 'premium' && dealer.ghlIntegrationEnabled,
                    hasMarketingTools: dealer.subscriptionTier === 'premium'
                }
            };

            res.json({
                success: true,
                profile: profileData
            });

        } catch (error) {
            logger.error('Dashboard profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch profile data'
            });
        }
    }
);

// ===== UPDATE DEALER PROFILE =====
router.put('/profile', 
    authenticateToken,
    requirePermission('manage_own_profile'),
    upload.single('profilePicture'), // Add multer middleware for file upload
    async (req, res) => {
        try {
            const dealer = req.user;
            const { contactName, phone, address, dealerName, email } = req.body;

            // Debug logging
            logger.info('Profile update request received', {
                dealerId: dealer.id,
                hasFile: !!req.file,
                bodyKeys: Object.keys(req.body),
                fileName: req.file ? req.file.filename : null
            });

            // Validate input
            const updates = {};
            if (contactName && contactName.trim()) updates.contactName = contactName.trim();
            if (phone && phone.trim()) updates.phone = phone.trim();
            if (address && address.trim()) updates.address = address.trim();
            if (dealerName && dealerName.trim()) updates.dealerName = dealerName.trim();
            if (email && email.trim()) updates.email = email.trim();

            // Handle profile picture upload
            let profilePictureUrl = null;
            if (req.file) {
                // Delete old profile picture if it exists
                if (dealer.profilePictureUrl) {
                    const oldImagePath = path.join(__dirname, '../', dealer.profilePictureUrl);
                    if (fs.existsSync(oldImagePath)) {
                        try {
                            fs.unlinkSync(oldImagePath);
                        } catch (err) {
                            logger.warn('Failed to delete old profile picture:', err);
                        }
                    }
                }

                // Set new profile picture URL
                profilePictureUrl = `uploads/profile-pictures/${req.file.filename}`;
                updates.profilePictureUrl = profilePictureUrl;
                
                logBusiness('Profile picture uploaded', {
                    dealerId: dealer.id,
                    filename: req.file.filename,
                    fileSize: req.file.size
                });
            }

            // Check if we have any updates (either form fields or file upload)
            if (Object.keys(updates).length === 0 && !req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid updates provided'
                });
            }

            // Only update database if we have actual field updates
            let updatedDealer = dealer;
            if (Object.keys(updates).length > 0) {
                updatedDealer = await db.updateDealer(dealer.id, updates);
            }

            logBusiness('Profile updated', {
                dealerId: dealer.id,
                updatedFields: Object.keys(updates)
            });

            res.json({
                success: true,
                message: 'Profile updated successfully',
                profilePictureUrl: profilePictureUrl, // Include this for frontend update
                dealer: {
                    id: updatedDealer.id,
                    email: updatedDealer.email,
                    dealerName: updatedDealer.dealerName,
                    contactName: updatedDealer.contactName,
                    phone: updatedDealer.phone,
                    address: updatedDealer.address,
                    subscriptionTier: updatedDealer.subscriptionTier,
                    profilePictureUrl: updatedDealer.profilePictureUrl
                }
            });

        } catch (error) {
            // Clean up uploaded file if database update fails
            if (req.file) {
                const filePath = path.join(__dirname, '../uploads/profile-pictures', req.file.filename);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (err) {
                        logger.warn('Failed to cleanup uploaded file:', err);
                    }
                }
            }

            logger.error('Profile update error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update profile'
            });
        }
    }
);

// ===== GET SYSTEM HEALTH (ADMIN) =====
router.get('/health', 
    authenticateToken,
    async (req, res) => {
        try {
            const health = await dashboardService.getSystemHealth();
            
            res.json({
                success: true,
                health: health
            });

        } catch (error) {
            logger.error('System health check error:', error);
            res.status(500).json({
                success: false,
                message: 'Health check failed',
                health: {
                    status: 'unhealthy',
                    error: error.message
                }
            });
        }
    }
);

// ===== PREMIUM: GHL WORKFLOW TRIGGERS =====
router.post('/ghl/trigger-workflow', 
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            const dealer = req.user;
            const { contactId, workflowType, data } = req.body;

            if (!dealer.ghlIntegrationEnabled) {
                return res.status(403).json({
                    success: false,
                    message: 'GHL integration not enabled'
                });
            }

            if (!contactId || !workflowType) {
                return res.status(400).json({
                    success: false,
                    message: 'Contact ID and workflow type are required'
                });
            }

            // Verify contact belongs to this dealer
            const applications = await db.getDealerApplications(dealer.id, 1000);
            const application = applications.find(app => app.ghlMarketingContactId === contactId);
            
            if (!application) {
                logSecurity('Unauthorized GHL access attempt', {
                    dealerId: dealer.id,
                    contactId: contactId,
                    workflowType: workflowType
                });
                
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this contact'
                });
            }

            // Trigger the workflow
            await ghlApiService.triggerWorkflow(contactId, workflowType, data);

            // Log the workflow trigger
            await db.addConversationNote(application.id, {
                content: `GHL workflow triggered: ${workflowType}`,
                noteType: 'system_note',
                createdBy: dealer.id,
                createdByName: dealer.contactName,
                createdByType: 'dealer',
                importanceLevel: 'normal'
            });

            logBusiness('GHL workflow triggered', {
                dealerId: dealer.id,
                applicationId: application.id,
                workflowType: workflowType,
                contactId: contactId
            });

            res.json({
                success: true,
                message: 'Workflow triggered successfully'
            });

        } catch (error) {
            logger.error('GHL workflow trigger error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to trigger workflow'
            });
        }
    }
);

// ===== EXPORT DASHBOARD DATA =====
router.get('/export', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const dealer = req.user;
            const { format = 'json', timeframe = '30d' } = req.query;

            if (format !== 'json') {
                return res.status(400).json({
                    success: false,
                    message: 'Only JSON format is currently supported'
                });
            }

            const applications = await db.getDealerApplications(dealer.id, 1000);
            const stats = await dashboardService.getDealerPerformanceMetrics(dealer, timeframe);

            const exportData = {
                dealer: {
                    name: dealer.dealerName,
                    contactName: dealer.contactName,
                    email: dealer.email,
                    licenseNumber: dealer.dealerLicenseNumber,
                    subscriptionTier: dealer.subscriptionTier
                },
                statistics: stats,
                applications: applications.map(app => ({
                    id: app.id,
                    applicantName: app.applicantName,
                    vehicleInfo: app.vehicleInfo,
                    amountFinanced: app.amountFinanced,
                    status: app.status,
                    dtStatus: app.dtStatus,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt
                })),
                exportedAt: new Date().toISOString(),
                exportedBy: dealer.contactName
            };

            logBusiness('Dashboard data exported', {
                dealerId: dealer.id,
                format: format,
                applicationCount: applications.length
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="dashboard-export-${dealer.id}-${Date.now()}.json"`);
            res.json(exportData);

        } catch (error) {
            logger.error('Dashboard export error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export dashboard data'
            });
        }
    }
);

// ===== UTILITY FUNCTIONS =====
function getTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function calculateUrgency(application) {
    const now = new Date();
    const created = new Date(application.createdAt);
    const hoursSinceCreated = (now - created) / (1000 * 60 * 60);
    
    if (application.status === 'submitted' && hoursSinceCreated > 24) {
        return 'high';
    } else if (application.status === 'processing' && hoursSinceCreated > 48) {
        return 'high';
    } else if (hoursSinceCreated > 12) {
        return 'medium';
    }
    return 'low';
}

module.exports = router;