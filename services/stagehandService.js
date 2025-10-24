// services/stagehandService.js
// Stagehand automation service for browser-based form filling

const { Stagehand } = require('@browserbasehq/stagehand');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('./databaseService');

class StagehandService {
    constructor() {
        this.browserbaseApiKey = config.BROWSERBASE_API_KEY;
        this.browserbaseProjectId = config.BROWSERBASE_PROJECT_ID;
        this.enabled = config.STAGEHAND_ENABLED;
    }

    /**
     * Submit credit application to a lender using Stagehand
     */
    async submitToLender(submissionId, lenderUrl, lenderName, applicationData) {
        if (!this.enabled) {
            throw new Error('Stagehand automation is not enabled');
        }

        if (!this.browserbaseApiKey || !this.browserbaseProjectId) {
            throw new Error('BrowserBase credentials not configured');
        }

        logger.info('Starting Stagehand automation', {
            submissionId,
            lenderName,
            lenderUrl
        });

        let stagehand;
        try {
            // Initialize Stagehand with BrowserBase + Anthropic Claude
            stagehand = new Stagehand({
                apiKey: this.browserbaseApiKey,
                projectId: this.browserbaseProjectId,
                env: 'BROWSERBASE',
                modelName: 'claude-3-5-sonnet-20241022',
                modelApiKey: config.ANTHROPIC_API_KEY,
                verbose: 1, // Enable logging
                debugDom: false
            });

            await stagehand.init();

            logger.info('Stagehand initialized, navigating to lender page', {
                lenderUrl
            });

            // Navigate to lender application page
            await stagehand.page.goto(lenderUrl);
            await stagehand.page.waitForLoadState('networkidle', { timeout: 30000 });

            logger.info('Page loaded, starting form filling', {
                submissionId
            });

            // Format application data
            const formData = this._formatApplicationData(applicationData);

            // Use Stagehand's AI vision to fill the form
            // No brittle CSS selectors - it understands the page like a human!

            // Personal Information
            if (formData.firstName) {
                await stagehand.act(`Fill in the first name field with ${formData.firstName}`);
            }

            if (formData.lastName) {
                await stagehand.act(`Fill in the last name field with ${formData.lastName}`);
            }

            if (formData.email) {
                await stagehand.act(`Fill in the email address field with ${formData.email}`);
            }

            if (formData.phone) {
                await stagehand.act(`Fill in the phone number field with ${formData.phone}`);
            }

            if (formData.ssn) {
                await stagehand.act(`Fill in the social security number field with ${formData.ssn}`);
            }

            if (formData.dateOfBirth) {
                await stagehand.act(`Fill in the date of birth field with ${formData.dateOfBirth}`);
            }

            // Address Information
            if (formData.address) {
                await stagehand.act(`Fill in the street address field with ${formData.address}`);
            }

            if (formData.city) {
                await stagehand.act(`Fill in the city field with ${formData.city}`);
            }

            if (formData.state) {
                await stagehand.act(`Fill in the state field with ${formData.state}`);
            }

            if (formData.zipCode) {
                await stagehand.act(`Fill in the zip code field with ${formData.zipCode}`);
            }

            // Employment Information
            if (formData.employerName) {
                await stagehand.act(`Fill in the employer name field with ${formData.employerName}`);
            }

            if (formData.annualIncome) {
                await stagehand.act(`Fill in the annual income field with ${formData.annualIncome}`);
            }

            if (formData.employmentStatus) {
                await stagehand.act(`Select ${formData.employmentStatus} for employment status`);
            }

            // Vehicle Information
            if (formData.vehicleYear) {
                await stagehand.act(`Fill in the vehicle year field with ${formData.vehicleYear}`);
            }

            if (formData.vehicleMake) {
                await stagehand.act(`Fill in the vehicle make field with ${formData.vehicleMake}`);
            }

            if (formData.vehicleModel) {
                await stagehand.act(`Fill in the vehicle model field with ${formData.vehicleModel}`);
            }

            if (formData.vehicleVin) {
                await stagehand.act(`Fill in the VIN field with ${formData.vehicleVin}`);
            }

            // Loan Information
            if (formData.loanAmount) {
                await stagehand.act(`Fill in the loan amount field with ${formData.loanAmount}`);
            }

            if (formData.downPayment) {
                await stagehand.act(`Fill in the down payment field with ${formData.downPayment}`);
            }

            logger.info('Form filling complete, submitting', {
                submissionId
            });

            // Submit the form
            await stagehand.act('Click the submit button');

            // Wait for response page
            await stagehand.page.waitForLoadState('networkidle', { timeout: 60000 });

            logger.info('Form submitted, extracting results', {
                submissionId
            });

            // Extract the result using Stagehand's AI
            const result = await stagehand.extract({
                instruction: 'Extract the loan application status, any approval/decline message, loan terms if approved, and confirmation number if provided',
                schema: {
                    status: 'string (approved, pending, declined, or error)',
                    message: 'string - the main message or response from the lender',
                    confirmationNumber: 'string - application or reference number if provided',
                    loanTerms: {
                        apr: 'number - APR percentage if approved',
                        amount: 'number - approved loan amount if provided',
                        term: 'number - loan term in months if provided',
                        monthlyPayment: 'number - monthly payment if provided'
                    },
                    actionRequired: 'string - any additional information or documents needed'
                }
            });

            // Take screenshot for debugging
            const screenshot = await stagehand.page.screenshot({
                fullPage: true,
                type: 'png'
            });

            const screenshotBase64 = screenshot.toString('base64');

            logger.info('Results extracted successfully', {
                submissionId,
                status: result.status,
                hasLoanTerms: !!result.loanTerms
            });

            // Update submission in database
            const updateData = {
                status: this._normalizeStatus(result.status),
                respondedAt: new Date().toISOString()
            };

            if (result.loanTerms && result.loanTerms.apr) {
                updateData.loanTerms = {
                    apr: result.loanTerms.apr,
                    amount: result.loanTerms.amount || formData.loanAmount,
                    term: result.loanTerms.term || 60,
                    monthlyPayment: result.loanTerms.monthlyPayment,
                    totalCost: result.loanTerms.monthlyPayment
                        ? result.loanTerms.monthlyPayment * (result.loanTerms.term || 60)
                        : null
                };
            }

            if (result.actionRequired) {
                updateData.actionItems = [{
                    description: result.actionRequired,
                    completed: false,
                    createdAt: new Date().toISOString()
                }];
            }

            await db.updateSubmissionStatus(submissionId, updateData.status, updateData);

            // Update lender stats
            if (result.status === 'approved' || result.status === 'declined') {
                const submission = await db.getSubmissionById(submissionId);
                if (submission && submission.lenderId) {
                    await db.updateLenderStats(submission.lenderId, result.status);
                }
            }

            return {
                success: true,
                submissionId,
                status: result.status,
                message: result.message,
                confirmationNumber: result.confirmationNumber,
                loanTerms: result.loanTerms,
                screenshot: screenshotBase64
            };

        } catch (error) {
            logger.error('Stagehand automation error', {
                submissionId,
                lenderName,
                error: error.message,
                stack: error.stack
            });

            // Update submission with error status
            await db.updateSubmissionStatus(submissionId, 'error', {
                errorMessage: error.message,
                errorAt: new Date().toISOString()
            });

            throw error;

        } finally {
            // Always close Stagehand
            if (stagehand) {
                try {
                    await stagehand.close();
                    logger.info('Stagehand closed', { submissionId });
                } catch (closeError) {
                    logger.error('Error closing Stagehand', {
                        error: closeError.message
                    });
                }
            }
        }
    }

    /**
     * Submit to multiple lenders in parallel
     */
    async submitToMultipleLenders(applicationId, lenderIds) {
        const application = await db.getApplicationById(applicationId);
        if (!application) {
            throw new Error('Application not found');
        }

        const lenders = [];
        for (const lenderId of lenderIds) {
            const lender = await db.getLenderById(lenderId);
            if (lender && lender.active) {
                lenders.push(lender);
            }
        }

        if (lenders.length === 0) {
            throw new Error('No active lenders found');
        }

        logger.info('Starting parallel lender submissions', {
            applicationId,
            lenderCount: lenders.length
        });

        // Create submission records
        const submissions = [];
        for (const lender of lenders) {
            const submission = await db.createSubmission({
                dealerId: application.dealerId,
                applicationId: application.id,
                lenderId: lender.id,
                lenderUrl: lender.url,
                lenderName: lender.name,
                status: 'pending',
                applicationData: application.applicantData || application
            });
            submissions.push({ submission, lender });
        }

        // Process submissions in parallel (with concurrency limit)
        const maxConcurrent = config.AUTOFILL_MAX_CONCURRENT_LENDERS || 5;
        const results = [];

        for (let i = 0; i < submissions.length; i += maxConcurrent) {
            const batch = submissions.slice(i, i + maxConcurrent);

            const batchResults = await Promise.allSettled(
                batch.map(({ submission, lender }) =>
                    this.submitToLender(
                        submission.id,
                        lender.url,
                        lender.name,
                        submission.applicationData
                    )
                )
            );

            results.push(...batchResults);
        }

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const errorCount = results.filter(r => r.status === 'rejected').length;

        logger.info('Parallel submissions complete', {
            applicationId,
            total: results.length,
            successful: successCount,
            errors: errorCount
        });

        return {
            total: results.length,
            successful: successCount,
            errors: errorCount,
            results: results.map((r, i) => ({
                submissionId: submissions[i].submission.id,
                lenderName: submissions[i].lender.name,
                status: r.status,
                result: r.status === 'fulfilled' ? r.value : null,
                error: r.status === 'rejected' ? r.reason.message : null
            }))
        };
    }

    /**
     * Format application data for form filling
     */
    _formatApplicationData(applicationData) {
        const appData = applicationData.applicantData || applicationData.applicant || applicationData;

        return {
            // Personal Info
            firstName: appData.borrower1_firstName || appData.firstName,
            lastName: appData.borrower1_lastName || appData.lastName,
            email: appData.borrower1_email || appData.email,
            phone: appData.borrower1_phone || appData.phone,
            ssn: appData.borrower1_ssn || appData.ssn,
            dateOfBirth: appData.borrower1_dob || appData.dateOfBirth,

            // Address
            address: appData.borrower1_address || appData.address,
            city: appData.borrower1_city || appData.city,
            state: appData.borrower1_state || appData.state,
            zipCode: appData.borrower1_zip || appData.zipCode,

            // Employment
            employerName: appData.borrower1_employer || appData.employerName,
            annualIncome: this._parseIncome(appData.borrower1_income || appData.annualIncome),
            employmentStatus: appData.borrower1_employmentStatus || appData.employmentStatus || 'Employed',

            // Vehicle
            vehicleYear: appData.vehicle_year || appData.vehicleYear,
            vehicleMake: appData.vehicle_make || appData.vehicleMake,
            vehicleModel: appData.vehicle_model || appData.vehicleModel,
            vehicleVin: appData.vehicle_vin || appData.vehicleVin,

            // Loan
            loanAmount: appData.loan_amount || appData.loanAmount,
            downPayment: appData.down_payment || appData.downPayment || 0
        };
    }

    /**
     * Parse income string to annual amount
     */
    _parseIncome(incomeStr) {
        if (!incomeStr) return null;

        const amount = parseFloat(String(incomeStr).replace(/[^0-9.]/g, ''));
        if (isNaN(amount)) return null;

        // If less than 10000, assume monthly and convert to annual
        if (amount < 10000) {
            return amount * 12;
        }

        return amount;
    }

    /**
     * Normalize status from various formats
     */
    _normalizeStatus(status) {
        if (!status) return 'pending';

        const statusLower = status.toLowerCase();

        if (statusLower.includes('approv')) return 'approved';
        if (statusLower.includes('declin') || statusLower.includes('denied')) return 'declined';
        if (statusLower.includes('pending') || statusLower.includes('review')) return 'pending';
        if (statusLower.includes('error')) return 'error';

        return 'pending';
    }
}

module.exports = new StagehandService();
