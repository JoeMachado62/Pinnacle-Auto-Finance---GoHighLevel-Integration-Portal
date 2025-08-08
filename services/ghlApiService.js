// /var/www/paf-ghl/services/ghlApiService.js
console.log('[DEBUG] Entering services/ghlApiService.js'); // ADD THIS
const axios = require('axios');
const config = require('../config'); 
const { logger } = require('../utils/logger'); 

// This will store our processed map: { "html_form_field_name_or_logical_key": "GHL_Field_ID" }
const processedFieldMap = {}; 

// Load and process the ghlCustomFieldMap.json
try {
    const rawFieldDataArray = require('../config/ghlCustomFieldMap.json'); 
    
    if (Array.isArray(rawFieldDataArray)) {
        rawFieldDataArray.forEach(fieldObject => {
            // **Implemented Key Generation Logic:**
            // This logic determines the key used to map HTML form field names to GHL Field IDs.
            // It prioritizes `fieldObject.fieldKey` (stripping "contact.") and falls back to
            // a snake_case version of `fieldObject.fieldName`.
            // The `name` attributes in your credit_application.html's input fields MUST produce
            // keys that match what this logic generates for `lookupKey`.

            let lookupKey = null;

            if (fieldObject && typeof fieldObject.fieldKey === 'string' && fieldObject.fieldKey.startsWith('contact.')) {
                // Option 1: Derive from fieldKey (e.g., "contact.borrower1_ssn" becomes "borrower1_ssn")
                lookupKey = fieldObject.fieldKey.substring('contact.'.length); 
            } else if (fieldObject && typeof fieldObject.fieldName === 'string') {
                // Option 2: Fallback to derive from fieldName (e.g., "Borrower1 SSN" becomes "borrower1_ssn")
                lookupKey = fieldObject.fieldName
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9\s_]/g, '') // Keep underscores, remove other special chars
                    .replace(/\s+/g, '_');       // Replace spaces with underscores
            }

            if (lookupKey && typeof fieldObject.fieldId === 'string' && fieldObject.fieldId) {
                if (processedFieldMap[lookupKey]) {
                    logger.warn(`Duplicate lookupKey generated in processedFieldMap: '${lookupKey}'. From ghlCustomFieldMap.json, check fieldKey: '${fieldObject.fieldKey}' and fieldName: '${fieldObject.fieldName}'. Field ID ${fieldObject.fieldId} might overwrite a previous one.`);
                }
                processedFieldMap[lookupKey] = fieldObject.fieldId;
            } else {
                // logger.debug('Skipping field object in ghlCustomFieldMap.json due to missing/unusable lookupKey or missing fieldId:', fieldObject);
            }
        });

        // logger.info is fine here as logger should be initialized by now
        logger.info(`(ghlApiService) Processed ghlCustomFieldMap.json. Map size: ${Object.keys(processedFieldMap).length}`);
        if (Object.keys(processedFieldMap).length === 0 && rawFieldDataArray.length > 0) {
            logger.warn('ghlCustomFieldMap.json was loaded, but the processed map is empty. This likely means the lookupKey generation logic did not produce usable keys from your JSON structure, or fieldId was missing. PLEASE VERIFY HTML FORM INPUT NAMES ALIGN WITH THIS LOGIC.');
        } else if (rawFieldDataArray.length > Object.keys(processedFieldMap).length) {
            logger.warn(`Some entries from ghlCustomFieldMap.json might not have been mapped. Original: ${rawFieldDataArray.length}, Mapped: ${Object.keys(processedFieldMap).length}. Check for missing fieldId or unmatchable fieldKey/fieldName in your JSON.`);
        }
    } else {
        logger.error('(ghlApiService) CRITICAL: ghlCustomFieldMap.json is not an array.');
    }
} catch (error) {
    logger.error('(ghlApiService) CRITICAL: Failed to load/process ghlCustomFieldMap.json.', error);
}

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

async function createGhlContact(formData) {
    if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) {
        logger.error('createGhlContact: GHL_API_KEY or GHL_LOCATION_ID is not configured.');
        throw new Error('GHL API Key or Location ID is not configured.');
    }
    if (Object.keys(processedFieldMap).length === 0) {
        logger.error('createGhlContact: processedFieldMap is empty. Cannot map custom fields. Ensure ghlCustomFieldMap.json is correct and HTML form names align with the key generation logic.');
        throw new Error('GHL Custom Field Map is not loaded or processed correctly.');
    }

    const customFieldsPayload = [];
    // The keys in `formData` (from HTML form submission) MUST match the `lookupKey`s generated for `processedFieldMap`.
    for (const htmlFormFieldName in formData) {
        if (formData.hasOwnProperty(htmlFormFieldName)) {
            const ghlFieldId = processedFieldMap[htmlFormFieldName]; 
            if (ghlFieldId) {
                let value = formData[htmlFormFieldName];
                if (typeof value === 'boolean') {
                    value = String(value); 
                } else if (value === undefined || value === null) {
                    value = ""; 
                } else {
                    value = String(value);
                }
                
                customFieldsPayload.push({
                    id: ghlFieldId,
                    value: value,
                });
            } else {
                // logger.debug(`createGhlContact: No GHL mapping found in processedFieldMap for form field: ${htmlFormFieldName}. This field will not be sent as a custom field.`);
            }
        }
    }
    
    // Standard GHL contact fields.
    // **ACTION REQUIRED:** Ensure these `formData.key_name` match what your HTML form sends.
    const contactPayload = {
        firstName: formData.borrower1_firstName || formData.applicantFirstName || "", 
        lastName: formData.borrower1_lastName || formData.applicantLastName || "Application", 
        email: formData.borrower1_email || formData.email, 
        phone: formData.borrower1_cellPhone || formData.phone, 
        locationId: config.GHL_LOCATION_ID,
        tags: ['credit_application_portal', 'new_submission_paf_v2'],
        source: 'Pinnacle Auto Finance Portal',
        customFields: customFieldsPayload, 
    };

    if (!contactPayload.firstName && !contactPayload.lastName) {
        contactPayload.lastName = "Unknown Applicant"; 
    }
    if (!contactPayload.email && !contactPayload.phone && !(contactPayload.firstName && contactPayload.lastName)) {
        const missingInfoError = 'Cannot create GHL contact: Requires at least email, phone, or a full name.';
        logger.error(missingInfoError, { submittedFirstName: contactPayload.firstName, submittedLastName: contactPayload.lastName });
        throw new Error(missingInfoError);
    }

    for (const key of ['email', 'phone']) { 
        if (contactPayload[key] === undefined || contactPayload[key] === null || contactPayload[key] === "") { // Also check for empty string if it should be omitted
            delete contactPayload[key]; 
        }
    }
    
    logger.info('Attempting to create GHL Contact.');
    logger.debug('GHL Contact Payload:', JSON.stringify(contactPayload, (key, value) => {
        // Simple redaction for SSN-like fields in debug logs
        if (typeof value === 'string' && (key.toLowerCase().includes('ssn') || key.toLowerCase().includes('driverslicense'))) {
            return 'REDACTED_IN_LOG';
        }
        return value;
    }, 2));


    try {
        const response = await ghlApi.post('/contacts/', contactPayload);
        logger.info(`GHL Contact created successfully. ID: ${response.data.contact.id}`);
        return response.data.contact.id;
    } catch (error) {
        // Check if it's a duplicate contact error
        if (error.response?.status === 400 && 
            error.response?.data?.message?.includes('duplicated contacts') &&
            error.response?.data?.meta?.contactId) {
            
            const existingContactId = error.response.data.meta.contactId;
            logger.info(`Using existing GHL contact ID: ${existingContactId} (duplicate detected by ${error.response.data.meta.matchingField})`);
            return existingContactId;
        }
        
        // For other errors, log and throw as before
        const errorDetails = {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
            ghlErrors: error.response?.data?.errors || error.response?.data?.message || error.response?.data,
        };
        if (config.NODE_ENV === 'development') {
            // Clone and redact payload for logging in dev
            const loggedPayload = JSON.parse(JSON.stringify(contactPayload));
            if (loggedPayload.customFields && Array.isArray(loggedPayload.customFields)) {
                loggedPayload.customFields.forEach(cf => {
                    const mapEntryKey = Object.keys(processedFieldMap).find(key => processedFieldMap[key] === cf.id);
                    if (mapEntryKey && (mapEntryKey.toLowerCase().includes('ssn') || mapEntryKey.toLowerCase().includes('driverslicense'))) {
                        cf.value = 'REDACTED_IN_LOG';
                    }
                });
            }
            errorDetails.payloadSent = loggedPayload;
        }
        logger.error('Error creating GHL contact:', errorDetails);
        throw new Error(`Failed to create GHL contact. GHL Status: ${error.response?.status}. Message: ${JSON.stringify(error.response?.data)}`);
    }
}

async function createGhlOpportunity(contactId, formData) {
    if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) { 
        logger.error('createGhlOpportunity: GHL_API_KEY or GHL_LOCATION_ID is not configured.');
        throw new Error('GHL API Key or Location ID not configured.');
    }
    if (!config.GHL_DEALS_PIPELINE_ID || !config.GHL_DEALS_STAGE_NEW_DEAL_SUBMITTED) {
        logger.error('createGhlOpportunity: Pipeline ID or initial Stage ID is not configured.');
        throw new Error('GHL Pipeline or Stage ID not configured.');
    }

    // **ACTION REQUIRED:** Ensure formData keys for amountFinanced and names are correct.
    let amountFinancedKey = 'amountFinanced'; 
    if (formData.hasOwnProperty('amount_financed')) { 
        amountFinancedKey = 'amount_financed';
    } else if (!formData.hasOwnProperty('amountFinanced')) {
        logger.warn(`'amountFinanced' or 'amount_financed' not found in formData for opportunity monetary value. Defaulting to 0. FormData keys available: ${Object.keys(formData).join(', ')}`);
    }
    
    const monetaryValueString = String(formData[amountFinancedKey] || '0').replace(/[$,]/g, '');
    const monetaryValue = parseFloat(monetaryValueString) || 0;
    
    const opportunityName = `Deal: ${formData.borrower1_firstName || formData.applicantFirstName || 'N/A'} ${formData.borrower1_lastName || formData.applicantLastName || 'Applicant'} - ${new Date().toLocaleDateString()}`; // Using toLocaleDateString for readability

    const opportunityPayload = {
        name: opportunityName,
        pipelineId: config.GHL_DEALS_PIPELINE_ID,
        pipelineStageId: config.GHL_DEALS_STAGE_NEW_DEAL_SUBMITTED,
        locationId: config.GHL_LOCATION_ID,
        contactId: contactId,
        monetaryValue: monetaryValue,
        status: 'open', 
    };

    logger.info('Attempting to create GHL Opportunity.');
    logger.debug('GHL Opportunity Payload:', JSON.stringify(opportunityPayload, null, 2));

    try {
        const response = await ghlApi.post('/opportunities/', opportunityPayload);
        logger.info(`GHL Opportunity created successfully. ID: ${response.data.id}`);
        return response.data.id;
    } catch (error) {
        const errorDetails = {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
            ghlErrors: error.response?.data?.errors || error.response?.data?.message || error.response?.data,
        };
        if (config.NODE_ENV === 'development') {
            errorDetails.payloadSent = opportunityPayload;
        }
        logger.error('Error creating GHL opportunity:', errorDetails);
        throw new Error(`Failed to create GHL opportunity. GHL Status: ${error.response?.status}. Message: ${JSON.stringify(error.response?.data)}`);
    }
}

// Template-based dealer contact creation using exact structure from working curl
async function createGhlDealerContact(dealerData) {
    if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) {
        logger.error('createGhlDealerContact: GHL_API_KEY or GHL_LOCATION_ID is not configured.');
        throw new Error('GHL API Key or Location ID is not configured.');
    }

    // EXACT template based on working curl example - field names must match exactly
    const dealerContactTemplate = {
        "firstName": dealerData.dealer_first_name || "Dealer",
        "lastName": dealerData.dealer_last_name || "Contact", 
        "name": `${dealerData.dealer_first_name || "Dealer"} ${dealerData.dealer_last_name || "Contact"}`,
        "email": dealerData.email,
        "locationId": config.GHL_LOCATION_ID,
        "phone": dealerData.phone,
        "address1": dealerData.dealer_address || "",
        "city": dealerData.dealer_city || "",
        "state": dealerData.dealer_state || "",
        "postalCode": dealerData.postalCode || "",
        "website": dealerData.website || "",
        "timezone": "America/New_York",
        "dnd": false,
        "customFields": [
            {
                "id": "bg5HBiHWpbZ3EPllZeU1",
                "key": "dealer_username",
                "field_value": dealerData.dealer_username || ""
            },
            {
                "id": "hCPoe9gNIlTU6QXVz6FG",
                "key": "dealer_name", 
                "field_value": dealerData.dealer_name || ""
            },
            {
                "id": "iKyn0T1WDEC5q9UKSfzT",
                "key": "dealer_legal_name",
                "field_value": dealerData.dealer_legal_name || ""
            },
            {
                "id": "Nqm4WYc19quraEJEjuyW",
                "key": "dealer_license_number",
                "field_value": dealerData.dealer_license_number || ""
            },
            {
                "id": "pfMYbP1BJCXtgOf7cZ5U",
                "key": "dealer_federal_tax_id",
                "field_value": dealerData.dealer_federal_tax_id || ""
            },
            {
                "id": "ZeoyU9DQ2w4RMsdyMR60",
                "key": "dealer_address",
                "field_value": dealerData.dealer_address || ""
            },
            {
                "id": "DWbxWradTqAGXVOpslnD",
                "key": "dealer_city",
                "field_value": dealerData.dealer_city || ""
            },
            {
                "id": "ADJUATtyZqY56vTcpQjf",
                "key": "dealer_state",
                "field_value": dealerData.dealer_state || ""
            },
            {
                "id": "9Tnum2NRcMIkStE8471D",
                "key": "dealer_zip_code",
                "field_value": dealerData.postalCode || ""
            },
            {
                "id": "3cdtVqWW6kbR4ELpLn4J",
                "key": "dealer_phone",
                "field_value": dealerData.phone || ""
            },
            {
                "id": "uLEUj4f48r9zfSXBjHna",
                "key": "dealer_fax_number",
                "field_value": dealerData.dealer_fax_number || ""
            },
            {
                "id": "zZ3tTU3BXIvYAjkvYwko",
                "key": "dealer_telephone",
                "field_value": dealerData.dealer_telephone || ""
            },
            {
                "id": "9dryVp4KDrE8CwIucFvL",
                "key": "dealer_contact",
                "field_value": dealerData.dealer_contact || ""
            },
            {
                "id": "HKNf9xHgs962oXNycmB7",
                "key": "dealer_contact_cell_phone",
                "field_value": dealerData.dealer_contact_cell_phone || ""
            },
            {
                "id": "UFYwu1kCHJLrfNBVWvtH",
                "key": "dealer_contact_for_approval",
                "field_value": dealerData.dealer_contact_for_approval || ""
            },
            {
                "id": "SPJs45Z15cKPjMQKG100",
                "key": "dealer_first_name",
                "field_value": dealerData.dealer_first_name || ""
            },
            {
                "id": "t8B8vxwRwATISZJZteCa",
                "key": "dealer_last_name",
                "field_value": dealerData.dealer_last_name || ""
            },
            {
                "id": "FjKTuuacAtnOvswRPwgJ",
                "key": "dealer_owner_full_name",
                "field_value": dealerData.dealer_owner_full_name || ""
            }
        ]
    };

    logger.info('Attempting to create GHL Dealer Contact using exact template.');
    logger.info(`Full API URL: ${ghlApi.defaults.baseURL}/contacts/`);
    logger.info(`API Headers: ${JSON.stringify(ghlApi.defaults.headers, null, 2)}`);
    logger.info(`Dealer Contact Template Payload: ${JSON.stringify(dealerContactTemplate, null, 2)}`);

    try {
        const response = await ghlApi.post('/contacts/', dealerContactTemplate);
        
        // Log complete response details
        logger.info(`GHL API Response Status: ${response.status}`);
        logger.info(`GHL API Response Headers: ${JSON.stringify(response.headers, null, 2)}`);
        logger.info(`GHL API Response Data: ${JSON.stringify(response.data, null, 2)}`);
        
        // Only proceed if we get a successful status code
        if (response.status === 200 || response.status === 201) {
            const contactId = response.data.contact?.id;
            if (contactId) {
                logger.info(`GHL Dealer Contact created successfully. ID: ${contactId}`);
                return contactId;
            } else {
                logger.error('GHL API returned success but no contact ID found in response');
                throw new Error('GHL API returned success but no contact ID found');
            }
        } else {
            logger.error(`GHL API returned unexpected status code: ${response.status}`);
            throw new Error(`GHL API returned status ${response.status}`);
        }
        
    } catch (error) {
        // Log the complete error details
        logger.error(`GHL API Error - Status: ${error.response?.status}`);
        logger.error(`GHL API Error - Response: ${JSON.stringify(error.response?.data, null, 2)}`);
        logger.error(`GHL API Error - Headers: ${JSON.stringify(error.response?.headers, null, 2)}`);
        
        // Check if it's a duplicate contact error
        if (error.response?.status === 400 && 
            error.response?.data?.message?.includes('duplicated contacts') &&
            error.response?.data?.meta?.contactId) {
            
            const existingContactId = error.response.data.meta.contactId;
            logger.info(`Using existing GHL dealer contact ID: ${existingContactId} (duplicate detected by ${error.response.data.meta.matchingField})`);
            return existingContactId;
        }
        
        // For all other errors, fail the operation
        logger.error('Failed to create GHL dealer contact:', {
            status: error.response?.status,
            message: error.message,
            ghlResponse: error.response?.data
        });
        throw new Error(`Failed to create GHL dealer contact. Status: ${error.response?.status}. Response: ${JSON.stringify(error.response?.data)}`);
    }
}

// GHL User Account Management
const crypto = require('crypto');

function generateSecurePassword(length = 12) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(crypto.randomInt(0, characters.length));
    }
    return result;
}

async function createGhlUserAccount(dealerData) {
    // Validate required Agency API credentials for user creation
    if (!config.GHL_AGENCY_API_KEY || !config.GHL_COMPANY_ID || !config.GHL_LOCATION_ID) {
        logger.error('createGhlUserAccount: GHL_AGENCY_API_KEY, GHL_COMPANY_ID, or GHL_LOCATION_ID is not configured.');
        throw new Error('GHL Agency API Key, Company ID, or Location ID is not configured for user creation.');
    }

    // Check if user already exists by email
    try {
        const existingUser = await getUserByEmail(dealerData.email);
        if (existingUser) {
            logger.info(`GHL user already exists: ${dealerData.email}`);
            return existingUser;
        }
    } catch (error) {
        // User doesn't exist, continue with creation
        logger.debug('User lookup failed, proceeding with creation');
    }

    // Generate secure password
    const password = generateSecurePassword();

    // Create Agency API axios instance for user management
    const agencyApi = axios.create({
        baseURL: config.GHL_API_BASE_URL,
        headers: {
            'Authorization': `Bearer ${config.GHL_AGENCY_API_KEY}`,
            'Version': config.GHL_API_VERSION,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        timeout: 15000,
    });

    // Prepare user data with restricted permissions for dealers
    const userData = {
        firstName: dealerData.firstName,
        lastName: dealerData.lastName,
        email: dealerData.email,
        phone: dealerData.phone,
        password: password,
        type: 'account', // Type of user account
        role: 'user',    // Role within the system
        locationIds: [config.GHL_LOCATION_ID], // Assign to specific location
        permissions: {
            // Core permissions for dealer users
            contactsEnabled: true,           // View and manage contacts
            conversationsEnabled: true,      // Communicate with contacts  
            opportunitiesEnabled: true,      // Manage deals/opportunities
            appointmentsEnabled: true,       // Schedule appointments
            dashboardStatsEnabled: true,     // View performance dashboard
            assignedDataOnly: true,          // CRITICAL: Only see assigned data
            
            // Restricted permissions for security
            campaignsEnabled: false,         // No campaign creation
            workflowsEnabled: false,         // No automation workflows
            triggersEnabled: false,          // No trigger management
            funnelsEnabled: false,           // No funnel access
            websitesEnabled: false,          // No website builder
            settingsEnabled: false,          // No system settings
            marketingEnabled: false,         // No marketing tools
            paymentsEnabled: false,          // No payment processing
            bulkRequestsEnabled: false,      // No bulk operations
            exportPaymentsEnabled: false     // No payment exports
        }
    };

    logger.info('Attempting to create GHL User Account using Agency API.');
    logger.debug('GHL User Account Payload:', JSON.stringify({
        ...userData,
        password: 'REDACTED_FOR_SECURITY'
    }, null, 2));

    try {
        // Use Agency API for user creation (supports both V1 and V2 formats)
        let response;
        try {
            // Try V2 Agency API endpoint first
            response = await agencyApi.post('/users/', userData);
            logger.debug('V2 Agency API user creation successful');
        } catch (v2Error) {
            logger.warn('V2 Agency API failed, trying V1 format', v2Error.response?.data);
            
            // Fallback to V1 Agency API format
            const v1UserData = {
                ...userData,
                companyId: config.GHL_COMPANY_ID,
                locationId: config.GHL_LOCATION_ID
            };
            
            try {
                response = await agencyApi.post(`/companies/${config.GHL_COMPANY_ID}/locations/${config.GHL_LOCATION_ID}/users`, v1UserData);
                logger.debug('V1 Agency API user creation successful');
            } catch (v1Error) {
                logger.error('Both V2 and V1 Agency API calls failed', {
                    v2Error: v2Error.response?.data,
                    v1Error: v1Error.response?.data
                });
                throw v1Error;
            }
        }

        const createdUser = response.data.user || response.data;
        if (!createdUser || !createdUser.id) {
            throw new Error('GHL Agency API returned success but no user ID found');
        }

        logger.info(`GHL User Account created successfully using Agency API. ID: ${createdUser.id}`);
        
        // Return user data with temporary password for welcome email
        return {
            ...createdUser,
            tempPassword: password
        };
    } catch (error) {
        const errorDetails = {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
            ghlErrors: error.response?.data?.errors || error.response?.data?.message || error.response?.data,
            apiType: 'Agency API'
        };
        
        logger.error('Error creating GHL user account with Agency API:', errorDetails);
        throw new Error(`Failed to create GHL user account using Agency API. Status: ${error.response?.status}. Response: ${JSON.stringify(error.response?.data)}`);
    }
}

async function getUserByEmail(email) {
    try {
        // Search for existing user by email
        const response = await ghlApi.get(`/users/`, {
            params: {
                locationId: config.GHL_LOCATION_ID,
                email: email
            }
        });
        
        if (response.data && response.data.users && response.data.users.length > 0) {
            return response.data.users.find(user => user.email.toLowerCase() === email.toLowerCase());
        }
        
        return null;
    } catch (error) {
        logger.debug('Error searching for user by email:', error.response?.data);
        return null;
    }
}

async function updateContactWithUserId(contactId, ghlUserId) {
    if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) {
        logger.error('updateContactWithUserId: GHL_API_KEY or GHL_LOCATION_ID is not configured.');
        throw new Error('GHL API Key or Location ID is not configured.');
    }

    const updatePayload = {
        customFields: [
            {
                key: "ghl_user_id",
                value: ghlUserId
            },
            {
                key: "registration_status", 
                value: "active"
            },
            {
                key: "activation_date",
                value: new Date().toISOString()
            }
        ],
        tags: ["dealer_active", "ghl_user_created"]
    };

    try {
        // Remove pending tag and add active tags
        await ghlApi.delete(`/contacts/${contactId}/tags/registration_pending`);
        
        // Update contact with user ID
        const response = await ghlApi.put(`/contacts/${contactId}`, updatePayload);
        logger.info(`Contact ${contactId} updated with GHL user ID ${ghlUserId}`);
        
        return response.data;
    } catch (error) {
        logger.error('Error updating contact with user ID:', {
            contactId,
            ghlUserId,
            error: error.response?.data
        });
        throw error;
    }
}

// Auto-register premium users as GHL contacts when they upgrade
async function autoRegisterPremiumUser(dealerData) {
    try {
        logger.info(`Auto-registering premium user: ${dealerData.email}`);
        
        // Create GHL contact first
        const ghlContactId = await createGhlDealerContact(dealerData);
        
        // Create registration record
        const db = require('./databaseService');
        const registrationData = {
            email: dealerData.email,
            firstName: dealerData.dealer_first_name || dealerData.contactName?.split(' ')[0] || 'Dealer',
            lastName: dealerData.dealer_last_name || dealerData.contactName?.split(' ').slice(1).join(' ') || 'User',
            phone: dealerData.phone,
            dealerName: dealerData.dealerName,
            ghlContactId: ghlContactId,
            additionalInfo: {
                dealerLicenseNumber: dealerData.dealerLicenseNumber,
                address: dealerData.address,
                subscriptionTier: dealerData.subscriptionTier
            }
        };
        
        const registration = await db.createGhlRegistration(dealerData.id, registrationData);
        
        logger.info(`Premium user auto-registration completed: ${dealerData.email}`, {
            registrationId: registration.id,
            ghlContactId: ghlContactId
        });
        
        return {
            registration,
            ghlContactId
        };
    } catch (error) {
        logger.error('Error auto-registering premium user:', error);
        throw error;
    }
}

console.log('[DEBUG] Exiting TOP LEVEL of services/ghlApiService.js - Map processed, functions defined.'); // ADD THIS
module.exports = {
    createGhlContact,
    createGhlDealerContact,
    createGhlOpportunity,
    createGhlUserAccount,
    getUserByEmail,
    updateContactWithUserId,
    autoRegisterPremiumUser,
    generateSecurePassword
};
