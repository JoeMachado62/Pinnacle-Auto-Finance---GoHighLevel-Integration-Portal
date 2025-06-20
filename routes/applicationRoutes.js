// /var/www/paf-ghl/routes/applicationRoutes.js
console.log('[DEBUG] Entering routes/applicationRoutes.js');
const express = require('express');
console.log('[DEBUG] routes/applicationRoutes.js: Express loaded.');
const router = express.Router();
console.log('[DEBUG] routes/applicationRoutes.js: Router initialized.');

const ghlApiService = require('../services/ghlApiService');
console.log('[DEBUG] routes/applicationRoutes.js: ghlApiService loaded.');

const logger = require('../utils/logger');
console.log('[DEBUG] routes/applicationRoutes.js: Logger loaded.');

const config = require('../config');
console.log('[DEBUG] routes/applicationRoutes.js: Config loaded.');

const authMiddleware = require('../middleware/auth');
console.log('[DEBUG] routes/applicationRoutes.js: authMiddleware loaded.');

console.log('[DEBUG] routes/applicationRoutes.js: About to define validateApplicationData function.');
// --- Server-Side Validation Helper ---
// THIS IS ILLUSTRATIVE. For 173 fields, use a schema validation library (e.g., Zod, Joi).
function validateApplicationData(data) {
    const errors = [];

    // Helper to check for required fields
    const checkRequired = (fieldName, readableName) => {
        if (data[fieldName] === undefined || data[fieldName] === null || String(data[fieldName]).trim() === '') {
            errors.push(`${readableName} is required.`);
        }
    };

    // Helper for simple format checks (extend as needed)
    const checkFormat = (fieldName, regex, readableName, formatDesc) => {
        if (data[fieldName] && !regex.test(String(data[fieldName]))) {
            errors.push(`Invalid format for ${readableName}. Expected ${formatDesc}.`);
        }
    };
    
    // --- Primary Borrower Essentials ---
    // HTML form sends first/last name separately, not as borrower1_applicant
    checkRequired('borrower1_firstName', 'Primary Applicant First Name');
    checkRequired('borrower1_lastName', 'Primary Applicant Last Name');
    checkRequired('borrower1_dob', 'Primary Applicant Date of Birth');
    checkRequired('borrower1_ssn', 'Primary Applicant SSN');
    checkFormat('borrower1_ssn', /^\d{9}$/, 'Primary Applicant SSN', '9 digits');
    checkRequired('borrower1_drivers_license', 'Primary Applicant Driver\'s License');
    checkRequired('borrower1_cellPhone', 'Primary Applicant Cell Phone');
    checkRequired('borrower1_email', 'Primary Applicant Email');
    
    // Address Information
    checkRequired('borrower1_current_address', 'Primary Applicant Current Address');
    checkRequired('borrower1_current_address_years', 'Primary Applicant Current Address Years');
    checkRequired('borrower1_current_address_months', 'Primary Applicant Current Address Months');
    
    // Employment Information
    checkRequired('borrower1_current_employer', 'Primary Applicant Current Employer');
    checkRequired('borrower1_title', 'Primary Applicant Job Title');
    checkRequired('borrower1_employer_address', 'Primary Applicant Employer Address');
    checkRequired('borrower1_income', 'Primary Applicant Income');
    checkRequired('borrower1_employment_years', 'Primary Applicant Employment Years');
    checkRequired('borrower1_employment_months', 'Primary Applicant Employment Months');

    // --- Conditional Primary Borrower History ---
    const b1CurrentYears = parseInt(data.borrower1_current_address_years, 10) || 0;
    if (b1CurrentYears < 2) { // If less than 2 years at current address
        checkRequired('borrower1_previous_address_1', 'Primary Applicant Previous Address 1');
        checkRequired('borrower1_prev_address_1_years', 'Primary Applicant Previous Address 1 Years');
        checkRequired('borrower1_prev_address_1_months', 'Primary Applicant Previous Address 1 Months');
    }
    
    // Employment history validation
    const b1EmploymentYears = parseInt(data.borrower1_employment_years, 10) || 0;
    if (b1EmploymentYears < 2) { // If less than 2 years at current job
        checkRequired('borrower1_previous_employer_1', 'Primary Applicant Previous Employer 1');
        checkRequired('borrower1_prev_employer_1_title', 'Primary Applicant Previous Employer 1 Title');
        checkRequired('borrower1_prev_employer_1_address', 'Primary Applicant Previous Employer 1 Address');
        checkRequired('borrower1_prev_employment_1_years', 'Primary Applicant Previous Employment 1 Years');
        checkRequired('borrower1_prev_employment_1_months', 'Primary Applicant Previous Employment 1 Months');
    }

    // --- Co-Borrower (if present) ---
    // Check if co-borrower data is being submitted
    if (data.borrower2_firstName || data.borrower2_lastName) {
        checkRequired('borrower2_firstName', 'Co-Borrower First Name');
        checkRequired('borrower2_lastName', 'Co-Borrower Last Name');
        checkRequired('borrower2_dob', 'Co-Borrower Date of Birth');
        checkRequired('borrower2_ssn', 'Co-Borrower SSN');
        checkFormat('borrower2_ssn', /^\d{9}$/, 'Co-Borrower SSN', '9 digits');
        checkRequired('borrower2_drivers_license', 'Co-Borrower Driver\'s License');
        checkRequired('borrower2_cellPhone', 'Co-Borrower Cell Phone');
        checkRequired('borrower2_email', 'Co-Borrower Email');
        
        // Co-Borrower Address Information
        checkRequired('borrower2_current_address', 'Co-Borrower Current Address');
        checkRequired('borrower2_current_address_years', 'Co-Borrower Current Address Years');
        checkRequired('borrower2_current_address_months', 'Co-Borrower Current Address Months');
        
        // Co-Borrower Employment Information
        checkRequired('borrower2_current_employer', 'Co-Borrower Current Employer');
        checkRequired('borrower2_title', 'Co-Borrower Job Title');
        checkRequired('borrower2_employer_address', 'Co-Borrower Employer Address');
        checkRequired('borrower2_income', 'Co-Borrower Income');
        checkRequired('borrower2_employment_years', 'Co-Borrower Employment Years');
        checkRequired('borrower2_employment_months', 'Co-Borrower Employment Months');
        
        // Co-Borrower conditional history
        const b2CurrentYears = parseInt(data.borrower2_current_address_years, 10) || 0;
        if (b2CurrentYears < 2) {
            checkRequired('borrower2_previous_address_1', 'Co-Borrower Previous Address 1');
            checkRequired('borrower2_prev_address_1_years', 'Co-Borrower Previous Address 1 Years');
            checkRequired('borrower2_prev_address_1_months', 'Co-Borrower Previous Address 1 Months');
        }
        
        const b2EmploymentYears = parseInt(data.borrower2_employment_years, 10) || 0;
        if (b2EmploymentYears < 2) {
            checkRequired('borrower2_previous_employer_1', 'Co-Borrower Previous Employer 1');
            checkRequired('borrower2_prev_employer_1_title', 'Co-Borrower Previous Employer 1 Title');
            checkRequired('borrower2_prev_employer_1_address', 'Co-Borrower Previous Employer 1 Address');
            checkRequired('borrower2_prev_employment_1_years', 'Co-Borrower Previous Employment 1 Years');
            checkRequired('borrower2_prev_employment_1_months', 'Co-Borrower Previous Employment 1 Months');
        }
    }

    // --- Vehicle Information ---
    checkRequired('vehicle_year', 'Vehicle Year');
    checkRequired('vehicle_make_model', 'Vehicle Make & Model');
    checkRequired('vehicle_vin', 'Vehicle VIN');
    checkRequired('vehicle_mileage', 'Vehicle Mileage');

    // --- Terms Information ---
    checkRequired('selling_price', 'Selling Price');
    checkRequired('amountFinanced', 'Amount Financed'); // This field name is correct in HTML
    const numericAmount = parseFloat(String(data.amountFinanced || '').replace(/[$,]/g, ''));
    if (isNaN(numericAmount)) {
        errors.push('Amount Financed must be a valid number.');
    }
    // ... more terms fields ...

    // --- Dealer Section ---
    checkRequired('dealer_name', 'Dealer Name');
    checkRequired('dealer_telephone', 'Dealer Telephone');
    checkRequired('dealer_contact', 'Dealer Contact Person');

    // --- Dealer Attestation ---
    if (!data.dealer_attestation || data.dealer_attestation === 'false' || data.dealer_attestation === false) {
        errors.push('Dealer attestation is required.');
    }
    checkRequired('signature_date', 'Signature Date for Attestation');


    if (errors.length > 0) {
        return { isValid: false, errors };
    }
    return { isValid: true };
}
console.log('[DEBUG] routes/applicationRoutes.js: validateApplicationData function defined.');

console.log('[DEBUG] routes/applicationRoutes.js: About to define /submit route.');
// POST /api/credit-application/submit - Requires authentication
router.post('/submit', authMiddleware.authenticateToken, async (req, res) => {
    const formData = req.body;
    const dealer = req.user; // From auth middleware
    
    logger.info(`Received credit application submission from dealer: ${dealer.dealerName} (${dealer.username})`);
    
    // Automatically inject dealer information into the application
    const enhancedFormData = {
        ...formData,
        // Override/ensure dealer fields are set from authenticated user
        dealer_name: dealer.dealerName,
        dealer_license_number: dealer.dealerLicenseNumber || dealer.finNumber,
        dealer_contact: dealer.contactName,
        dealer_email: dealer.email,
        dealer_phone: dealer.phone,
        dealer_address: dealer.address,
        // Add dealer tracking fields for GHL
        submitting_dealer_id: dealer.userId,
        submitting_dealer_ghl_contact_id: dealer.ghlContactId,
        submission_timestamp: new Date().toISOString()
    };

    // Avoid logging full formData in production if it contains too much PII
    if (config.NODE_ENV === 'development') {
        logger.debug('Enhanced formData with dealer info:', JSON.stringify(enhancedFormData, null, 2));
    }

    const validationResult = validateApplicationData(enhancedFormData);
    if (!validationResult.isValid) {
        logger.warn(`Credit application validation failed for dealer ${dealer.dealerName}:`, { 
            errors: validationResult.errors,
            dealerName: dealer.dealerName,
            dealerLicense: dealer.dealerLicenseNumber
        });
        return res.status(400).json({ 
            message: 'Validation failed. Please check your input.',
            errors: validationResult.errors 
        });
    }

    try {
        logger.info(`Creating GHL Contact for application from dealer: ${dealer.dealerName}`);
        const contactId = await ghlApiService.createGhlContact(enhancedFormData);
        logger.info(`GHL Contact created with ID: ${contactId} for dealer: ${dealer.dealerName}`);

        logger.info(`Creating GHL Opportunity for contact ID: ${contactId}, dealer: ${dealer.dealerName}`);
        const opportunityId = await ghlApiService.createGhlOpportunity(contactId, enhancedFormData);
        logger.info(`GHL Opportunity created with ID: ${opportunityId} for dealer: ${dealer.dealerName}`);

        logger.info(`Application submitted successfully - Dealer: ${dealer.dealerName}, Opportunity: ${opportunityId}, Contact: ${contactId}`);
        
        res.status(201).json({
            message: 'Credit application submitted successfully!',
            contactId: contactId,
            opportunityId: opportunityId,
            dealerName: dealer.dealerName
        });

    } catch (error) {
        logger.error(`Error processing credit application for dealer ${dealer.dealerName}:`, { 
            message: error.message,
            dealerName: dealer.dealerName,
            dealerLicense: dealer.dealerLicenseNumber
        });
        
        // Check if it's a GHL API error re-thrown from the service
        let clientErrorMessage = 'An error occurred while processing your application.';
        let statusCode = 500;

        if (error.message.includes("GHL Status")) {
            clientErrorMessage = `Application processing error: ${error.message}`;
            const match = error.message.match(/GHL Status: (\d+)/);
            if (match && match[1]) {
                statusCode = parseInt(match[1], 10);
                if (statusCode < 400 || statusCode >= 500) statusCode = 500;
                if (statusCode >= 400 && statusCode < 500) statusCode = 400;
            }
        } else if (error.message.includes("Validation failed")) {
            statusCode = 400;
            clientErrorMessage = error.message;
        }
        
        res.status(statusCode).json({ 
            message: clientErrorMessage,
            ...(config.NODE_ENV === 'development' && { errorDetails: error.toString() })
        });
    }
});

console.log('[DEBUG] Exiting routes/applicationRoutes.js - Router configured and exported.');
module.exports = router;
