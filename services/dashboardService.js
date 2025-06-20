// /var/www/paf-ghl/services/dashboardService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const ghlApi = axios.create({
    baseURL: config.GHL_API_BASE_URL,
    headers: {
        'Authorization': `Bearer ${config.GHL_API_KEY}`,
        'Version': config.GHL_API_VERSION,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 15000,
});

class DashboardService {
    
    async getDealsForDealer(dealerLicenseNumber, finNumber) {
        try {
            logger.info(`Fetching deals for dealer - License: ${dealerLicenseNumber}, FIN: ${finNumber}`);
            logger.info(`Using GHL_LOCATION_ID: ${config.GHL_LOCATION_ID}, GHL_DEALS_PIPELINE_ID: ${config.GHL_DEALS_PIPELINE_ID}`);

            // Get all opportunities from the Pinnacle Pipeline
            const opportunitiesResponse = await ghlApi.get('/opportunities/search', {
                params: {
                    locationId: config.GHL_LOCATION_ID,
                    pipelineId: config.GHL_DEALS_PIPELINE_ID,
                    limit: 100 // Adjust as needed
                }
            });

            const opportunities = opportunitiesResponse.data.opportunities || [];
            logger.info(`Found ${opportunities.length} total opportunities in pipeline`);

            // Filter opportunities for this dealer and get contact details
            const dealerDeals = [];
            
            for (const opportunity of opportunities) {
                try {
                    // Get the contact details for this opportunity
                    const contactResponse = await ghlApi.get(`/contacts/${opportunity.contactId}`);
                    const contact = contactResponse.data.contact;

                    // Check if this deal belongs to the current dealer
                    const contactDealerLicense = this.getCustomFieldValue(contact.customFields, 'dealer_license_number');
                    const contactFinNumber = this.getCustomFieldValue(contact.customFields, 'fin_number');

                    const isMatchingDealer = 
                        (dealerLicenseNumber && contactDealerLicense === dealerLicenseNumber) ||
                        (finNumber && contactFinNumber === finNumber);

                    if (isMatchingDealer) {
                        // Get pipeline stage name
                        const stageName = await this.getStageNameById(opportunity.pipelineStageId);
                        
                        // Extract relevant data for dashboard display
                        const dealData = {
                            opportunityId: opportunity.id,
                            contactId: opportunity.contactId,
                            clientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
                            startDate: this.formatDate(opportunity.dateAdded),
                            status: stageName || 'Unknown',
                            nextAction: this.determineNextAction(stageName),
                            vin: this.getCustomFieldValue(contact.customFields, 'vehicle_vin') || 'N/A',
                            loanNumber: opportunity.id.slice(-6), // Use last 6 chars of opportunity ID as loan number
                            messageCount: 0, // TODO: Implement message counting
                            lastMessage: 'No messages', // TODO: Implement last message
                            monetaryValue: opportunity.monetaryValue || 0,
                            vehicleInfo: this.extractVehicleInfo(contact.customFields),
                            dealerInfo: {
                                dealerName: this.getCustomFieldValue(contact.customFields, 'dealer_name'),
                                dealerLicense: contactDealerLicense,
                                finNumber: contactFinNumber
                            }
                        };

                        dealerDeals.push(dealData);
                    }
                } catch (contactError) {
                    logger.error(`Error fetching contact ${opportunity.contactId}:`, contactError.message);
                    // Continue with other opportunities
                }
            }

            logger.info(`Found ${dealerDeals.length} deals for dealer`);
            
            // Sort by start date (newest first)
            dealerDeals.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

            return dealerDeals;

        } catch (error) {
            logger.error('Error fetching dealer deals:', error);
            throw new Error(`Failed to fetch deals: ${error.message}`);
        }
    }

    async getDealDetails(opportunityId, dealerLicenseNumber, finNumber) {
        try {
            logger.info(`Fetching deal details for opportunity: ${opportunityId}`);

            // Get opportunity details
            const opportunityResponse = await ghlApi.get(`/opportunities/${opportunityId}`);
            const opportunity = opportunityResponse.data.opportunity;

            // Get contact details
            const contactResponse = await ghlApi.get(`/contacts/${opportunity.contactId}`);
            const contact = contactResponse.data.contact;

            // Verify this deal belongs to the requesting dealer
            const contactDealerLicense = this.getCustomFieldValue(contact.customFields, 'dealer_license_number');
            const contactFinNumber = this.getCustomFieldValue(contact.customFields, 'fin_number');

            const isMatchingDealer = 
                (dealerLicenseNumber && contactDealerLicense === dealerLicenseNumber) ||
                (finNumber && contactFinNumber === finNumber);

            if (!isMatchingDealer) {
                throw new Error('Deal not found or access denied');
            }

            // Get pipeline stage name
            const stageName = await this.getStageNameById(opportunity.pipelineStageId);

            // Build comprehensive deal jacket data
            const dealJacket = {
                // Basic deal info
                opportunityId: opportunity.id,
                contactId: opportunity.contactId,
                status: stageName || 'Unknown',
                monetaryValue: opportunity.monetaryValue || 0,
                dateAdded: opportunity.dateAdded,
                
                // Primary applicant info
                primaryApplicant: {
                    name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    email: contact.email,
                    phone: contact.phone,
                    dob: this.getCustomFieldValue(contact.customFields, 'borrower1_dob'),
                    ssn: this.maskSSN(this.getCustomFieldValue(contact.customFields, 'borrower1_ssn')),
                    driversLicense: this.getCustomFieldValue(contact.customFields, 'borrower1_drivers_license'),
                    currentAddress: this.getCustomFieldValue(contact.customFields, 'borrower1_current_address'),
                    addressYears: this.getCustomFieldValue(contact.customFields, 'borrower1_current_address_years'),
                    addressMonths: this.getCustomFieldValue(contact.customFields, 'borrower1_current_address_months'),
                    employment: {
                        currentEmployer: this.getCustomFieldValue(contact.customFields, 'borrower1_current_employer'),
                        title: this.getCustomFieldValue(contact.customFields, 'borrower1_title'),
                        employerAddress: this.getCustomFieldValue(contact.customFields, 'borrower1_employer_address'),
                        income: this.getCustomFieldValue(contact.customFields, 'borrower1_income'),
                        employmentYears: this.getCustomFieldValue(contact.customFields, 'borrower1_employment_years'),
                        employmentMonths: this.getCustomFieldValue(contact.customFields, 'borrower1_employment_months')
                    }
                },

                // Co-applicant info (if exists)
                coApplicant: this.extractCoApplicantInfo(contact.customFields),

                // Vehicle information
                vehicle: {
                    year: this.getCustomFieldValue(contact.customFields, 'vehicle_year'),
                    makeModel: this.getCustomFieldValue(contact.customFields, 'vehicle_make_model'),
                    vin: this.getCustomFieldValue(contact.customFields, 'vehicle_vin'),
                    mileage: this.getCustomFieldValue(contact.customFields, 'vehicle_mileage'),
                    trim: this.getCustomFieldValue(contact.customFields, 'vehicle_trim')
                },

                // Financial information
                financial: {
                    sellingPrice: this.getCustomFieldValue(contact.customFields, 'selling_price'),
                    amountFinanced: this.getCustomFieldValue(contact.customFields, 'amountFinanced'),
                    cashDown: this.getCustomFieldValue(contact.customFields, 'cash_down'),
                    tradeValue: this.getCustomFieldValue(contact.customFields, 'trade_value'),
                    tradePayoff: this.getCustomFieldValue(contact.customFields, 'trade_payoff'),
                    taxes: this.getCustomFieldValue(contact.customFields, 'taxes'),
                    docFees: this.getCustomFieldValue(contact.customFields, 'doc_fees'),
                    titleFees: this.getCustomFieldValue(contact.customFields, 'title_fees')
                },

                // Dealer information
                dealer: {
                    name: this.getCustomFieldValue(contact.customFields, 'dealer_name'),
                    telephone: this.getCustomFieldValue(contact.customFields, 'dealer_telephone'),
                    contact: this.getCustomFieldValue(contact.customFields, 'dealer_contact'),
                    licenseNumber: contactDealerLicense,
                    finNumber: contactFinNumber
                },

                // Status and workflow info
                workflow: {
                    currentStage: stageName,
                    nextAction: this.determineNextAction(stageName),
                    lastUpdated: opportunity.dateUpdated || opportunity.dateAdded
                }
            };

            return dealJacket;

        } catch (error) {
            logger.error('Error fetching deal details:', error);
            throw new Error(`Failed to fetch deal details: ${error.message}`);
        }
    }

    // Helper methods
    getCustomFieldValue(customFields, fieldKey) {
        if (!customFields || !Array.isArray(customFields)) return null;
        
        const field = customFields.find(f => f.key === fieldKey || f.id === fieldKey);
        return field ? field.value : null;
    }

    async getStageNameById(stageId) {
        try {
            // This could be cached for better performance
            const pipelineResponse = await ghlApi.get(`/pipelines/${config.GHL_DEALS_PIPELINE_ID}`);
            const pipeline = pipelineResponse.data.pipeline;
            
            const stage = pipeline.stages.find(s => s.id === stageId);
            return stage ? stage.name : null;
        } catch (error) {
            logger.error('Error fetching stage name:', error);
            return null;
        }
    }

    determineNextAction(stageName) {
        const stageActions = {
            'New Deal Submitted': 'Document Review',
            'Underwriting': 'Credit Check',
            'Conditional Approval': 'Submit Stipulations',
            'Pending Docs': 'Upload Documents',
            'Final Approval': 'Schedule Closing',
            'Deal Funded': 'Complete',
            'Declined': 'Review Options'
        };

        return stageActions[stageName] || 'Contact Support';
    }

    extractVehicleInfo(customFields) {
        return {
            year: this.getCustomFieldValue(customFields, 'vehicle_year'),
            makeModel: this.getCustomFieldValue(customFields, 'vehicle_make_model'),
            vin: this.getCustomFieldValue(customFields, 'vehicle_vin'),
            mileage: this.getCustomFieldValue(customFields, 'vehicle_mileage')
        };
    }

    extractCoApplicantInfo(customFields) {
        const firstName = this.getCustomFieldValue(customFields, 'borrower2_firstName');
        const lastName = this.getCustomFieldValue(customFields, 'borrower2_lastName');
        
        if (!firstName && !lastName) return null;

        return {
            name: `${firstName || ''} ${lastName || ''}`.trim(),
            firstName: firstName,
            lastName: lastName,
            dob: this.getCustomFieldValue(customFields, 'borrower2_dob'),
            ssn: this.maskSSN(this.getCustomFieldValue(customFields, 'borrower2_ssn')),
            driversLicense: this.getCustomFieldValue(customFields, 'borrower2_drivers_license'),
            currentAddress: this.getCustomFieldValue(customFields, 'borrower2_current_address'),
            employment: {
                currentEmployer: this.getCustomFieldValue(customFields, 'borrower2_current_employer'),
                title: this.getCustomFieldValue(customFields, 'borrower2_title'),
                income: this.getCustomFieldValue(customFields, 'borrower2_income')
            }
        };
    }

    maskSSN(ssn) {
        if (!ssn) return null;
        if (ssn.length >= 4) {
            return 'XXX-XX-' + ssn.slice(-4);
        }
        return 'XXX-XX-XXXX';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }
}

module.exports = new DashboardService();
