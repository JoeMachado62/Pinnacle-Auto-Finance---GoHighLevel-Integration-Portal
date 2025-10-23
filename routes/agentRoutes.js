// routes/agentRoutes.js
// API routes for Pinnacle Autofill Agent

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const autofillAgentService = require('../services/autofillAgentService');
const db = require('../services/databaseService');
const { logger } = require('../utils/logger');

/**
 * POST /api/agent/generate-plan
 * Generate an automation plan for filling out a lender form
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
    try {
        const { applicationId, lenderUrl, domContext } = req.body;
        const dealerId = req.user.id;

        // Validate input
        if (!applicationId || !lenderUrl) {
            return res.status(400).json({
                success: false,
                message: 'Application ID and lender URL are required'
            });
        }

        // Get application data
        const application = await db.getApplicationById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Verify ownership
        if (application.dealerId !== dealerId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to application'
            });
        }

        logger.info(`Generating automation plan for dealer ${dealerId}, application ${applicationId}, lender: ${lenderUrl}`);

        // Generate automation plan using Claude Opus
        const result = await autofillAgentService.generateAutomationPlan(
            application,
            lenderUrl,
            domContext
        );

        // Validate the generated plan
        const validation = autofillAgentService.validatePlan(result.plan);
        if (!validation.valid) {
            logger.error('Generated plan validation failed:', validation.errors);
            return res.status(500).json({
                success: false,
                message: 'Generated plan is invalid',
                errors: validation.errors
            });
        }

        // Create a pending submission record
        const submission = await db.createSubmission({
            dealerId,
            applicationId,
            lenderUrl,
            lenderName: extractDomainName(lenderUrl),
            status: 'pending',
            automationPlan: result.plan
        });

        res.json({
            success: true,
            plan: result.plan,
            submissionId: submission.id,
            model: result.model,
            usage: result.usage
        });

    } catch (error) {
        logger.error('Error generating automation plan:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate automation plan'
        });
    }
});

/**
 * POST /api/agent/log-submission
 * Log a submission attempt from the Chrome extension
 */
router.post('/log-submission', authenticateToken, async (req, res) => {
    try {
        const { applicationId, lenderUrl, status, errorMessage, userInterventions, submittedAt } = req.body;
        const dealerId = req.user.id;

        // Validate input
        if (!applicationId || !lenderUrl || !status) {
            return res.status(400).json({
                success: false,
                message: 'Application ID, lender URL, and status are required'
            });
        }

        // Check if submission already exists
        const existingSubmissions = await db.getSubmissionsByDealer(dealerId, { applicationId });
        const existingSubmission = existingSubmissions.submissions.find(
            s => s.lenderUrl === lenderUrl && s.status === 'pending'
        );

        let submission;
        if (existingSubmission) {
            // Update existing submission
            submission = await db.updateSubmissionStatus(existingSubmission.id, status, {
                errorMessage,
                submittedAt
            });

            if (userInterventions) {
                for (let i = 0; i < userInterventions; i++) {
                    await db.incrementUserInterventions(existingSubmission.id);
                }
            }
        } else {
            // Create new submission
            submission = await db.createSubmission({
                dealerId,
                applicationId,
                lenderUrl,
                lenderName: extractDomainName(lenderUrl),
                status,
                errorMessage,
                userInterventions: userInterventions || 0,
                submittedAt
            });
        }

        logger.info(`Submission logged: ${submission.id} - Status: ${status}`);

        res.json({
            success: true,
            submission
        });

    } catch (error) {
        logger.error('Error logging submission:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to log submission'
        });
    }
});

/**
 * GET /api/agent/submissions
 * Get all submissions for the authenticated dealer
 */
router.get('/submissions', authenticateToken, async (req, res) => {
    try {
        const dealerId = req.user.id;
        const { status, applicationId, limit, offset } = req.query;

        const submissions = await db.getSubmissionsByDealer(dealerId, {
            status,
            applicationId,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });

        res.json({
            success: true,
            submissions: submissions.submissions,
            total: submissions.total,
            hasMore: submissions.hasMore
        });

    } catch (error) {
        logger.error('Error fetching submissions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch submissions'
        });
    }
});

/**
 * GET /api/agent/submissions/:id
 * Get a specific submission by ID
 */
router.get('/submissions/:id', authenticateToken, async (req, res) => {
    try {
        const dealerId = req.user.id;
        const submissionId = req.params.id;

        const submission = await db.getSubmissionById(submissionId);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Verify ownership
        if (submission.dealerId !== dealerId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to submission'
            });
        }

        res.json({
            success: true,
            submission
        });

    } catch (error) {
        logger.error('Error fetching submission:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch submission'
        });
    }
});

/**
 * PATCH /api/agent/submissions/:id
 * Update a submission status (for manual status updates from dashboard)
 */
router.patch('/submissions/:id', authenticateToken, async (req, res) => {
    try {
        const dealerId = req.user.id;
        const submissionId = req.params.id;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'submitted', 'approved', 'declined', 'error'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const submission = await db.getSubmissionById(submissionId);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Verify ownership
        if (submission.dealerId !== dealerId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to submission'
            });
        }

        // Update status
        const updatedSubmission = await db.updateSubmissionStatus(submissionId, status);

        logger.info(`Submission ${submissionId} status manually updated to ${status} by dealer ${dealerId}`);

        res.json({
            success: true,
            submission: updatedSubmission
        });

    } catch (error) {
        logger.error('Error updating submission:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update submission'
        });
    }
});

/**
 * DELETE /api/agent/submissions/:id
 * Delete a submission
 */
router.delete('/submissions/:id', authenticateToken, async (req, res) => {
    try {
        const dealerId = req.user.id;
        const submissionId = req.params.id;

        const submission = await db.getSubmissionById(submissionId);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Verify ownership
        if (submission.dealerId !== dealerId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to submission'
            });
        }

        await db.deleteSubmission(submissionId);

        logger.info(`Submission ${submissionId} deleted by dealer ${dealerId}`);

        res.json({
            success: true,
            message: 'Submission deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting submission:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete submission'
        });
    }
});

/**
 * GET /api/agent/stats
 * Get submission statistics for the authenticated dealer
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const dealerId = req.user.id;

        const stats = await db.getSubmissionStats(dealerId);

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Error fetching submission stats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch submission stats'
        });
    }
});

// Helper function to extract domain name from URL
function extractDomainName(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch (error) {
        return url;
    }
}

module.exports = router;
