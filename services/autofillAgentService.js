// services/autofillAgentService.js
// Handles automation plan generation using Claude Sonnet 4.5 and BrowserBase execution
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');
const config = require('../config');

class AutofillAgentService {
    constructor() {
        this.anthropic = null;
        this.browserbaseApiKey = config.BROWSERBASE_API_KEY;
        this.browserbaseProjectId = config.BROWSERBASE_PROJECT_ID;

        // Initialize Anthropic client if API key is available
        if (config.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({
                apiKey: config.ANTHROPIC_API_KEY
            });
            logger.info('AutofillAgentService initialized with Claude Sonnet 4.5');
        } else {
            logger.warn('AutofillAgentService initialized without Anthropic API key - plan generation will be unavailable');
        }
    }

    /**
     * Generate an automation plan for filling out a lender form
     * @param {Object} applicationData - The credit application data
     * @param {string} lenderUrl - The URL of the lender's application form
     * @param {string} domContext - Optional DOM context from the extension
     * @returns {Promise<Object>} Automation plan with steps
     */
    async generateAutomationPlan(applicationData, lenderUrl, domContext = null) {
        if (!this.anthropic) {
            throw new Error('Anthropic API key not configured. Cannot generate automation plan.');
        }

        try {
            logger.info(`Generating automation plan for ${lenderUrl}`);

            const prompt = this._buildPrompt(applicationData, lenderUrl, domContext);

            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514', // Sonnet 4.5 - cost-effective and excellent for this task
                max_tokens: 4096,
                temperature: 0.3, // Lower temperature for more consistent output
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            const planText = response.content[0].text;
            const plan = this._parsePlan(planText);

            logger.info(`Automation plan generated with ${plan.steps.length} steps`);

            return {
                success: true,
                plan: plan,
                model: 'claude-sonnet-4.5',
                usage: {
                    input_tokens: response.usage.input_tokens,
                    output_tokens: response.usage.output_tokens
                }
            };

        } catch (error) {
            logger.error('Error generating automation plan:', error);
            throw new Error(`Failed to generate automation plan: ${error.message}`);
        }
    }

    /**
     * Build the prompt for Claude to generate the automation plan
     */
    _buildPrompt(applicationData, lenderUrl, domContext) {
        const applicantInfo = this._formatApplicantData(applicationData);

        let prompt = `You are an expert at creating browser automation plans for filling out loan application forms.

I need you to create a step-by-step automation plan to fill out a loan application form at: ${lenderUrl}

Here is the applicant's information that needs to be entered:
${applicantInfo}

${domContext ? `\nHere is the current DOM structure of the form:\n${domContext}\n` : ''}

Please create a JSON automation plan with the following structure:
{
  "steps": [
    {
      "type": "navigate|type|click|select|wait|pause_for_input",
      "selector": "CSS selector or XPath",
      "value": "value to enter (for type/select)",
      "description": "Human-readable description",
      "confidence": 0.0-1.0,
      "alternatives": ["alternative selector 1", "alternative selector 2"]
    }
  ],
  "warnings": ["Any warnings or edge cases to be aware of"],
  "captchaLikely": true/false
}

Step Types:
- navigate: Go to a URL
- type: Type text into a field
- click: Click a button or element
- select: Select from a dropdown
- wait: Wait for element to appear or time delay
- pause_for_input: Pause for user intervention (use when confidence < 0.7)

Guidelines:
1. Use multiple selector strategies when possible (ID, name, placeholder, aria-label)
2. Include waits before interacting with elements to ensure they're loaded
3. For complex or unusual fields, use "pause_for_input" and explain what the user should do
4. If you detect CAPTCHA fields or indicators, set "captchaLikely": true
5. Be conservative - if you're not confident (< 70%), pause for user input
6. Common field mappings:
   - First/Last Name → applicant.firstName, applicant.lastName
   - SSN → applicant.ssn
   - Income → applicant.income
   - Address → applicant.address fields
   - Employment → applicant.employment fields

Return ONLY the JSON automation plan, no additional text.`;

        return prompt;
    }

    /**
     * Format applicant data for the prompt
     * Handles both new structure (applicant) and legacy structure (applicantData)
     */
    _formatApplicantData(applicationData) {
        // Check if using legacy structure (applicantData) or new structure (applicant)
        const appData = applicationData.applicantData || applicationData.applicant || {};

        const data = {
            // Personal Information
            firstName: appData.borrower1_firstName || appData.firstName,
            middleName: appData.borrower1_middleName || appData.middleName,
            lastName: appData.borrower1_lastName || appData.lastName,
            suffix: appData.borrower1_suffix || appData.suffix,
            dateOfBirth: appData.borrower1_dob || appData.dateOfBirth,
            ssn: appData.borrower1_ssn || appData.ssn,
            email: appData.borrower1_email || appData.email || applicationData.applicantEmail,
            phone: appData.borrower1_cellPhone || appData.borrower1_home_phone || appData.phone,
            driversLicense: appData.borrower1_drivers_license || appData.driversLicense,

            // Address
            address: appData.borrower1_current_address || appData.address?.street || appData.address,
            addressType: appData.borrower1_address_type || appData.residenceType,
            yearsAtAddress: appData.borrower1_current_address_years || appData.yearsAtAddress,
            monthsAtAddress: appData.borrower1_current_address_months || appData.monthsAtAddress,

            // Employment
            employerName: appData.borrower1_current_employer || appData.employment?.employerName || appData.employerName,
            employerPhone: appData.borrower1_employer_phone || appData.employment?.employerPhone || appData.employerPhone,
            employerAddress: appData.borrower1_employer_address || appData.employment?.address,
            jobTitle: appData.borrower1_title || appData.employment?.jobTitle || appData.jobTitle,
            monthlyIncome: appData.borrower1_income || appData.employment?.monthlyIncome || appData.monthlyIncome,
            annualIncome: this._parseIncome(appData.borrower1_income || appData.annualIncome),
            yearsEmployed: appData.borrower1_employment_years || appData.employment?.yearsEmployed,
            monthsEmployed: appData.borrower1_employment_months,

            // Vehicle Information
            vehicleYear: appData.vehicle_year || applicationData.vehicle?.year,
            vehicleMake: appData.vehicle_make_model || applicationData.vehicle?.make,
            vehicleModel: appData.vehicle_trim || applicationData.vehicle?.model,
            vehicleVin: appData.vehicle_vin || applicationData.vehicle?.vin,
            vehicleMileage: appData.vehicle_mileage || applicationData.vehicle?.mileage,
            vehiclePrice: appData.selling_price || applicationData.vehicle?.price || applicationData.amountFinanced,
            downPayment: appData.cash_down || applicationData.downPayment,

            // Financial Details
            amountFinanced: appData.amountFinanced || applicationData.amountFinanced,
            totalPrice: appData.total_price,
            tradeValue: appData.trade_value,
            tradePayoff: appData.trade_payoff,

            // Co-Applicant (if exists)
            coApplicant: appData.borrower2_firstName ? {
                firstName: appData.borrower2_firstName,
                lastName: appData.borrower2_lastName,
                dateOfBirth: appData.borrower2_dob,
                ssn: appData.borrower2_ssn,
                email: appData.borrower2_email,
                phone: appData.borrower2_cellPhone || appData.borrower2_home_phone
            } : null,

            // Dealer Information
            dealerName: appData.dealer_name || applicationData.dealerName,
            dealerContact: appData.dealer_contact,
            dealerPhone: appData.dealer_telephone
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Parse income string to annual amount
     */
    _parseIncome(incomeStr) {
        if (!incomeStr) return null;

        // Remove currency symbols and commas
        const cleaned = incomeStr.toString().replace(/[$,]/g, '');
        const amount = parseFloat(cleaned);

        if (isNaN(amount)) return null;

        // If it looks like monthly income (< 10000), convert to annual
        if (amount < 10000) {
            return amount * 12;
        }

        return amount;
    }

    /**
     * Parse the automation plan from Claude's response
     */
    _parsePlan(planText) {
        try {
            // Extract JSON from the response (Claude might include markdown code blocks)
            let jsonText = planText.trim();

            // Remove markdown code blocks if present
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            const plan = JSON.parse(jsonText);

            // Validate plan structure
            if (!plan.steps || !Array.isArray(plan.steps)) {
                throw new Error('Invalid plan: missing or invalid steps array');
            }

            // Add default values
            plan.warnings = plan.warnings || [];
            plan.captchaLikely = plan.captchaLikely || false;

            return plan;

        } catch (error) {
            logger.error('Error parsing automation plan:', error);
            logger.error('Raw plan text:', planText);
            throw new Error('Failed to parse automation plan from Claude response');
        }
    }

    /**
     * Validate that an automation plan is executable
     */
    validatePlan(plan) {
        const errors = [];

        if (!plan.steps || !Array.isArray(plan.steps)) {
            errors.push('Plan must have a steps array');
        }

        const validStepTypes = ['navigate', 'type', 'click', 'select', 'wait', 'pause_for_input'];

        plan.steps.forEach((step, index) => {
            if (!validStepTypes.includes(step.type)) {
                errors.push(`Step ${index}: invalid type "${step.type}"`);
            }

            if (['type', 'click', 'select', 'wait'].includes(step.type) && !step.selector) {
                errors.push(`Step ${index}: missing selector for type "${step.type}"`);
            }

            if (['type', 'select'].includes(step.type) && !step.value) {
                errors.push(`Step ${index}: missing value for type "${step.type}"`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Create a BrowserBase session for automation
     */
    async createBrowserSession() {
        if (!this.browserbaseApiKey || !this.browserbaseProjectId) {
            throw new Error('BrowserBase credentials not configured');
        }

        // This will be implemented when we integrate BrowserBase directly
        // For now, this is handled by the Chrome extension
        logger.info('Browser session creation requested - handled by extension');

        return {
            sessionId: `session_${Date.now()}`,
            note: 'Session managed by Chrome extension'
        };
    }
}

module.exports = new AutofillAgentService();
