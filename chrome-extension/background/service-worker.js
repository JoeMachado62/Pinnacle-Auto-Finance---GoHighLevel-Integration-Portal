// background/service-worker.js
// Background service worker for Auto Fill Agent

console.log('Auto Fill Agent service worker started');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Auto Fill Agent installed');

        // Create context menu
        chrome.contextMenus.create({
            id: 'auto-fill-agent',
            title: 'Fill with Auto Fill Agent',
            contexts: ['editable']
        });

        // Open installation success page
        chrome.tabs.create({
            url: 'https://portal.pinnacleautofinance.com/extension-install.html'
        });
    } else if (details.reason === 'update') {
        console.log('Auto Fill Agent updated');
    }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    // Forward messages between popup and content script
    if (message.action === 'updateProgress') {
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => {
            // Popup might be closed, ignore error
        });
    } else if (message.action === 'autofillComplete') {
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => {
            // Popup might be closed, ignore error
        });
    } else if (message.action === 'requiresUserIntervention') {
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => {
            // Popup might be closed, ignore error
        });
    }

    return true; // Keep message channel open for async responses
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'auto-fill-agent') {
        // Open popup or trigger autofill
        chrome.action.openPopup();
    }
});
