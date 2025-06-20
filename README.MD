# Pinnacle Auto Finance - GHL Integration Portal: Project Plan

**Version:** 1.0
**Date:** June 18, 2025
**Project Goal:** To build a dealer portal using GoHighLevel (GHL) as the backend CRM and workflow engine, integrated with a custom HTML credit application form and a local DealerTrack (DT) automation agent. This replaces a previous WordPress-based system.

## Table of Contents
1.  [Project Overview & Architecture](#project-overview--architecture)
2.  [Prerequisites & Setup](#prerequisites--setup)
3.  [Phase 1: Core GHL Integration & Credit Application Submission (VPS Backend)](#phase-1-core-ghl-integration--credit-application-submission-vps-backend)
4.  [Phase 2: HTML Credit Application Frontend](#phase-2-html-credit-application-frontend)
5.  [Phase 3: Local DealerTrack Agent (Puppeteer/Chrome Extension)](#phase-3-local-dealertrack-agent-puppeteerchrome-extension)
6.  [Phase 4: Communication Bridge between VPS and Local DT Agent](#phase-4-communication-bridge-between-vps-and-local-dt-agent)
7.  [Phase 5: GHL Dashboard & Deal Jacket Display](#phase-5-ghl-dashboard--deal-jacket-display)
8.  [Phase 6: GHL Workflow Automation](#phase-6-ghl-workflow-automation)
9.  [Phase 7: Security, Logging, Error Handling & Deployment](#phase-7-security-logging-error-handling--deployment)
10. [Future Considerations (Out of Scope for Initial Build)](#future-considerations-out-of-scope-for-initial-build)

---

## 1. Project Overview & Architecture

This project will create a portal for auto dealerships to submit credit applications.

**Key Components:**

1.  **Central Server (Node.js on VPS):**
    *   Hosts API endpoints.
    *   Handles GHL API interactions (creating contacts, opportunities, updating stages).
    *   Serves as the communication bridge for the Local DT Agent.
    *   (Potentially) Hosts custom dashboard elements using GHL Sites or a lightweight framework.
2.  **HTML Credit Application Frontend:**
    *   The existing `credit_application.html` file (or a GHL Form if preferred later).
    *   Submits data to the Central Server.
3.  **Local DealerTrack (DT) Agent (Dealer's Windows Machine):**
    *   A Node.js/Puppeteer script OR a Chrome Extension.
    *   Runs on the dealer's local machine.
    *   Interacts with an already logged-in DealerTrack session in Chrome.
    *   Polls the Central Server for tasks (new apps to submit, statuses to update).
    *   Submits data to DealerTrack and scrapes results/statuses.
    *   Sends updates back to the Central Server.
4.  **GoHighLevel (GHL):**
    *   Acts as the CRM (Contacts with custom fields).
    *   Manages the "Deals Pipeline" and Opportunity stages.
    *   Powers workflows for notifications and internal processes.

**Data Flow (Credit Application):**
HTML Form -> Central Server (VPS) -> GHL (Contact/Opportunity Created) -> Central Server adds to "DT Task Queue" -> Local DT Agent polls VPS -> Local DT Agent submits to DT -> Local DT Agent sends DT status to VPS -> Central Server updates GHL.

---

## 2. Prerequisites & Setup

### 2.1. VPS Server Setup
    *   [ ] Provision a VPS (e.g., Ubuntu).
    *   [ ] Install Node.js (version 18+ as per `package.json`).
    *   [ ] Install a process manager (e.g., PM2).
    *   [ ] Configure firewall (allow HTTP/S, SSH).
    *   [ ] Set up project directory (e.g., `/var/www/paf-ghl/`).
    *   [ ] Clone project repository (once created).
    *   [ ] Run `npm install` to install dependencies from `package.json`.

### 2.2. GoHighLevel Configuration
    *   [ ] **Sub-account Setup:** Ensure the Pinnacle Auto Finance sub-account is active.
    *   [ ] **Private Integration Token:**
        *   In the GHL sub-account, navigate to Settings -> (Labs/API/Integrations) -> Private Integrations.
        *   Generate a new token. Name: "PAF Portal Integration".
        *   **Scopes Required (Minimum):**
            *   `contacts.readonly`, `contacts.write`
            *   `opportunities.readonly`, `opportunities.write`
            *   `pipelines.readonly` (to verify IDs, not strictly needed runtime if hardcoded)
            *   `custom_fields.readonly` (useful for dev/debug)
            *   `workflows.readonly`, `workflows.write` (if triggering GHL workflows via API)
            *   `files.readonly`, `files.write` (if handling document uploads to GHL)
        *   Store this token securely.
    *   [ ] **Custom Fields:**
        *   Verify all custom fields listed in `ghl_detailed_custom_fields.csv` are created in the GHL sub-account (Settings -> Custom Fields).
        *   Ensure data types match (Text, Numerical, Date, Phone, etc.).
    *   [ ] **Pipeline & Stages:**
        *   Create **one** pipeline named "Pinnacle Pipeline" (or similar).
        *   Define the agreed-upon stages within this pipeline (e.g., "New Deal Submitted", "Conditional Approval", "Deal Funded", "Declined", etc.).

### 2.3. `.env` File for VPS Server
    *   [ ] Based on the provided `.env.example` and the IDs gathered:
        *   Create a `.env` file in the root of the VPS project.
        *   Populate `GHL_API_KEY` (Private Integration Token).
        *   Populate `GHL_LOCATION_ID`.
        *   Populate `GHL_DEALS_PIPELINE_ID` and all `GHL_DEALS_STAGE_*` IDs.
        *   Generate and populate `ENCRYPTION_KEY`, `ENCRYPTION_IV_KEY`, `API_SECRET_KEY`, `JWT_SECRET`, `GHL_WEBHOOK_SECRET` using the provided Node.js crypto script.
        *   Configure `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `LOG_FILE_PATH`.
    *   [ ] Ensure `.env` is added to `.gitignore`.

### 2.4. Development Tools
    *   [ ] Code Editor (e.g., VS Code).
    *   [ ] Postman (for API testing).
    *   [ ] Git (for version control).

---

## 3. Phase 1: Core GHL Integration & Credit Application Submission (VPS Backend)

**Goal:** Create the Node.js/Express server on the VPS to receive credit application data and create corresponding Contact and Opportunity records in GHL.

### 3.1. Project Structure (VPS - `server.js` and related modules)
    *   [ ] Initialize Express app in `server.js`.
    *   [ ] Load environment variables using `dotenv`.
    *   [ ] Implement basic middleware (CORS, Helmet, body-parser for JSON).
    *   [ ] Setup Winston logger.
    *   [ ] Create a `config/` directory for GHL constants (base URL, API version).
    *   [ ] Create a `services/ghlApiService.js` module for all GHL API interactions.
    *   [ ] Create a `routes/applicationRoutes.js` module for credit app submission.
    *   [ ] Create a `utils/encryption.js` (if encrypting SSN/DL before GHL storage).

### 3.2. GHL API Service (`services/ghlApiService.js`)
    *   [ ] Function `createGhlContact(contactData)`:
        *   Takes application data as input.
        *   Maps form data to GHL standard fields (firstName, lastName, email, phone, tags, source).
        *   Maps form data to GHL custom fields using the `ghl_detailed_custom_fields.csv` mapping (using custom field IDs).
        *   Constructs the payload for `POST /contacts/`.
        *   Makes the API call using `axios` with `Authorization: Bearer GHL_API_KEY` and `Version` headers.
        *   Returns the created GHL contact's ID.
        *   Handles API errors robustly.
    *   [ ] Function `createGhlOpportunity(contactId, opportunityData)`:
        *   Takes GHL `contactId` and application data.
        *   Constructs payload for `POST /opportunities/`.
        *   Sets `pipelineId` (from `.env`).
        *   Sets initial `stageId` (e.g., "New Deal Submitted" from `.env`).
        *   Sets opportunity `name`, `monetaryValue` (e.g., amount financed), `status` ("open").
        *   Associates with the `contactId`.
        *   Makes the API call.
        *   Returns the created GHL opportunity's ID.
        *   Handles API errors.
    *   [ ] Function `updateGhlOpportunityStage(opportunityId, newStageId)`:
        *   Takes `opportunityId` and new `stageId`.
        *   Constructs payload for `PUT /opportunities/{opportunityId}`.
        *   Makes the API call.
    *   [ ] Function `updateGhlContactCustomFields(contactId, customFieldsArray)`:
        *   Takes `contactId` and an array of custom fields to update.
        *   Makes `PUT /contacts/{contactId}` call.

### 3.3. Credit Application API Endpoint (`routes/applicationRoutes.js`)
    *   [ ] Define `POST /api/credit-application/submit` endpoint.
    *   [ ] **Receive Data:** Get JSON payload from the HTML form.
    *   [ ] **Validate Data:** Perform server-side validation (required fields, formats).
    *   [ ] **(Optional) Encrypt Sensitive Data:** If SSN/DL are to be encrypted before GHL, do it here.
    *   [ ] **Call GHL Service:**
        *   `const contactId = await ghlApiService.createGhlContact(parsedFormData);`
        *   `const opportunityId = await ghlApiService.createGhlOpportunity(contactId, parsedFormData);`
    *   [ ] **Respond to Frontend:** Send success (with `contactId`, `opportunityId`) or error response.
    *   [ ] **Add to DT Task Queue:** (This will be developed in Phase 4). For now, log that it needs DT submission.

### 3.4. Basic Server Setup (`server.js`)
    *   [ ] Integrate routes.
    *   [ ] Start the Express server listening on `PORT` from `.env`.
    *   [ ] Implement basic error handling middleware.

**Testing for Phase 1:**
    *   [ ] Use Postman to send a sample credit application JSON to `/api/credit-application/submit`.
    *   [ ] Verify a new Contact is created in GHL with all standard and custom fields populated correctly.
    *   [ ] Verify a new Opportunity is created in GHL, linked to the contact, and in the correct initial pipeline/stage.

---

## 4. Phase 2: HTML Credit Application Frontend

**Goal:** Ensure the existing `credit_application.html` can submit data to the new VPS backend.

### 4.1. Update `credit_application.html` JavaScript
    *   [ ] **Target URL:** Modify the form submission JavaScript to `POST` to `https://your-vps-domain.com/api/credit-application/submit` (or the correct endpoint defined in Phase 1).
    *   [ ] **Data Packaging:** Ensure JavaScript collects all form fields and packages them into a JSON object that the backend expects.
        *   Ensure field names/IDs in the HTML match what the backend expects for mapping to GHL. Refer to `ghl_detailed_custom_fields.csv` for GHL target fields.
        *   Handle co-borrower data correctly (if submitted, include it).
    *   [ ] **Request Headers:** Set `Content-Type: application/json`.
    *   [ ] **Response Handling:** Update JavaScript to handle success/error responses from the VPS server (e.g., show confirmation message, display errors).
    *   [ ] **Client-Side Validation:** Retain existing client-side validation for better UX, but remember server-side validation is crucial.

**Testing for Phase 2:**
    *   [ ] Open `credit_application.html` in a browser.
    *   [ ] Fill out and submit the form.
    *   [ ] Verify data is received by the VPS backend.
    *   [ ] Verify Contact and Opportunity are created in GHL as in Phase 1 testing.
    *   [ ] Verify appropriate success/error messages are shown on the HTML page.

---

## 5. Phase 3: Local DealerTrack Agent (Puppeteer/Chrome Extension)

**Goal:** Develop the local agent that runs on the dealer's machine to interact with DealerTrack.
**Decision Point:** Choose between a standalone Node.js/Puppeteer script or a Chrome Extension. For a novice team, a standalone script might be simpler initially unless there's strong Chrome Extension experience. This plan will assume a Node.js/Puppeteer script.

### 5.1. Local Agent Project Setup
    *   [ ] Create a new Node.js project for the local agent.
    *   [ ] Install dependencies: `puppeteer`, `axios`, `dotenv`, `node-cron`.
    *   [ ] Create a local configuration file (e.g., `local-config.env` or `local-config.json`) for:
        *   `CENTRAL_SERVER_API_BASE_URL` (e.g., `https://your-vps-domain.com/api`)
        *   `CENTRAL_SERVER_API_KEY` (this is the `API_SECRET_KEY` from the VPS `.env`)
        *   `POLL_INTERVAL_NEW_JOBS_MS` (e.g., 60000 for 1 minute)
        *   `POLL_INTERVAL_DT_UPDATES_MS` (e.g., 300000 for 5 minutes)
        *   (Optional) Paths for local state/queue files.

### 5.2. Core Puppeteer Logic
    *   [ ] Function `launchBrowser()`: Launches Chrome, potentially using an existing user data directory if trying to leverage existing sessions (this can be tricky and browser policies might interfere). The primary plan is to use a tab where DT is already logged in.
    *   [ ] Function `navigateToDealerTrackLogin()`: (If not relying on an already open tab) Navigates to DT login. The current plan avoids this.
    *   [ ] Function `findOpenDealerTrackTab(browser)`: Logic to find an existing, active DealerTrack tab where the user is logged in. This is key.
    *   [ ] Function `submitApplicationToDT(page, applicationData)`:
        *   Takes a Puppeteer `page` object (the active DT tab) and application data.
        *   Navigates to the DT credit application entry form.
        *   Fills in all form fields using `page.type()`, `page.select()`, `page.click()`.
        *   Handles multi-step forms, conditional logic within DT.
        *   Submits the form in DT.
        *   Attempts to scrape a DT Reference Number and initial submission status.
        *   Returns `{ success: true, dtReferenceNumber: '...', dtStatus: '...' }` or `{ success: false, error: '...' }`.
    *   [ ] Function `checkApplicationStatusInDT(page, dtReferenceNumber)`:
        *   Navigates to the DT status lookup page for the given reference number.
        *   Scrapes the current status and any decision details/stipulations.
        *   Returns `{ dtStatus: '...', details: '...' }`.

### 5.3. Local State Management (Simple)
    *   [ ] Use a simple local JSON file (e.g., `dt-queue.json`) to store:
        *   `pendingSubmissions`: Array of `{ ghlOpportunityId, applicationData }` received from VPS, waiting for DT submission.
        *   `submittedToDt`: Array of `{ ghlOpportunityId, dtReferenceNumber, lastCheckedStatus }` for tracking.
    *   [ ] Implement functions to read/write to this JSON file safely.

**Testing for Phase 3 (Standalone, before VPS integration):**
    *   [ ] Manually create a sample `applicationData` object.
    *   [ ] Run the Puppeteer script to attempt to submit this data to a *test* DealerTrack environment (if available) or carefully to live with test data.
    *   [ ] Verify form fields are filled correctly.
    *   [ ] Verify ability to scrape a reference number.

---

## 6. Phase 4: Communication Bridge between VPS and Local DT Agent

**Goal:** Enable the Local DT Agent to poll the VPS for tasks and send back updates.

### 6.1. VPS API Endpoints for Local DT Agent
    *   [ ] In `routes/dealertrackProxyRoutes.js` (or similar) on the VPS:
        *   **Endpoint 1: `GET /api/dealertrack/pending-actions`**
            *   **Authentication:** Verify `X-Internal-API-Key` header matches `API_SECRET_KEY` from `.env`.
            *   **Logic:**
                *   Fetch GHL Opportunities from the "New Deal Submitted" stage (or a designated "Ready for DT" stage) that haven't been sent to an agent yet.
                *   Fetch GHL Opportunities that have new documents/info needing a DT update (based on a tag/custom field like `DT_Sync_Needed: true`).
                *   **Response:** JSON array of tasks, e.g.,
                    ```json
                    {
                      "newSubmissions": [ { "ghlOpportunityId": "...", "ghlContactId": "...", "applicationData": { ... } } ],
                      "updatesForDt": [ { "ghlOpportunityId": "...", "dtReferenceNumber": "...", "updateType": "new_document", "documentDetails": { ... } } ]
                    }
                    ```
                *   Mark fetched tasks as "processing by agent" in GHL (e.g., move to "Submitted to DT" stage or add a tag) to prevent re-sending.
        *   **Endpoint 2: `POST /api/dealertrack/update-status`**
            *   **Authentication:** Verify `X-Internal-API-Key`.
            *   **Request Body:** JSON payload from Local DT Agent, e.g.,
                ```json
                {
                  "updates": [
                    { "ghlOpportunityId": "...", "dtReferenceNumber": "...", "dtStatus": "Approved", "decisionDetails": "...", "stips": [...] },
                    { "ghlOpportunityId": "...", "dtSubmissionError": "...", "dtStatus": "Error" }
                  ]
                }
                ```
            *   **Logic:**
                *   For each update, call `ghlApiService` to:
                    *   Update GHL Opportunity stage (e.g., "Conditional Approval", "Declined").
                    *   Update relevant GHL Contact custom fields (DT Ref No, decision details).
                    *   Trigger GHL Workflows if needed.
            *   **Response:** `{"success": true}`.

### 6.2. Local DT Agent Polling Logic
    *   [ ] **Main Loop (`node-cron`): Poll for New Submissions**
        *   Runs every X minutes (e.g., 1 minute).
        *   Calls `GET /api/dealertrack/pending-actions` on VPS.
        *   If `newSubmissions` received:
            *   Add them to its local `pendingSubmissions` queue (e.g., `dt-queue.json`).
            *   Iterate through the queue:
                *   Launch/find DT browser tab.
                *   `const result = await submitApplicationToDT(page, appData);`
                *   Call `POST /api/dealertrack/update-status` on VPS with the `result`.
                *   Remove from local `pendingSubmissions` queue upon successful VPS update.
        *   If `updatesForDt` received:
            *   Process these updates (e.g., upload new documents to existing DT deals). This logic will be more complex.
            *   Report completion/status back to VPS.
    *   [ ] **Secondary Loop (`node-cron`): Poll for Status of Already Submitted Apps (Optional but Recommended)**
        *   Runs every Y minutes (e.g., 15-30 minutes).
        *   Iterate through its local `submittedToDt` list.
        *   For each, `const status = await checkApplicationStatusInDT(page, dtRefNo);`
        *   If status changed, call `POST /api/dealertrack/update-status` on VPS.

**Testing for Phase 4:**
    *   [ ] Start VPS server.
    *   [ ] Manually create a "New Deal Submitted" opportunity in GHL via Postman (or HTML form).
    *   [ ] Run Local DT Agent script.
    *   [ ] Verify Local Agent polls VPS and receives the task.
    *   [ ] Verify Local Agent attempts DT submission (mocked or real).
    *   [ ] Verify Local Agent sends status update back to VPS.
    *   [ ] Verify GHL Opportunity stage and custom fields are updated by VPS.

---

## 7. Phase 5: GHL Dashboard & Deal Jacket Display

**Goal:** Display deal information and status to dealers, likely using GHL Sites with custom code, or a very lightweight embedded app.

### 7.1. VPS API Endpoints for Dashboard Data
    *   [ ] In `routes/dashboardRoutes.js` (or similar) on the VPS:
        *   **Endpoint: `GET /api/dashboard/deals`**
            *   **Authentication:** (Requires dealer user to be authenticated if this is a custom dashboard. If using GHL Sites with user login, GHL handles auth. If it's a public page with a token, secure it.) For now, assume GHL Sites will call these if needed, or secure with JWT if you build separate dealer auth.
            *   **Logic:**
                *   Get `locationId` and potentially `contactId` of the logged-in dealer (this mapping needs to be established if not using GHL's native user system for the dashboard).
                *   Fetch all GHL Opportunities for that dealer from the "Pinnacle Pipeline".
                *   For each opportunity, fetch linked GHL Contact data (including relevant custom fields for display).
                *   Format data for dashboard display (status, applicant name, amount, DT ref no).
            *   **Response:** JSON array of deal summaries.
        *   **Endpoint: `GET /api/dashboard/deal/{opportunityId}`**
            *   **Authentication:** As above.
            *   **Logic:**
                *   Fetch specific GHL Opportunity.
                *   Fetch linked GHL Contact and all its custom fields (the full "deal jacket" data).
                *   Fetch related communications, documents (if stored in GHL Files).
            *   **Response:** Detailed JSON for a single deal jacket.

### 7.2. Frontend Display (GHL Sites with Custom HTML/CSS/JS)
    *   [ ] Create a GHL Site/Page for the "Dealer Dashboard".
    *   [ ] Add Custom HTML/CSS/JS element.
    *   [ ] **JavaScript Logic:**
        *   On page load, make an AJAX call to `/api/dashboard/deals` on your VPS.
        *   Render the deals in a table (similar to WordPress dashboard design).
        *   Make table sortable, filterable.
        *   Link each deal to a "Deal Jacket" view/page.
    *   [ ] Create a GHL Site/Page template for the "Deal Jacket".
    *   [ ] **JavaScript Logic for Deal Jacket:**
        *   Takes `opportunityId` (e.g., from URL query param).
        *   Makes AJAX call to `/api/dashboard/deal/{opportunityId}`.
        *   Displays all information: customer details, vehicle, financials, DT status, communications log, document list/upload.
        *   Implement document upload directly to GHL contact files (requires frontend JS to call a VPS endpoint that then uses GHL API for file upload).
        *   Implement "Add Communication" form (submits to a VPS endpoint, which then creates GHL communication log entry).

**Testing for Phase 5:**
    *   [ ] With sample deals in GHL, access the dashboard page.
    *   [ ] Verify deals are listed correctly.
    *   [ ] Click a deal to view the deal jacket. Verify all data is displayed.
    *   [ ] Test document upload and communication posting.

---

## 8. Phase 6: GHL Workflow Automation

**Goal:** Leverage GHL Workflows for notifications and internal process steps.

### 8.1. Define Workflow Triggers and Actions in GHL
    *   [ ] **Workflow 1: New Application Submitted**
        *   **Trigger:** Opportunity created in "Pinnacle Pipeline" in stage "New Deal Submitted".
        *   **Actions:**
            *   Send internal notification to Pinnacle staff (e.g., via GHL Task, email, SMS).
            *   Send acknowledgment email/SMS to the dealer (confirming receipt by Pinnacle).
    *   [ ] **Workflow 2: DealerTrack Decision Received**
        *   **Trigger:** Opportunity stage changes to "Conditional Approval" OR "Declined".
        *   **Actions:**
            *   If "Conditional Approval": Send email/SMS to dealer with approval & next steps/stips. Assign task to Pinnacle staff to follow up.
            *   If "Declined": Send email/SMS to dealer with decline notification.
    *   [ ] **Workflow 3: Deal Funded**
        *   **Trigger:** Opportunity stage changes to "Deal Funded".
        *   **Actions:** Send congratulations email/SMS to dealer. Send internal notification for record keeping.
    *   [ ] Other workflows as needed (e.g., reminders for pending stips).

**Testing for Phase 6:**
    *   [ ] Manually (or via API in testing) move opportunities through stages in GHL.
    *   [ ] Verify workflows trigger and actions (emails, tasks) execute correctly.

---

## 9. Phase 7: Security, Logging, Error Handling & Deployment

**Goal:** Ensure the application is secure, robust, and deployable. This is an ongoing effort throughout all phases.

### 9.1. Security (VPS & Local Agent)
    *   [ ] **HTTPS:** Ensure VPS server uses HTTPS for all API endpoints and any served pages.
    *   [ ] **API Key Security:**
        *   Store GHL API Key and `API_SECRET_KEY` securely in `.env` on VPS (not in code).
        *   Local DT Agent's config file containing `CENTRAL_SERVER_API_KEY` should be protected.
    *   [ ] **Input Validation:** Rigorous server-side validation for all incoming data.
    *   [ ] **Rate Limiting:** Implement rate limiting on VPS API endpoints (using `rate-limiter-flexible`).
    *   [ ] **CORS:** Configure CORS on VPS to only allow requests from `ALLOWED_ORIGINS`.
    *   [ ] **Helmet:** Use Helmet for basic security headers on VPS.
    *   [ ] **Error Handling:** Graceful error handling; avoid exposing sensitive error details to clients.
    *   [ ] **Dependency Updates:** Regularly update Node.js packages.

### 9.2. Logging (VPS & Local Agent)
    *   [ ] **VPS:** Use Winston for structured logging to file (`LOG_FILE_PATH`) and console. Log key events, API calls, errors.
    *   [ ] **Local DT Agent:** Implement logging for its actions, DT interactions, errors. This can be to console or a local file.

### 9.3. Deployment (VPS)
    *   [ ] Develop deployment script/process (e.g., Git pull, npm install, PM2 restart).
    *   [ ] Configure PM2 to manage the Node.js process, enable auto-restart.
    *   [ ] Set up log rotation for VPS logs.

### 9.4. Local DT Agent Distribution
    *   [ ] Package the Local DT Agent (Node.js/Puppeteer script + config instructions) for dealer download/setup.
    *   [ ] Provide clear instructions for dealers on how to install/run it and configure their `CENTRAL_SERVER_API_BASE_URL` and `CENTRAL_SERVER_API_KEY`.

**Testing for Phase 7:**
    *   [ ] Perform security checks (e.g., try calling APIs without keys, from wrong origins).
    *   [ ] Review logs for clarity and completeness.
    *   [ ] Test error scenarios (e.g., GHL API down, DT unresponsive).
    *   [ ] Test deployment process.

---

## 10. Future Considerations (Out of Scope for Initial Build)

*   More sophisticated local agent (e.g., packaged as an executable, auto-updater).
*   Real-time updates to dashboard (WebSockets instead of polling for dashboard display).
*   Direct GHL File uploads from HTML form.
*   Admin interface on VPS for managing DT tasks or viewing logs.
*   Enhanced analytics and reporting from GHL data.

---

This plan provides a structured approach. Each phase builds upon the previous one. Remember to break down tasks within each step further and conduct regular testing. Good luck to the team!