# Auto Fill Agent - Installation Guide

## Quick Start (Development Mode)

### Step 1: Load the Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Navigate to and select: `/var/www/paf-ghl/chrome-extension/`
6. The Auto Fill Agent icon should now appear in your browser toolbar

### Step 2: Pin the Extension (Optional but Recommended)

1. Click the puzzle piece icon (Extensions) in Chrome toolbar
2. Find "Auto Fill Agent"
3. Click the pin icon to pin it to your toolbar

### Step 3: First Time Setup

1. Click the Auto Fill Agent icon in your toolbar
2. Login with your Pinnacle Portal credentials:
   - Email: Your dealer email
   - Password: Your portal password
3. The extension will remember your login

---

## Using the Extension

### To Autofill a Lender Application:

1. **Navigate to a lender's website** (e.g., chase.com/auto-loans)
2. **Go to their application form page**
3. **Click the Auto Fill Agent icon** in your toolbar
4. **Select an application** from your list
5. **Click "Start Autofill"**
6. **Watch as the form fills automatically!**

### If the Extension Pauses:

- **For CAPTCHAs:** Solve the CAPTCHA manually, then the extension will continue
- **For complex fields:** Fill in the requested field manually, then click "Resume"

---

## Troubleshooting

### Extension Not Showing in Chrome

- Make sure Developer mode is enabled
- Try reloading the extension (click refresh icon in chrome://extensions/)
- Check that all files are present in the extension folder

### Login Fails

- Verify your credentials work on portal.pinnacleautofinance.com
- Check that the server is running
- Clear browser cache and try again

### Autofill Not Starting

- Make sure you're on the actual application form page
- Ensure the application exists in your portal
- Check browser console (F12) for errors

### Form Not Filling Correctly

- The AI generates a custom plan for each lender
- Some unusual forms may require manual intervention
- Report problematic lenders to support for improvement

---

## Configuration

### Changing API Endpoint

Edit `popup/popup.js` and `content/content-script.js`:

```javascript
// For production (default)
const API_BASE_URL = 'https://portal.pinnacleautofinance.com';

// For development
const API_BASE_URL = 'http://localhost:3000';
```

---

## Viewing Submission History

1. Login to https://portal.pinnacleautofinance.com
2. Navigate to **Submission Tracker**
3. View all your Auto Fill submissions
4. Update statuses (Approved/Declined)
5. View detailed logs

---

## Security & Privacy

✅ **Your data is secure:**
- Extension only activates when you click it
- No data sent to third parties
- Lender credentials are never stored
- All communication over HTTPS

✅ **What we track:**
- Which lenders you submit to
- Success/failure of autofills
- Number of manual interventions
- Timestamps

❌ **What we DON'T track:**
- Your lender login credentials
- Browsing history
- Personal browsing data

---

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Auto Fill Agent"
3. Click "Remove"

Your submission history will remain in the portal.

---

## Support

- **Portal:** https://portal.pinnacleautofinance.com
- **Email:** support@pinnacleautofinance.com
- **Issues:** Report bugs or lender compatibility issues through portal support

---

## Known Limitations

- Cannot bypass CAPTCHAs (requires manual solving)
- Some highly customized forms may not work
- Multi-page applications may require multiple runs
- JavaScript must be enabled

---

## Updates

The extension will notify you when updates are available. To manually update:

1. Pull latest code from repository
2. Go to `chrome://extensions/`
3. Click refresh icon on Auto Fill Agent

---

## Development Notes

For developers working on the extension:

**Testing Changes:**
1. Make code changes
2. Go to `chrome://extensions/`
3. Click refresh icon on extension
4. Test on a lender site

**Debugging:**
- **Popup:** Right-click extension icon → "Inspect popup"
- **Content Script:** Open browser DevTools (F12) on lender page
- **Background:** Click "service worker" link in chrome://extensions/

**Key Files:**
- `manifest.json` - Extension configuration
- `popup/popup.js` - Main UI logic
- `content/content-script.js` - Form interaction logic
- `background/service-worker.js` - Background tasks

---

## Version History

- **v1.0.0** (Current) - Initial release
  - AI-powered plan generation with Claude Sonnet 4.5
  - Support for standard lender forms
  - CAPTCHA pause/resume
  - Submission tracking
  - Manual intervention support

---

**Last Updated:** October 23, 2025
