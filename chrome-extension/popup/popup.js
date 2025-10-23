// popup/popup.js
// Main popup logic for Pinnacle Autofill Agent

const API_BASE_URL = 'https://portal.pinnacleautofinance.com';
// const API_BASE_URL = 'http://localhost:3000'; // For development

let authToken = null;
let selectedApplication = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-applications');
const applicationsList = document.getElementById('applications-list');
const selectedAppSection = document.getElementById('selected-application');
const startAutofillBtn = document.getElementById('start-autofill-btn');
const progressSection = document.getElementById('progress-section');
const statusMessages = document.getElementById('status-messages');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const stored = await chrome.storage.local.get(['authToken', 'user']);
    if (stored.authToken && stored.user) {
        authToken = stored.authToken;
        showMainSection(stored.user);
        loadApplications();
    } else {
        showAuthSection();
    }

    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    searchInput.addEventListener('input', handleSearch);
    startAutofillBtn.addEventListener('click', startAutofill);
});

// Show authentication section
function showAuthSection() {
    authSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
}

// Show main section
function showMainSection(user) {
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    userName.textContent = user.firstName || user.email;
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    authError.textContent = '';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Store auth token and user info
        authToken = data.token;
        await chrome.storage.local.set({
            authToken: data.token,
            user: data.dealer
        });

        showMainSection(data.dealer);
        loadApplications();

    } catch (error) {
        authError.textContent = error.message;
    }
}

// Handle logout
async function handleLogout() {
    await chrome.storage.local.remove(['authToken', 'user']);
    authToken = null;
    selectedApplication = null;
    showAuthSection();
}

// Load applications from API
async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/applications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load applications');
        }

        const data = await response.json();
        displayApplications(data.applications || []);

    } catch (error) {
        applicationsList.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
}

// Display applications
function displayApplications(applications) {
    if (applications.length === 0) {
        applicationsList.innerHTML = '<p class="loading">No applications found</p>';
        return;
    }

    applicationsList.innerHTML = applications.map(app => `
        <div class="application-item" data-app-id="${app.id}">
            <h4>${app.applicant?.firstName} ${app.applicant?.lastName}</h4>
            <p>ID: ${app.id} • ${app.status || 'Pending'}</p>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.application-item').forEach(item => {
        item.addEventListener('click', () => selectApplication(item.dataset.appId, applications));
    });
}

// Select an application
function selectApplication(appId, applications) {
    selectedApplication = applications.find(app => app.id === appId);

    // Update UI
    document.querySelectorAll('.application-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-app-id="${appId}"]`).classList.add('selected');

    // Show selected application details
    document.getElementById('app-name').textContent =
        `${selectedApplication.applicant?.firstName} ${selectedApplication.applicant?.lastName}`;
    document.getElementById('app-id').textContent = selectedApplication.id;
    document.getElementById('app-status').textContent = selectedApplication.status || 'Pending';

    selectedAppSection.classList.remove('hidden');
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.application-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// Start autofill process
async function startAutofill() {
    if (!selectedApplication) {
        addStatusMessage('Please select an application first', 'error');
        return;
    }

    try {
        // Get current tab URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const lenderUrl = tab.url;

        // Show progress section
        progressSection.classList.remove('hidden');
        startAutofillBtn.disabled = true;

        // Send message to content script to start autofill
        chrome.tabs.sendMessage(tab.id, {
            action: 'startAutofill',
            applicationId: selectedApplication.id,
            lenderUrl: lenderUrl,
            authToken: authToken
        });

        addStatusMessage('Autofill started...', 'info');

    } catch (error) {
        addStatusMessage(`Error: ${error.message}`, 'error');
        progressSection.classList.add('hidden');
        startAutofillBtn.disabled = false;
    }
}

// Add status message
function addStatusMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `status-message ${type}`;
    messageEl.textContent = message;
    statusMessages.appendChild(messageEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageEl.remove();
    }, 5000);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateProgress') {
        updateProgress(message.progress, message.status);
    } else if (message.action === 'autofillComplete') {
        handleAutofillComplete(message.success, message.message);
    } else if (message.action === 'requiresUserIntervention') {
        handleUserIntervention(message.message);
    }
});

// Update progress
function updateProgress(progress, status) {
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-status').textContent = status;
}

// Handle autofill completion
function handleAutofillComplete(success, message) {
    progressSection.classList.add('hidden');
    startAutofillBtn.disabled = false;

    if (success) {
        addStatusMessage(message || 'Autofill completed successfully!', 'success');
    } else {
        addStatusMessage(message || 'Autofill failed', 'error');
    }
}

// Handle user intervention request
function handleUserIntervention(message) {
    addStatusMessage(message, 'info');
    updateProgress(50, 'Waiting for user input...');
}
