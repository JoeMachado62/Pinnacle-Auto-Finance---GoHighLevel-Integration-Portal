// routes/adminRoutes.js - ADMIN PANEL ROUTES
const express = require('express');
const router = express.Router();
const { authenticateAdmin, requirePermission, logSecurityEvent } = require('../middleware/auth');
const db = require('../services/databaseService');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const ghlUserService = require('../services/ghlUserService');
const { logger, logBusiness, logSecurity } = require('../utils/logger');

// Utility functions
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
}

// ===== ADMIN DASHBOARD DATA =====
router.get('/dashboard', 
    authenticateAdmin,
    requirePermission('access_admin_panel'),
    logSecurityEvent('admin_dashboard_access'),
    async (req, res) => {
        try {
            // Get all dealers
            const dealers = await db.getAllDealers();
            
            // Get all applications with dealer info
            const applications = await db.getApplicationsWithDealerInfo(50);
            
            // Calculate statistics
            const stats = {
                totalDealers: dealers.length,
                activeDealers: dealers.filter(d => d.status === 'active').length,
                totalApplications: applications.length,
                pendingApplications: applications.filter(app => app.status === 'submitted').length,
                approvedApplications: applications.filter(app => app.status === 'approved').length,
                rejectedApplications: applications.filter(app => app.status === 'rejected').length,
                basicTierDealers: dealers.filter(d => d.subscriptionTier === 'basic').length,
                premiumTierDealers: dealers.filter(d => d.subscriptionTier === 'premium').length
            };

            // Recent activity (last 10 applications)
            const recentApplications = applications.slice(0, 10).map(app => ({
                id: app.id,
                applicantName: app.applicantName,
                dealerName: app.dealerInfo?.dealerName || 'Unknown',
                status: app.status,
                amountFinanced: app.amountFinanced,
                createdAt: app.createdAt
            }));

            logBusiness('Admin dashboard accessed', {
                adminId: req.user.id,
                adminEmail: req.user.email,
                ip: getClientIP(req)
            });

            res.json({
                success: true,
                data: {
                    stats,
                    recentApplications,
                    dealerCount: dealers.length,
                    applicationCount: applications.length
                }
            });

        } catch (error) {
            logger.error('Admin dashboard error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard data'
            });
        }
    }
);

// ===== VIEW ALL APPLICATIONS =====
router.get('/applications',
    authenticateAdmin,
    requirePermission('view_all_applications'),
    async (req, res) => {
        try {
            const {
                limit = 50,
                status,
                dealerId,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                search
            } = req.query;

            const filters = {
                status,
                dealerId,
                sortBy,
                sortOrder
            };

            let applications = await db.getApplicationsWithDealerInfo(parseInt(limit), filters);

            // Apply search filter if provided
            if (search) {
                const searchLower = search.toLowerCase();
                applications = applications.filter(app => 
                    app.applicantName?.toLowerCase().includes(searchLower) ||
                    app.dealerInfo?.dealerName?.toLowerCase().includes(searchLower) ||
                    app.vehicle_make_model?.toLowerCase().includes(searchLower) ||
                    app.borrower1_email?.toLowerCase().includes(searchLower)
                );
            }

            logBusiness('Admin viewed all applications', {
                adminId: req.user.id,
                filters,
                resultCount: applications.length
            });

            res.json({
                success: true,
                data: {
                    applications,
                    count: applications.length,
                    filters
                }
            });

        } catch (error) {
            logger.error('Admin applications view error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch applications'
            });
        }
    }
);

// ===== VIEW ALL DEALERS =====
router.get('/dealers',
    authenticateAdmin,
    requirePermission('view_all_dealers'),
    async (req, res) => {
        try {
            const dealers = await db.getAllDealers();
            
            // Get application counts for each dealer
            const dealersWithStats = await Promise.all(dealers.map(async (dealer) => {
                const applications = await db.getDealerApplications(dealer.id, 1000);
                return {
                    ...dealer,
                    stats: {
                        totalApplications: applications.length,
                        pendingApplications: applications.filter(app => app.status === 'submitted').length,
                        approvedApplications: applications.filter(app => app.status === 'approved').length,
                        rejectedApplications: applications.filter(app => app.status === 'rejected').length,
                        lastApplicationDate: applications.length > 0 ? applications[0].createdAt : null
                    }
                };
            }));

            logBusiness('Admin viewed all dealers', {
                adminId: req.user.id,
                dealerCount: dealers.length
            });

            res.json({
                success: true,
                data: {
                    dealers: dealersWithStats,
                    count: dealersWithStats.length
                }
            });

        } catch (error) {
            logger.error('Admin dealers view error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dealers'
            });
        }
    }
);

// ===== VIEW SPECIFIC DEALER =====
router.get('/dealers/:dealerId',
    authenticateAdmin,
    requirePermission('view_all_dealers'),
    async (req, res) => {
        try {
            const { dealerId } = req.params;
            const dealer = await db.getDealerById(dealerId);
            
            if (!dealer) {
                return res.status(404).json({
                    success: false,
                    message: 'Dealer not found'
                });
            }

            const applications = await db.getDealerApplications(dealerId, 100);

            logBusiness('Admin viewed specific dealer', {
                adminId: req.user.id,
                targetDealerId: dealerId,
                dealerName: dealer.dealerName
            });

            res.json({
                success: true,
                data: {
                    dealer,
                    applications,
                    stats: {
                        totalApplications: applications.length,
                        pendingApplications: applications.filter(app => app.status === 'submitted').length,
                        approvedApplications: applications.filter(app => app.status === 'approved').length,
                        rejectedApplications: applications.filter(app => app.status === 'rejected').length
                    }
                }
            });

        } catch (error) {
            logger.error('Admin dealer view error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dealer information'
            });
        }
    }
);

// ===== UPDATE DEALER SUBSCRIPTION =====
router.put('/dealers/:dealerId/subscription',
    authenticateAdmin,
    requirePermission('manage_dealer_subscriptions'),
    async (req, res) => {
        try {
            const { dealerId } = req.params;
            const { subscriptionTier } = req.body;

            if (!['basic', 'premium'].includes(subscriptionTier)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subscription tier'
                });
            }

            const updatedDealer = await db.updateDealer(dealerId, { 
                subscriptionTier,
                updatedAt: new Date().toISOString()
            });

            if (!updatedDealer) {
                return res.status(404).json({
                    success: false,
                    message: 'Dealer not found'
                });
            }

            logSecurity('Admin updated dealer subscription', {
                adminId: req.user.id,
                adminEmail: req.user.email,
                targetDealerId: dealerId,
                newSubscriptionTier: subscriptionTier,
                ip: getClientIP(req)
            });

            res.json({
                success: true,
                message: 'Dealer subscription updated successfully',
                dealer: updatedDealer
            });

        } catch (error) {
            logger.error('Admin subscription update error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update dealer subscription'
            });
        }
    }
);

// ===== UPDATE APPLICATION STATUS =====
router.put('/applications/:applicationId/status',
    authenticateAdmin,
    requirePermission('view_all_applications'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { status, notes } = req.body;

            if (!['submitted', 'approved', 'rejected', 'processing'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
            }

            const application = await db.getApplicationById(applicationId);
            if (!application) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            const updates = {
                status,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: req.user.id
            };

            if (notes) {
                updates.adminNotes = notes;
            }

            const updatedApplication = await db.updateApplication(applicationId, updates);

            // Add conversation note about status change
            await db.addConversationNote(applicationId, {
                content: `Application status updated from "${application.status}" to "${status}" by administrator. ${notes ? 'Note: ' + notes : ''}`,
                noteType: 'system_note',
                createdBy: req.user.id,
                createdByName: `Admin: ${req.user.contactName || req.user.dealerName || 'Administrator'}`,
                createdByType: 'admin',
                importanceLevel: 'high'
            });

            // Send email notification to dealer about status change
            try {
                const dealer = await db.getDealerById(application.dealerId);
                if (dealer && dealer.email) {
                    await emailService.sendStatusUpdateNotification(
                        dealer.email,
                        dealer.dealerName,
                        {
                            id: application.id,
                            applicantName: application.applicantName,
                            vehicleInfo: application.vehicleInfo,
                            amountFinanced: application.amountFinanced
                        },
                        {
                            oldStatus: application.status,
                            newStatus: status,
                            notes: notes
                        }
                    );
                }
            } catch (emailError) {
                logger.warn('Failed to send status update notification:', emailError);
            }

            logSecurity('Admin updated application status', {
                adminId: req.user.id,
                adminEmail: req.user.email,
                applicationId,
                oldStatus: application.status,
                newStatus: status,
                ip: getClientIP(req)
            });

            res.json({
                success: true,
                message: 'Application status updated successfully',
                application: updatedApplication
            });

        } catch (error) {
            logger.error('Admin application update error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update application status'
            });
        }
    }
);

// ===== ADD ADMIN CONVERSATION NOTE =====
router.post('/applications/:applicationId/conversations',
    authenticateAdmin,
    requirePermission('view_all_applications'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { content, notifyStakeholders = false } = req.body;

            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Note content is required'
                });
            }

            const application = await db.getApplicationById(applicationId);
            if (!application) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            // Add admin conversation note
            const conversation = await db.addConversationNote(applicationId, {
                content: content.trim(),
                noteType: 'admin_note',
                createdBy: req.user.id,
                createdByName: `Admin: ${req.user.contactName || req.user.dealerName || 'Administrator'}`,
                createdByType: 'admin',
                importanceLevel: 'high',
                notifyStakeholders: notifyStakeholders
            });

            // Send email notification to dealer about admin note
            if (notifyStakeholders) {
                try {
                    const dealer = await db.getDealerById(application.dealerId);
                    if (dealer && dealer.email) {
                        await emailService.sendAdminNoteNotification(
                            dealer.email,
                            dealer.dealerName,
                            {
                                id: application.id,
                                applicantName: application.applicantName,
                                vehicleInfo: application.vehicleInfo
                            },
                            {
                                content: conversation.content,
                                createdByName: conversation.createdByName,
                                timestamp: conversation.timestamp
                            }
                        );
                    }
                } catch (emailError) {
                    logger.warn('Failed to send admin note notification:', emailError);
                }
            }

            logSecurity('Admin added conversation note', {
                adminId: req.user.id,
                applicationId,
                contentLength: content.length,
                ip: getClientIP(req)
            });

            res.status(201).json({
                success: true,
                message: 'Admin note added successfully',
                conversation: {
                    id: conversation.id,
                    content: conversation.content,
                    createdBy: conversation.createdByName,
                    timestamp: conversation.timestamp,
                    type: conversation.noteType
                }
            });

        } catch (error) {
            logger.error('Admin add conversation note error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add admin note'
            });
        }
    }
);

// ===== SYSTEM STATISTICS =====
router.get('/stats',
    authenticateAdmin,
    requirePermission('view_financial_reports'),
    async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            
            // Calculate date range
            const now = new Date();
            let startDate;
            switch (period) {
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90d':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            const allApplications = await db.getAllApplications(1000);
            const periodApplications = allApplications.filter(app => 
                new Date(app.createdAt) >= startDate
            );

            const dealers = await db.getAllDealers();

            const stats = {
                period,
                applications: {
                    total: periodApplications.length,
                    approved: periodApplications.filter(app => app.status === 'approved').length,
                    rejected: periodApplications.filter(app => app.status === 'rejected').length,
                    pending: periodApplications.filter(app => app.status === 'submitted').length,
                    totalFinanceAmount: periodApplications.reduce((sum, app) => 
                        sum + (parseFloat(app.amountFinanced) || 0), 0
                    ),
                    averageFinanceAmount: periodApplications.length > 0 ? 
                        periodApplications.reduce((sum, app) => sum + (parseFloat(app.amountFinanced) || 0), 0) / periodApplications.length : 0
                },
                dealers: {
                    total: dealers.length,
                    active: dealers.filter(d => d.status === 'active').length,
                    basic: dealers.filter(d => d.subscriptionTier === 'basic').length,
                    premium: dealers.filter(d => d.subscriptionTier === 'premium').length
                }
            };

            logBusiness('Admin viewed system statistics', {
                adminId: req.user.id,
                period
            });

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Admin stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch system statistics'
            });
        }
    }
);

// ===== GHL REGISTRATION MANAGEMENT =====

// Get all pending GHL registrations
router.get('/ghl-registrations/pending',
    authenticateAdmin,
    requirePermission('access_admin_panel'),
    async (req, res) => {
        try {
            const pendingRegistrations = await ghlUserService.getPendingRegistrations();
            
            // Enrich with dealer information
            const enrichedRegistrations = await Promise.all(
                pendingRegistrations.map(async (registration) => {
                    const dealer = await db.getDealerById(registration.dealerId);
                    return {
                        ...registration,
                        dealerInfo: dealer ? {
                            id: dealer.id,
                            dealerName: dealer.dealerName,
                            contactName: dealer.contactName,
                            subscriptionTier: dealer.subscriptionTier,
                            status: dealer.status
                        } : null
                    };
                })
            );
            
            logBusiness('Admin viewed pending GHL registrations', {
                adminId: req.user.id,
                count: pendingRegistrations.length
            });
            
            res.json({
                success: true,
                data: enrichedRegistrations,
                count: enrichedRegistrations.length
            });
        } catch (error) {
            logger.error('Error getting pending GHL registrations:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch pending GHL registrations'
            });
        }
    }
);

// Approve GHL registration
router.post('/ghl-registrations/:dealerId/approve',
    authenticateAdmin,
    requirePermission('manage_dealer_accounts'),
    async (req, res) => {
        try {
            const { dealerId } = req.params;
            const adminId = req.user.id;
            const adminName = req.user.contactName || req.user.dealerName || 'Administrator';
            
            logger.info(`Admin ${adminName} approving GHL registration for dealer: ${dealerId}`);
            
            // Approve the registration and create GHL user account
            const result = await ghlUserService.approveGhlRegistration(dealerId, adminName);
            
            logSecurity('Admin approved GHL registration', {
                adminId,
                adminName,
                dealerId,
                ghlUserId: result.ghlUserId,
                registrationId: result.registration.id,
                ip: getClientIP(req)
            });
            
            res.json({
                success: true,
                message: 'GHL registration approved and user account created',
                data: {
                    registrationId: result.registration.id,
                    ghlUserId: result.ghlUserId,
                    status: result.registration.status
                }
            });
        } catch (error) {
            logger.error('Error approving GHL registration:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to approve GHL registration',
                error: error.message
            });
        }
    }
);

// Reject GHL registration
router.post('/ghl-registrations/:dealerId/reject',
    authenticateAdmin,
    requirePermission('manage_dealer_accounts'),
    async (req, res) => {
        try {
            const { dealerId } = req.params;
            const { reason = 'Registration rejected by admin' } = req.body;
            const adminId = req.user.id;
            const adminName = req.user.contactName || req.user.dealerName || 'Administrator';
            
            logger.info(`Admin ${adminName} rejecting GHL registration for dealer: ${dealerId}`);
            
            // Update registration status to rejected
            const registration = await db.updateGhlRegistrationStatus(dealerId, 'rejected', {
                rejectedBy: adminName,
                rejectionReason: reason,
                rejectedAt: new Date().toISOString()
            });
            
            logSecurity('Admin rejected GHL registration', {
                adminId,
                adminName,
                dealerId,
                registrationId: registration.id,
                reason,
                ip: getClientIP(req)
            });
            
            res.json({
                success: true,
                message: 'GHL registration rejected',
                data: {
                    registrationId: registration.id,
                    status: registration.status,
                    reason
                }
            });
        } catch (error) {
            logger.error('Error rejecting GHL registration:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reject GHL registration',
                error: error.message
            });
        }
    }
);

// Get GHL registration details
router.get('/ghl-registrations/:dealerId',
    authenticateAdmin,
    requirePermission('access_admin_panel'),
    async (req, res) => {
        try {
            const { dealerId } = req.params;
            
            const registration = await db.getGhlRegistrationByDealerId(dealerId);
            if (!registration) {
                return res.status(404).json({
                    success: false,
                    message: 'GHL registration not found'
                });
            }
            
            const dealer = await db.getDealerById(dealerId);
            
            res.json({
                success: true,
                data: {
                    ...registration,
                    dealerInfo: dealer ? {
                        id: dealer.id,
                        dealerName: dealer.dealerName,
                        contactName: dealer.contactName,
                        subscriptionTier: dealer.subscriptionTier,
                        status: dealer.status
                    } : null
                }
            });
        } catch (error) {
            logger.error('Error getting GHL registration details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch GHL registration details'
            });
        }
    }
);

module.exports = router;