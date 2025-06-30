// routes/applicationRoutes.js - REFACTORED FOR NEW SYSTEM
const express = require('express');
const router = express.Router();
const { authenticateToken, authenticatePremiumDealer, requirePermission, logSecurityEvent } = require('../middleware/auth');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const db = require('../services/databaseService');
const ghlApiService = require('../services/ghlApiService');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Utility functions
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
}

function extractMarketingData(formData) {
    // Extract marketing-safe data for GHL (no sensitive financial info)
    return {
        firstName: formData.borrower1_firstName || '',
        lastName: formData.borrower1_lastName || '',
        email: formData.borrower1_email || '',
        phone: formData.borrower1_cellPhone || '',
        
        // Vehicle information
        vehicleYear: formData.vehicle_year || '',
        vehicleMake: formData.vehicle_make_model ? formData.vehicle_make_model.split(' ')[0] : '',
        vehicleModel: formData.vehicle_make_model || '',
        vehicleMileage: formData.vehicle_mileage || '',
        
        // Basic demographics (no sensitive financial data)
        residenceZip: formData.borrower1_address_zip || '',
        residenceType: formData.borrower1_residence_type || '',
        employer: formData.borrower1_current_employer || '',
        employmentType: formData.borrower1_employment_type || '',
        
        // Deal context
        amountFinanced: formData.amountFinanced || '',
        downPayment: formData.total_down || formData.downPayment || '',
        tradeValue: formData.trade_value || '0',
        
        // Source tracking
        dealerSource: '', // Will be filled in with dealer info
        applicationDate: new Date().toISOString()
    };
}

function encryptSensitiveData(formData) {
    // In production, implement proper AES encryption
    // For now, just flag sensitive fields
    const sensitiveFields = {
        ssn: formData.borrower1_ssn,
        driversLicense: formData.borrower1_drivers_license,
        detailedIncome: formData.borrower1_gross_monthly_income,
        bankInfo: formData.bank_information,
        previousAddresses: formData.previous_addresses,
        references: formData.personal_references
    };
    
    // TODO: Implement actual encryption
    return {
        encryptedData: JSON.stringify(sensitiveFields),
        encryptionKeyId: 'default',
        encryptedAt: new Date().toISOString()
    };
}

// ===== SUBMIT CREDIT APPLICATION =====
router.post('/submit', 
    authenticateToken,
    requirePermission('submit_applications'),
    logSecurityEvent('application_submit'),
    async (req, res) => {
        try {
            const formData = req.body;
            const dealer = req.user;
            const clientIP = getClientIP(req);

            // Validate required fields
            const requiredFields = [
                'borrower1_firstName',
                'borrower1_lastName', 
                'borrower1_email',
                'borrower1_cellPhone',
                'vehicle_year',
                'vehicle_make_model',
                'amountFinanced'
            ];

            const missingFields = requiredFields.filter(field => !formData[field]);
            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields',
                    missingFields: missingFields
                });
            }

            // Create application record
            const applicationData = {
                dealerId: dealer.id,
                dealerName: dealer.dealerName,
                dealerLicenseNumber: dealer.dealerLicenseNumber,
                finNumber: dealer.finNumber,
                
                // Basic application info (unencrypted for dashboard display)
                applicantName: `${formData.borrower1_firstName} ${formData.borrower1_lastName}`,
                applicantEmail: formData.borrower1_email,
                vehicleInfo: `${formData.vehicle_year} ${formData.vehicle_make_model}`,
                amountFinanced: parseFloat(formData.amountFinanced) || 0,
                downPayment: parseFloat(formData.total_down || formData.downPayment || 0),
                
                // Encrypted sensitive data
                ...encryptSensitiveData(formData),
                
                // Status tracking
                status: 'submitted',
                dtStatus: 'pending',
                submittedFrom: clientIP,
                
                // GHL integration fields (for premium dealers)
                ghlMarketingContactId: null,
                ghlOpportunityId: null
            };

            // Store application in database
            const application = await db.createApplication(applicationData);

            // Add initial conversation log
            await db.addConversationNote(application.id, {
                content: `Credit application submitted for ${application.applicantName}. Vehicle: ${application.vehicleInfo}, Amount: $${application.amountFinanced.toLocaleString()}`,
                noteType: 'system_note',
                createdBy: 'system',
                createdByName: 'System',
                importanceLevel: 'normal'
            });

            // Premium dealers: Create GHL marketing contact and opportunity
            if (dealer.subscriptionTier === 'premium' && dealer.ghlIntegrationEnabled) {
                try {
                    const marketingData = extractMarketingData(formData);
                    marketingData.dealerSource = dealer.dealerName;

                    // Create GHL contact
                    const ghlContact = await ghlApiService.createContact({
                        ...marketingData,
                        tags: [
                            `dealer_${dealer.dealerName.replace(/\s+/g, '_')}`,
                            'credit_application',
                            'auto_finance_lead'
                        ],
                        source: `Credit Application - ${dealer.dealerName}`,
                        customFields: {
                            dealer_name: dealer.dealerName,
                            application_id: application.id,
                            subscription_tier: dealer.subscriptionTier
                        }
                    });

                    if (ghlContact && ghlContact.id) {
                        // Create GHL opportunity
                        const ghlOpportunity = await ghlApiService.createOpportunity({
                            contactId: ghlContact.id,
                            name: `${application.applicantName} - ${application.vehicleInfo}`,
                            monetaryValue: application.amountFinanced,
                            status: 'open',
                            source: dealer.dealerName,
                            customFields: {
                                vehicle_info: application.vehicleInfo,
                                down_payment: application.downPayment,
                                dealer_license: dealer.dealerLicenseNumber
                            }
                        });

                        // Update application with GHL IDs
                        await db.updateApplication(application.id, {
                            ghlMarketingContactId: ghlContact.id,
                            ghlOpportunityId: ghlOpportunity ? ghlOpportunity.id : null
                        });

                        // Add conversation note about GHL integration
                        await db.addConversationNote(application.id, {
                            content: `Marketing contact created in GHL CRM. Contact ID: ${ghlContact.id}`,
                            noteType: 'system_note',
                            createdBy: 'system',
                            createdByName: 'GHL Integration'
                        });

                        logger.info(`GHL contact created for application ${application.id}: ${ghlContact.id}`);
                    }
                } catch (ghlError) {
                    logger.error('GHL integration error:', ghlError);
                    // Don't fail the application if GHL fails
                    await db.addConversationNote(application.id, {
                        content: `GHL integration warning: ${ghlError.message}`,
                        noteType: 'system_note',
                        createdBy: 'system',
                        createdByName: 'GHL Integration',
                        importanceLevel: 'high'
                    });
                }
            }

            // Send confirmation email to dealer
            try {
                await emailService.sendApplicationNotification(
                    dealer.email,
                    dealer.dealerName,
                    {
                        applicantName: application.applicantName,
                        vehicleInfo: application.vehicleInfo,
                        amountFinanced: application.amountFinanced,
                        id: application.id,
                        createdAt: application.createdAt
                    },
                    'Application received and is being processed. You will be notified of any status updates.'
                );
            } catch (emailError) {
                logger.warn('Failed to send confirmation email:', emailError);
                // Don't fail the application if email fails
            }

            logger.info(`Application submitted: ${application.id} by dealer: ${dealer.email}`);

            res.status(201).json({
                success: true,
                message: 'Credit application submitted successfully',
                application: {
                    id: application.id,
                    applicantName: application.applicantName,
                    vehicleInfo: application.vehicleInfo,
                    amountFinanced: application.amountFinanced,
                    status: application.status,
                    dtStatus: application.dtStatus,
                    createdAt: application.createdAt,
                    ghlIntegrated: dealer.subscriptionTier === 'premium' && !!application.ghlMarketingContactId
                }
            });

        } catch (error) {
            logger.error('Application submission error:', {
                error: error.message,
                dealerId: req.user ? req.user.id : null,
                ip: getClientIP(req)
            });

            res.status(500).json({
                success: false,
                message: 'Failed to submit application. Please try again.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// ===== GET DEALER APPLICATIONS =====
router.get('/', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const dealer = req.user;
            const { limit = 20, status, page = 1 } = req.query;

            const applications = await db.getDealerApplications(
                dealer.id, 
                parseInt(limit), 
                status
            );

            // Add conversation counts for each application
            const applicationsWithCounts = await Promise.all(
                applications.map(async (app) => {
                    const conversations = await db.getConversationsByApplicationId(app.id);
                    return {
                        ...app,
                        conversationCount: conversations.length,
                        lastActivity: conversations.length > 0 ? 
                            conversations[conversations.length - 1].timestamp : app.createdAt
                    };
                })
            );

            res.json({
                success: true,
                applications: applicationsWithCounts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: applications.length
                },
                dealer: {
                    name: dealer.dealerName,
                    tier: dealer.subscriptionTier
                }
            });

        } catch (error) {
            logger.error('Get applications error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch applications'
            });
        }
    }
);

// ===== GET APPLICATION DETAILS (DEAL JACKET) =====
router.get('/:applicationId', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const dealer = req.user;

            const application = await db.getApplicationById(applicationId);
            if (!application) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            // Verify dealer owns this application
            if (application.dealerId !== dealer.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this application'
                });
            }

            // Get conversation history
            const conversations = await db.getConversationsByApplicationId(applicationId);

            // Format for deal jacket display
            const dealJacket = {
                application: {
                    id: application.id,
                    applicantName: application.applicantName,
                    applicantEmail: application.applicantEmail,
                    vehicleInfo: application.vehicleInfo,
                    amountFinanced: application.amountFinanced,
                    downPayment: application.downPayment,
                    status: application.status,
                    dtStatus: application.dtStatus,
                    dtReference: application.dtReferenceNumber,
                    createdAt: application.createdAt,
                    updatedAt: application.updatedAt
                },
                conversations: conversations.map(conv => ({
                    id: conv.id,
                    type: conv.noteType,
                    content: conv.content,
                    createdBy: conv.createdByName,
                    timestamp: conv.timestamp,
                    isSystem: conv.createdBy === 'system',
                    importance: conv.importanceLevel
                })),
                dealer: {
                    name: dealer.dealerName,
                    tier: dealer.subscriptionTier
                },
                features: {
                    canAddNotes: true,
                    ghlIntegration: dealer.subscriptionTier === 'premium' && !!application.ghlMarketingContactId,
                    dtIntegration: true
                }
            };

            res.json({
                success: true,
                dealJacket: dealJacket
            });

        } catch (error) {
            logger.error('Get application details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch application details'
            });
        }
    }
);

// ===== ADD CONVERSATION NOTE =====
router.post('/:applicationId/conversations', 
    authenticateToken,
    requirePermission('add_conversation_notes'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { content, notifyStakeholders = false } = req.body;
            const dealer = req.user;

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

            // Verify dealer owns this application
            if (application.dealerId !== dealer.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this application'
                });
            }

            // Add conversation note
            const conversation = await db.addConversationNote(applicationId, {
                content: content.trim(),
                noteType: 'dealer_note',
                createdBy: dealer.id,
                createdByName: dealer.contactName,
                createdByType: 'dealer',
                importanceLevel: 'normal'
            });

            // If premium dealer and GHL integrated, sync note to GHL
            if (dealer.subscriptionTier === 'premium' && application.ghlMarketingContactId) {
                try {
                    await ghlApiService.addContactNote(
                        application.ghlMarketingContactId,
                        `Dealer Note: ${content}`,
                        'Pinnacle Portal'
                    );
                    
                    // Mark as synced
                    await db.updateApplication(applicationId, {
                        ghlSynced: true
                    });
                } catch (ghlError) {
                    logger.warn('Failed to sync note to GHL:', ghlError);
                }
            }

            logger.info(`Conversation note added to application ${applicationId} by dealer ${dealer.email}`);

            res.status(201).json({
                success: true,
                message: 'Note added successfully',
                conversation: {
                    id: conversation.id,
                    content: conversation.content,
                    createdBy: conversation.createdByName,
                    timestamp: conversation.timestamp,
                    type: conversation.noteType
                }
            });

        } catch (error) {
            logger.error('Add conversation note error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add note'
            });
        }
    }
);

// ===== GET APPLICATION STATUS =====
router.get('/:applicationId/status', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const dealer = req.user;

            const application = await db.getApplicationById(applicationId);
            if (!application || application.dealerId !== dealer.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            res.json({
                success: true,
                status: {
                    applicationStatus: application.status,
                    dtStatus: application.dtStatus,
                    dtReference: application.dtReferenceNumber,
                    lastUpdate: application.updatedAt,
                    progress: {
                        submitted: true,
                        processing: application.dtStatus !== 'pending',
                        decision: ['approved', 'declined', 'funded'].includes(application.dtStatus),
                        completed: application.dtStatus === 'funded'
                    }
                }
            });

        } catch (error) {
            logger.error('Get application status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch application status'
            });
        }
    }
);

// ===== PREMIUM FEATURE: TRIGGER GHL WORKFLOW =====
router.post('/:applicationId/trigger-workflow', 
    authenticatePremiumDealer,
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { workflowType, data } = req.body;
            const dealer = req.user;

            const application = await db.getApplicationById(applicationId);
            if (!application || application.dealerId !== dealer.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            if (!application.ghlMarketingContactId) {
                return res.status(400).json({
                    success: false,
                    message: 'Application not integrated with GHL'
                });
            }

            // Trigger GHL workflow
            try {
                await ghlApiService.triggerWorkflow(
                    application.ghlMarketingContactId,
                    workflowType,
                    data
                );

                // Log the workflow trigger
                await db.addConversationNote(applicationId, {
                    content: `GHL workflow triggered: ${workflowType}`,
                    noteType: 'system_note',
                    createdBy: dealer.id,
                    createdByName: dealer.contactName,
                    createdByType: 'dealer'
                });

                res.json({
                    success: true,
                    message: 'Workflow triggered successfully'
                });

            } catch (ghlError) {
                logger.error('GHL workflow trigger error:', ghlError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to trigger workflow'
                });
            }

        } catch (error) {
            logger.error('Trigger workflow error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to trigger workflow'
            });
        }
    }
);

// ===== EXPORT APPLICATION DATA =====
router.get('/:applicationId/export', 
    authenticateToken,
    requirePermission('view_own_applications'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { format = 'json' } = req.query;
            const dealer = req.user;

            const application = await db.getApplicationById(applicationId);
            if (!application || application.dealerId !== dealer.id) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            const conversations = await db.getConversationsByApplicationId(applicationId);

            const exportData = {
                application: {
                    id: application.id,
                    applicantName: application.applicantName,
                    vehicleInfo: application.vehicleInfo,
                    amountFinanced: application.amountFinanced,
                    status: application.status,
                    dtStatus: application.dtStatus,
                    createdAt: application.createdAt
                },
                conversations: conversations,
                dealer: {
                    name: dealer.dealerName,
                    licenseNumber: dealer.dealerLicenseNumber
                },
                exportedAt: new Date().toISOString(),
                exportedBy: dealer.contactName
            };

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="application-${applicationId}.json"`);
                res.json(exportData);
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Unsupported export format'
                });
            }

        } catch (error) {
            logger.error('Export application error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export application data'
            });
        }
    }
);

module.exports = router;