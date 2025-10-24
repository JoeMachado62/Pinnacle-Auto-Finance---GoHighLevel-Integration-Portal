# BrowserBase + Stagehand Setup Guide
**Auto Fill Agent - Sprint 4 Automation Service**

## 🎯 Overview

This guide walks through setting up the **browser automation infrastructure** that powers the Auto Fill Agent's ability to submit credit applications to multiple lenders automatically.

### Architecture
```
Client fills 1 application
         ↓
Node.js API receives submission request
         ↓
Calls Python FastAPI service
         ↓
Stagehand (vision AI) + BrowserBase (cloud browser)
         ↓
Navigates & fills each lender's form
         ↓
Returns results to Node.js
         ↓
Updates database, sends client notifications
```

---

## 📋 Prerequisites

1. **BrowserBase Account** (cloud browser service)
2. **Python 3.9+** installed on server
3. **Node.js** already running (✅ You have this)
4. **Anthropic API Key** (✅ You already have this)

---

## Step 1: Create BrowserBase Account

### 1.1 Sign Up
Visit: https://www.browserbase.com/

- Click "Start for Free"
- Sign up with email
- Verify email address

### 1.2 Create a Project
1. After login, go to Dashboard
2. Click "Create Project"
3. Name it: `Pinnacle Auto Fill Agent`
4. Click "Create"

### 1.3 Get Credentials
1. Click on your new project
2. Go to "API Keys" tab
3. Click "Create API Key"
4. Copy the **API Key** (starts with `bb_api_`)
5. Copy the **Project ID** (looks like: `proj_abc123xyz`)

### 1.4 Update .env File
```bash
BROWSERBASE_API_KEY=bb_api_xxxxxxxxxxxxxxxxxxxxxxxx
BROWSERBASE_PROJECT_ID=proj_xxxxxxxxxxxxxxxx
```

---

## Step 2: Install Python Dependencies

### 2.1 Install Python (if not already installed)
```bash
# Check if Python 3.9+ is installed
python3 --version

# If not installed (Ubuntu/Debian):
sudo apt update
sudo apt install python3.9 python3.9-pip python3.9-venv -y
```

### 2.2 Create Python Virtual Environment
```bash
cd /var/www/paf-ghl
python3 -m venv venv-autofill
source venv-autofill/bin/activate
```

### 2.3 Install Required Packages
```bash
pip install --upgrade pip

# Core automation packages
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install stagehand-ai==0.1.0
pip install browserbase==0.1.0

# Additional dependencies
pip install python-dotenv==1.0.0
pip install httpx==0.25.1
pip install pydantic==2.5.0
pip install aiofiles==23.2.1
```

### 2.4 Verify Installation
```bash
python -c "import stagehand; import browserbase; print('✅ All packages installed!')"
```

---

## Step 3: Create Python Automation Service

### 3.1 Project Structure
```
/var/www/paf-ghl/
├── autofill-service/
│   ├── main.py              # FastAPI server
│   ├── stagehand_client.py  # Stagehand wrapper
│   ├── lender_templates.py  # Lender-specific logic
│   ├── email_parser.py      # Parse lender responses
│   └── requirements.txt     # Python dependencies
├── venv-autofill/           # Python virtual env
└── .env                     # Shared config
```

### 3.2 Create Service Directory
```bash
mkdir -p /var/www/paf-ghl/autofill-service
cd /var/www/paf-ghl/autofill-service
```

### 3.3 Create main.py (FastAPI Server)
```python
# autofill-service/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from stagehand_client import StagehandAutomation

load_dotenv()

app = FastAPI(title="Pinnacle Auto Fill Service")

class LenderSubmission(BaseModel):
    submission_id: str
    lender_url: str
    lender_name: str
    application_data: dict

@app.post("/submit-to-lender")
async def submit_to_lender(submission: LenderSubmission):
    """
    Submit credit application to a single lender using Stagehand
    """
    try:
        automation = StagehandAutomation(
            browserbase_api_key=os.getenv("BROWSERBASE_API_KEY"),
            browserbase_project_id=os.getenv("BROWSERBASE_PROJECT_ID")
        )

        result = await automation.fill_application(
            url=submission.lender_url,
            data=submission.application_data
        )

        return {
            "success": True,
            "submission_id": submission.submission_id,
            "result": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "autofill"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3.4 Create stagehand_client.py
```python
# autofill-service/stagehand_client.py
from stagehand import Stagehand
import asyncio

class StagehandAutomation:
    def __init__(self, browserbase_api_key: str, browserbase_project_id: str):
        self.browserbase_api_key = browserbase_api_key
        self.browserbase_project_id = browserbase_project_id

    async def fill_application(self, url: str, data: dict):
        """
        Use Stagehand to navigate and fill lender form
        """
        async with Stagehand(
            browserbase_api_key=self.browserbase_api_key,
            browserbase_project_id=self.browserbase_project_id
        ) as stagehand:

            # Navigate to lender page
            await stagehand.page.goto(url)
            await stagehand.page.wait_for_load_state("networkidle")

            # Stagehand uses AI vision to find and fill fields
            # No brittle CSS selectors needed!

            # Fill first name
            await stagehand.act(f"Fill in the first name field with {data['firstName']}")

            # Fill last name
            await stagehand.act(f"Fill in the last name field with {data['lastName']}")

            # Fill email
            await stagehand.act(f"Fill in the email field with {data['email']}")

            # Fill phone
            await stagehand.act(f"Fill in the phone number field with {data['phone']}")

            # Fill SSN
            await stagehand.act(f"Fill in the social security number field with {data['ssn']}")

            # Fill income
            await stagehand.act(f"Fill in the annual income field with {data['annualIncome']}")

            # Fill employment
            await stagehand.act(f"Fill in the employer name field with {data['employerName']}")

            # Fill address
            await stagehand.act(f"Fill in the street address field with {data['address']}")
            await stagehand.act(f"Fill in the city field with {data['city']}")
            await stagehand.act(f"Fill in the state field with {data['state']}")
            await stagehand.act(f"Fill in the zip code field with {data['zipCode']}")

            # Vehicle information
            if 'vehicleYear' in data:
                await stagehand.act(f"Fill in the vehicle year field with {data['vehicleYear']}")
                await stagehand.act(f"Fill in the vehicle make field with {data['vehicleMake']}")
                await stagehand.act(f"Fill in the vehicle model field with {data['vehicleModel']}")

            # Loan amount
            if 'loanAmount' in data:
                await stagehand.act(f"Fill in the loan amount field with {data['loanAmount']}")

            # Submit form
            await stagehand.act("Click the submit button")

            # Wait for confirmation
            await stagehand.page.wait_for_load_state("networkidle")

            # Extract result
            result = await stagehand.extract({
                "instruction": "Extract the confirmation message or error message from the page",
                "schema": {
                    "status": "string (approved/pending/declined/error)",
                    "message": "string",
                    "confirmationNumber": "string (if available)"
                }
            })

            # Take screenshot for debugging
            screenshot = await stagehand.page.screenshot(full_page=True)

            return {
                "status": result.get("status"),
                "message": result.get("message"),
                "confirmationNumber": result.get("confirmationNumber"),
                "screenshot": screenshot.hex()
            }
```

### 3.5 Create requirements.txt
```bash
cat > requirements.txt <<EOF
fastapi==0.104.1
uvicorn[standard]==0.24.0
stagehand-ai==0.1.0
browserbase==0.1.0
python-dotenv==1.0.0
httpx==0.25.1
pydantic==2.5.0
aiofiles==23.2.1
EOF
```

---

## Step 4: Start the Automation Service

### 4.1 Activate Virtual Environment
```bash
cd /var/www/paf-ghl
source venv-autofill/bin/activate
```

### 4.2 Test the Service
```bash
cd autofill-service
python main.py
```

You should see:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4.3 Test Health Endpoint
In another terminal:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status":"healthy","service":"autofill"}
```

### 4.4 Run as Background Service (PM2)
```bash
# Install PM2 if not already installed
npm install -g pm2

# Start Python service with PM2
pm2 start /var/www/paf-ghl/venv-autofill/bin/python \
  --name "autofill-service" \
  --interpreter none \
  -- /var/www/paf-ghl/autofill-service/main.py

# Save PM2 configuration
pm2 save

# Set PM2 to start on reboot
pm2 startup
```

---

## Step 5: Connect Node.js to Python Service

### 5.1 Update config/index.js
Add BrowserBase config validation:
```javascript
// config/index.js
module.exports = {
    // ... existing config ...

    // BrowserBase & Stagehand
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    STAGEHAND_ENABLED: process.env.STAGEHAND_ENABLED === 'true',
    STAGEHAND_SERVICE_URL: process.env.STAGEHAND_SERVICE_URL || 'http://localhost:8000',
    STAGEHAND_TIMEOUT: parseInt(process.env.STAGEHAND_TIMEOUT) || 120000,

    // Auto Fill Agent
    AUTOFILL_PARALLEL_SUBMISSIONS: process.env.AUTOFILL_PARALLEL_SUBMISSIONS === 'true',
    AUTOFILL_MAX_CONCURRENT_LENDERS: parseInt(process.env.AUTOFILL_MAX_CONCURRENT_LENDERS) || 5
};
```

### 5.2 Update autofillAgentService.js
Add Python service integration:
```javascript
// services/autofillAgentService.js

async submitToLender(submissionId, lenderUrl, lenderName, applicationData) {
    const config = require('../config');

    if (!config.STAGEHAND_ENABLED) {
        throw new Error('Stagehand automation is not enabled');
    }

    try {
        const response = await fetch(`${config.STAGEHAND_SERVICE_URL}/submit-to-lender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submission_id: submissionId,
                lender_url: lenderUrl,
                lender_name: lenderName,
                application_data: this._formatApplicantData(applicationData)
            }),
            timeout: config.STAGEHAND_TIMEOUT
        });

        const result = await response.json();

        if (result.success) {
            logger.info('Lender submission successful', {
                submissionId,
                lenderName,
                status: result.result.status
            });

            return {
                success: true,
                status: result.result.status,
                message: result.result.message,
                confirmationNumber: result.result.confirmationNumber
            };
        } else {
            throw new Error(result.detail || 'Submission failed');
        }
    } catch (error) {
        logger.error('Lender submission error', {
            submissionId,
            lenderName,
            error: error.message
        });
        throw error;
    }
}
```

---

## Step 6: Enable Automation

### 6.1 Update .env
```bash
STAGEHAND_ENABLED=true
```

### 6.2 Restart Services
```bash
# Restart Node.js server
pm2 restart paf-portal

# Verify Python service is running
pm2 status
```

You should see both services:
```
┌─────┬──────────────────┬─────────┬─────────┬─────────┐
│ id  │ name             │ status  │ cpu     │ memory  │
├─────┼──────────────────┼─────────┼─────────┼─────────┤
│ 0   │ paf-portal       │ online  │ 0.2%    │ 85.2 MB │
│ 1   │ autofill-service │ online  │ 0.1%    │ 120 MB  │
└─────┴──────────────────┴─────────┴─────────┴─────────┘
```

---

## Step 7: Test End-to-End Flow

### 7.1 Create Test Submission
```bash
curl -X POST http://localhost:3000/api/client/submit-to-lenders \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "app_123",
    "lenderIds": ["lender_test_001"]
  }'
```

### 7.2 Monitor Logs
```bash
# Node.js logs
pm2 logs paf-portal

# Python service logs
pm2 logs autofill-service
```

---

## 📊 Cost Estimate

### BrowserBase Pricing (as of 2025)
- **Free Tier**: 100 sessions/month (perfect for testing)
- **Starter**: $50/month for 500 sessions
- **Professional**: $200/month for 2,500 sessions

### Cost Per Client Application
```
1 client application → 10 lenders
10 lenders × $0.10/session = $1.00 per client

Revenue model:
- Charge dealer $5-10 per automated submission
- Cost: $1.00 (BrowserBase) + $0.30 (Claude API)
- Profit: $3.70-$8.70 per client
```

### Monthly Volume Estimate
```
100 clients/month × 10 lenders = 1,000 sessions
Cost: 1,000 × $0.10 = $100/month (BrowserBase)
      1,000 × $0.03 = $30/month (Claude Sonnet)
Total: $130/month automation cost

Revenue: 100 clients × $7 = $700/month
Profit: $570/month
```

---

## 🔧 Troubleshooting

### Issue: BrowserBase API Key Invalid
```bash
# Verify credentials
curl -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
  https://www.browserbase.com/v1/projects/$BROWSERBASE_PROJECT_ID
```

### Issue: Stagehand Package Not Found
```bash
# Reinstall in virtual environment
source venv-autofill/bin/activate
pip install --upgrade stagehand-ai
```

### Issue: Python Service Won't Start
```bash
# Check Python version
python3 --version  # Must be 3.9+

# Check port availability
lsof -i:8000

# Check logs
pm2 logs autofill-service --lines 100
```

### Issue: Connection Timeout
```bash
# Increase timeout in .env
STAGEHAND_TIMEOUT=180000  # 3 minutes

# Restart services
pm2 restart all
```

---

## 🎯 Next Steps After Setup

1. **Test with Real Lender** - Start with one lender (Chase, Capital One)
2. **Add Error Handling** - Screenshot on failure, retry logic
3. **Email Parsing** - Parse confirmation emails for loan terms
4. **Dashboard Integration** - Show real-time progress in client UI
5. **Parallel Processing** - Submit to 5 lenders simultaneously

---

## 📚 Additional Resources

- **BrowserBase Docs**: https://docs.browserbase.com/
- **Stagehand GitHub**: https://github.com/browserbase/stagehand
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Playwright (underlying tech)**: https://playwright.dev/

---

**Status**: Configuration ready, awaiting BrowserBase credentials
**Next Action**: Sign up for BrowserBase account and add API keys to .env
