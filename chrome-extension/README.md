# Pinnacle Autofill Agent - Chrome Extension

AI-powered browser automation for submitting loan applications to partner lenders.

## Overview

The Pinnacle Autofill Agent is a Chrome extension that intelligently fills out lender application forms using data from your Pinnacle Portal credit applications. It uses Claude Sonnet 4.5 to analyze each lender's unique form structure and generate a customized automation plan.

## Features

- 🤖 **AI-Powered Form Analysis** - Claude Sonnet 4.5 analyzes each lender's form structure
- 🎯 **Smart Field Mapping** - Automatically maps application data to form fields
- 🔒 **Secure Authentication** - Integrates with Pinnacle Portal authentication
- ⏸️ **User Intervention Support** - Pauses for CAPTCHAs and manual input when needed
- 📊 **Progress Tracking** - Real-time progress updates and submission logging
- 🔄 **Automatic Retries** - Tries alternative selectors if primary ones fail

## Architecture

### Components

1. **Popup UI** (`popup/`)
   - Login interface
   - Application selection
   - Progress monitoring
   - Status updates

2. **Content Script** (`content/`)
   - DOM analysis
   - Plan execution
   - Form interaction
   - User intervention handling

3. **Background Service Worker** (`background/`)
   - Message routing
   - Notifications
   - Context menu integration

## Installation

### Development Mode

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `chrome-extension` directory

### Production (Coming Soon)

The extension will be available in the Chrome Web Store once testing is complete.

## Usage

1. **Install & Login**
   - Install the extension
   - Click the Pinnacle icon in your browser toolbar
   - Login with your Pinnacle Portal credentials

2. **Navigate to Lender Site**
   - Go to any lender's loan application page
   - Ensure you're on the actual form (not just the homepage)

3. **Select Application**
   - Click the Pinnacle icon
   - Search and select the application you want to submit
   - Click "Start Autofill"

4. **Monitor Progress**
   - Watch as the extension fills out the form
   - If a CAPTCHA appears, solve it and the extension will continue
   - For complex fields, the extension may pause for manual input

5. **Complete Submission**
   - The extension will notify you when complete
   - Check the submission tracker in your Pinnacle Portal dashboard

## API Integration

The extension communicates with the Pinnacle Portal backend via the following endpoints:

- `POST /api/auth/login` - Authenticate user
- `GET /api/applications` - Fetch available applications
- `POST /api/agent/generate-plan` - Generate automation plan using Claude
- `POST /api/agent/log-submission` - Log submission attempt

## Configuration

### Environment Variables (Backend)

Add these to your `/var/www/paf-ghl/.env` file:

```env
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# BrowserBase (Optional - for advanced features)
BROWSERBASE_API_KEY=your_key_here
BROWSERBASE_PROJECT_ID=your_project_id
```

### Extension Settings

The extension defaults to production mode (`https://portal.pinnacleautofinance.com`).

For development, edit `popup/popup.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000'; // Development
// const API_BASE_URL = 'https://portal.pinnacleautofinance.com'; // Production
```

Do the same in `content/content-script.js`.

## Development

### File Structure

```
chrome-extension/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html         # Main UI
│   ├── popup.css          # Styles
│   └── popup.js           # UI logic & API calls
├── content/
│   ├── content-script.js  # DOM interaction & plan execution
│   └── content-styles.css # Notification styles
├── background/
│   └── service-worker.js  # Background tasks
└── assets/
    ├── icon-16.png        # Extension icons (TODO)
    ├── icon-48.png
    └── icon-128.png
```

### Adding Icons

Icons are required for the extension to work properly. Add 3 PNG files to the `assets/` directory:

- `icon-16.png` - 16x16 pixels
- `icon-48.png` - 48x48 pixels
- `icon-128.png` - 128x128 pixels

Use the Pinnacle Auto Finance logo or create custom icons.

## How It Works

1. **User Initiates Autofill**
   - User navigates to lender site
   - Clicks extension icon and selects an application
   - Clicks "Start Autofill"

2. **DOM Analysis**
   - Content script extracts form structure
   - Sends to backend with application ID and lender URL

3. **AI Plan Generation**
   - Backend calls Claude Sonnet 4.5 with:
     - Application data (applicant info, vehicle details, etc.)
     - Lender URL
     - DOM structure of the form
   - Claude returns a JSON automation plan with steps

4. **Plan Execution**
   - Content script executes each step sequentially:
     - `type` - Enter text into fields
     - `click` - Click buttons
     - `select` - Choose dropdown options
     - `wait` - Wait for elements to load
     - `pause_for_input` - Request user intervention

5. **Error Handling**
   - If a selector fails, try alternatives
   - If confidence is low, pause for user
   - Log errors and continue where possible

6. **Completion**
   - Log submission to Pinnacle Portal
   - Show success notification
   - Update submission tracker

## Security & Privacy

- ✅ **Secure Authentication** - JWT tokens stored locally
- ✅ **No Data Storage** - Extension doesn't store application data
- ✅ **User Control** - Autofill only activates on user command
- ✅ **No Credentials Stored** - Never stores lender login credentials
- ✅ **HTTPS Only** - All API communication over HTTPS

## Troubleshooting

### Extension Not Loading
- Ensure developer mode is enabled in `chrome://extensions/`
- Check for errors in the extension's background console
- Reload the extension

### Login Fails
- Verify your Pinnacle Portal credentials
- Check that the backend is running
- Ensure correct API_BASE_URL in popup.js

### Autofill Doesn't Start
- Ensure you're on the actual form page (not homepage)
- Check browser console for errors (F12)
- Verify the application exists in your portal

### Form Not Filling Correctly
- The AI might not recognize all fields
- Manually fill missed fields
- Report the lender URL to support for improvement

### CAPTCHA Handling
- Solve the CAPTCHA manually
- The extension will automatically resume
- Some sites may have additional verification

## Known Limitations

- Cannot bypass CAPTCHAs (requires manual solving)
- May struggle with highly customized/unusual forms
- Requires JavaScript-enabled sites
- Limited to visible form fields (no shadow DOM support yet)

## Future Enhancements

- [ ] Shadow DOM support
- [ ] Multi-page form handling
- [ ] Automatic lender site login
- [ ] Success detection and confirmation
- [ ] Form field highlighting during execution
- [ ] Batch submissions to multiple lenders
- [ ] Form screenshot capture for debugging
- [ ] Smart CAPTCHA detection and alerts

## Support

For issues or questions:
- Email: support@pinnacleautofinance.com
- Portal: https://portal.pinnacleautofinance.com/support

## License

Proprietary - Pinnacle Auto Finance
