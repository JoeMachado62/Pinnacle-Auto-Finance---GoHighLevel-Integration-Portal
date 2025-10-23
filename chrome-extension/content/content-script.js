// content/content-script.js
// Content script that executes automation plans on lender websites

const API_BASE_URL = 'https://portal.pinnacleautofinance.com';

let currentPlan = null;
let currentStep = 0;
let isPaused = false;
let isRunning = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startAutofill') {
        startAutofillProcess(message.applicationId, message.lenderUrl, message.authToken);
    } else if (message.action === 'pause') {
        isPaused = true;
    } else if (message.action === 'resume') {
        isPaused = false;
        continueExecution();
    } else if (message.action === 'cancel') {
        cancelAutofill();
    }
});

// Start the autofill process
async function startAutofillProcess(applicationId, lenderUrl, authToken) {
    if (isRunning) {
        showNotification('Autofill is already running', 'warning');
        return;
    }

    isRunning = true;
    currentStep = 0;

    try {
        // Step 1: Get application data
        showNotification('Loading application data...', 'info');
        const applicationData = await fetchApplicationData(applicationId, authToken);

        // Step 2: Get DOM context
        const domContext = getDOMContext();

        // Step 3: Generate automation plan from backend
        showNotification('Generating automation plan...', 'info');
        currentPlan = await generateAutomationPlan(applicationId, lenderUrl, domContext, authToken);

        // Step 4: Execute the plan
        await executePlan(currentPlan, applicationData);

        // Step 5: Log submission
        await logSubmission(applicationId, lenderUrl, 'submitted', authToken);

        showNotification('Autofill completed successfully!', 'success');
        chrome.runtime.sendMessage({
            action: 'autofillComplete',
            success: true,
            message: 'Form filled successfully'
        });

    } catch (error) {
        console.error('Autofill error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        chrome.runtime.sendMessage({
            action: 'autofillComplete',
            success: false,
            message: error.message
        });
    } finally {
        isRunning = false;
    }
}

// Fetch application data from API
async function fetchApplicationData(applicationId, authToken) {
    const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch application data');
    }

    const data = await response.json();
    return data.application;
}

// Get DOM context for plan generation
function getDOMContext() {
    // Extract form structure
    const forms = Array.from(document.querySelectorAll('form')).map(form => {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            label: findLabelForInput(input)
        }));

        return {
            id: form.id,
            action: form.action,
            inputs: inputs.slice(0, 20) // Limit to prevent huge payloads
        };
    });

    return JSON.stringify(forms.slice(0, 3)); // Only send first 3 forms
}

// Find label for an input element
function findLabelForInput(input) {
    // Try by 'for' attribute
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent.trim();
    }

    // Try parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    // Try sibling label
    const prevLabel = input.previousElementSibling;
    if (prevLabel && prevLabel.tagName === 'LABEL') {
        return prevLabel.textContent.trim();
    }

    return null;
}

// Generate automation plan via backend API
async function generateAutomationPlan(applicationId, lenderUrl, domContext, authToken) {
    const response = await fetch(`${API_BASE_URL}/api/agent/generate-plan`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            applicationId,
            lenderUrl,
            domContext
        })
    });

    if (!response.ok) {
        throw new Error('Failed to generate automation plan');
    }

    const data = await response.json();
    return data.plan;
}

// Execute the automation plan step by step
async function executePlan(plan) {
    const totalSteps = plan.steps.length;

    for (let i = 0; i < plan.steps.length; i++) {
        if (!isRunning) {
            throw new Error('Autofill cancelled');
        }

        // Wait if paused
        while (isPaused && isRunning) {
            await sleep(500);
        }

        currentStep = i;
        const step = plan.steps[i];

        // Update progress
        const progress = Math.round(((i + 1) / totalSteps) * 100);
        chrome.runtime.sendMessage({
            action: 'updateProgress',
            progress: progress,
            status: step.description || `Step ${i + 1}/${totalSteps}`
        });

        showNotification(step.description || `Executing step ${i + 1}`, 'info');

        try {
            await executeStep(step);
        } catch (error) {
            console.error(`Error executing step ${i + 1}:`, error);

            // If confidence is low or error occurs, pause for user intervention
            if (step.confidence < 0.7 || step.type === 'pause_for_input') {
                await handleUserIntervention(step);
            } else {
                // Try alternatives if available
                if (step.alternatives && step.alternatives.length > 0) {
                    let success = false;
                    for (const altSelector of step.alternatives) {
                        try {
                            await executeStep({ ...step, selector: altSelector });
                            success = true;
                            break;
                        } catch (e) {
                            continue;
                        }
                    }
                    if (!success) {
                        throw new Error(`Failed to execute step: ${step.description}`);
                    }
                } else {
                    throw error;
                }
            }
        }

        // Wait between steps for stability
        await sleep(500);
    }
}

// Execute a single step
async function executeStep(step) {
    switch (step.type) {
        case 'navigate':
            window.location.href = step.value;
            await waitForPageLoad();
            break;

        case 'type':
            const inputElement = await findElement(step.selector);
            inputElement.focus();
            inputElement.value = step.value;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            break;

        case 'click':
            const clickElement = await findElement(step.selector);
            clickElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);
            clickElement.click();
            break;

        case 'select':
            const selectElement = await findElement(step.selector);
            selectElement.value = step.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            break;

        case 'wait':
            if (step.selector) {
                await waitForElement(step.selector, step.timeout || 5000);
            } else {
                await sleep(step.value || 1000);
            }
            break;

        case 'pause_for_input':
            await handleUserIntervention(step);
            break;

        default:
            console.warn(`Unknown step type: ${step.type}`);
    }
}

// Find element with retry logic
async function findElement(selector, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const element = document.querySelector(selector);
            if (element) return element;
        } catch (e) {
            // Try XPath if CSS selector fails
            const xpathResult = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (xpathResult.singleNodeValue) {
                return xpathResult.singleNodeValue;
            }
        }

        await sleep(500);
    }

    throw new Error(`Element not found: ${selector}`);
}

// Wait for element to appear
async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const element = document.querySelector(selector);
            if (element) return element;
        } catch (e) {
            // Ignore
        }
        await sleep(100);
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
}

// Wait for page to load
async function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve, { once: true });
        }
    });
}

// Handle user intervention
async function handleUserIntervention(step) {
    isPaused = true;

    showNotification(`Please manually handle: ${step.description}. Click Resume when done.`, 'warning', 0);

    chrome.runtime.sendMessage({
        action: 'requiresUserIntervention',
        message: step.description
    });

    // Wait for user to resume
    while (isPaused && isRunning) {
        await sleep(500);
    }

    hideNotification();
}

// Log submission to backend
async function logSubmission(applicationId, lenderUrl, status, authToken) {
    await fetch(`${API_BASE_URL}/api/agent/log-submission`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            applicationId,
            lenderUrl,
            status,
            submittedAt: new Date().toISOString()
        })
    });
}

// Cancel autofill
function cancelAutofill() {
    isRunning = false;
    isPaused = false;
    currentPlan = null;
    currentStep = 0;
    hideNotification();
}

// Continue execution after pause
function continueExecution() {
    isPaused = false;
}

// Show notification overlay
let notificationElement = null;
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notification
    hideNotification();

    // Create notification
    notificationElement = document.createElement('div');
    notificationElement.id = 'pinnacle-autofill-notification';
    notificationElement.className = `pinnacle-notification pinnacle-${type}`;
    notificationElement.textContent = message;

    document.body.appendChild(notificationElement);

    // Auto-hide if duration is set
    if (duration > 0) {
        setTimeout(hideNotification, duration);
    }
}

// Hide notification
function hideNotification() {
    if (notificationElement) {
        notificationElement.remove();
        notificationElement = null;
    }
}

// Utility: sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('Pinnacle Autofill Agent content script loaded');
