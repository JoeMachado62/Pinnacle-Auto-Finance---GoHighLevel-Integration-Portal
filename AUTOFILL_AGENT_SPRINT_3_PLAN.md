# Auto Fill Agent - Sprint 3: Client Portal & Automation Plan

**Status:** 🚀 APPROVED - Ready to Build
**Date:** October 23, 2025

---

## ✅ Approved Architecture

### The Complete Vision

**Client Experience:**
1. Client fills out ONE application (5 minutes)
2. System automatically submits to 10+ lenders
3. Client receives email confirmations
4. Tracks all responses in one portal
5. Can reply to lenders from portal

**Backend Magic:**
- BrowserBase + Stagehand (vision-based AI automation)
- Handles ANY lender form without pre-programming
- Adapts to UI changes automatically
- Runs in cloud (client doesn't need browser open)
- Parallel submissions (10 lenders in 3 minutes)

---

## 🏗️ Implementation Phases

### ✅ Phase 1: Client Portal Foundation (Current Sprint)
**Files to Create:**
1. `data/clients.json` - Client database
2. `data/lenders.json` - Lender database
3. `routes/clientRoutes.js` - Client API endpoints
4. `routes/lenderRoutes.js` - Lender management
5. `public/apply.html` - Client application form
6. `public/client-dashboard.html` - Client view
7. `services/clientService.js` - Client business logic

**Database Schemas:**
```javascript
// clients.json
{
  clients: [
    {
      id: string,
      email: string, // Gmail required
      passwordHash: string,
      firstName: string,
      lastName: string,
      phone: string,
      dealerId: string, // which dealer they applied through
      gmailAppPassword: string (encrypted),
      createdAt: timestamp,
      lastLogin: timestamp,
      status: 'active' | 'inactive'
    }
  ]
}

// lenders.json
{
  lenders: [
    {
      id: string,
      name: string,
      url: string,
      category: 'bank' | 'credit_union' | 'specialty',
      dealerId: string, // which dealer added it (null = global)
      active: boolean,
      successRate: number,
      avgResponseTimeDays: number,
      createdAt: timestamp
    }
  ]
}
```

**API Endpoints:**
```
POST /api/client/register - Client signup
POST /api/client/login - Client login
GET /api/client/applications - Client's applications
GET /api/client/submissions - Client's lender submissions
POST /api/client/submit-to-lenders - Trigger automation

POST /api/lenders - Dealer adds lender
GET /api/lenders - List lenders
PUT /api/lenders/:id - Update lender
```

---

### Phase 2: Python Automation Service (Next Sprint)
**Setup:**
1. Install Python 3.10+ on VPS
2. Install FastAPI + Stagehand + BrowserBase
3. Create Python service at `/var/www/paf-ghl/python-automation/`
4. Run on port 5000 (alongside Node.js on 3000)

**Python Service Structure:**
```
python-automation/
├── main.py (FastAPI server)
├── stagehand_service.py (Stagehand wrapper)
├── lender_automation.py (automation logic)
├── email_monitor.py (Gmail IMAP)
├── requirements.txt
└── config.py
```

**API Communication:**
```
Node.js Server (Port 3000)
    ↓
    Calls: http://localhost:5000/api/submit
    ↓
Python Service (Port 5000)
    ↓
    Uses: Stagehand + BrowserBase
    ↓
    Returns: { success, confirmationNumber, screenshots }
```

---

### Phase 3: Email Integration
**Gmail Setup:**
- Client provides Gmail during registration
- Portal guides through app password creation
- IMAP monitoring for lender responses
- SMTP for sending replies
- AI parses emails for approval/denial/requests

---

### Phase 4: Lender Management
**Dealer Tools:**
- Add custom lenders
- Configure default lender list
- View success rates per lender
- Auto-recommend best lenders

---

## 💰 Cost Analysis

### Per Application Costs:
- BrowserBase session: $0.10 per lender
- Claude API (if needed): $0.03 per plan
- Email monitoring: $0 (included)

**Example: Submit to 10 Lenders**
- Cost: $1.30 total
- Time saved: 3-4 hours
- Value: Better loan rates from more options

---

## 🔧 Technical Decisions (Approved)

1. ✅ **Add Python Service** - For Stagehand (vision-based automation)
2. ✅ **Client Email Required** - Gmail with app password
3. ✅ **BrowserBase Usage** - Cloud automation ($0.10/lender)
4. ✅ **Keep Chrome Extension** - As backup/testing tool
5. ✅ **Dealer + Client Lender Management** - Both can add lenders

---

## 📋 Next Steps (In Order)

### Sprint 3A: Database & API (Current)
1. ✅ Add clients.json and lenders.json files
2. ✅ Update databaseService.js with client/lender methods
3. Create clientRoutes.js
4. Create lenderRoutes.js
5. Test API endpoints

### Sprint 3B: Client UI
6. Create client application form
7. Create client dashboard
8. Create client inbox (email view)
9. Test end-to-end client flow

### Sprint 3C: Dealer Enhancements
10. Add lender management to dealer dashboard
11. Add "Submit to Lenders" button
12. Create submission monitoring view

---

## 🚀 Progress Tracker

**Sprint 3A - Backend (COMPLETED):**
- [x] Architecture approved
- [x] Database schema designed
- [x] clients.json file path added
- [x] lenders.json file path added
- [x] Client CRUD methods in databaseService (10 methods)
- [x] Lender CRUD methods in databaseService (10 methods)
- [x] Client API routes (8 endpoints)
- [x] Lender API routes (7 endpoints)
- [x] Routes registered in server.js
- [x] bcrypt dependency installed

**Sprint 3B - Frontend (NEXT):**
- [ ] Client application form UI
- [ ] Client dashboard UI
- [ ] Dealer lender management UI

---

## 📊 Success Metrics

**Technical:**
- 90%+ automated submission success rate
- <3 minutes per lender submission
- Zero data entry errors

**Business:**
- Clients submit to 5+ lenders (vs 1-2 manually)
- 80% reduction in dealer time
- Faster deal closing times

---

## 🔗 Related Documents

- [Sprint 0 Summary](AUTOFILL_AGENT_SPRINT_0_SUMMARY.md) - Initial setup
- [Sprint 1 Summary](AUTOFILL_AGENT_SPRINT_1_SUMMARY.md) - Backend testing
- [Sprint 2 Summary](AUTOFILL_AGENT_SPRINT_2_SUMMARY.md) - Chrome extension
- [Chrome Extension Installation](chrome-extension/INSTALLATION.md)

---

**Current Status:** Sprint 3A Complete - Backend API Ready
**Next Task:** Sprint 3B - Build client application form UI
**Completion Date:** October 23, 2025

## 📝 Sprint 3A Summary

### Completed Work:

**1. Database Service Extensions** ([services/databaseService.js](services/databaseService.js)):
- Added 10 client management methods:
  - `createClient()`, `getClientByEmail()`, `getClientById()`, `getClientsByDealer()`
  - `updateClient()`, `deleteClient()`, `updateClientLastLogin()`
- Added 10 lender management methods:
  - `createLender()`, `getLenderById()`, `getLendersByDealer()`, `getActiveLenders()`
  - `updateLender()`, `deleteLender()`, `updateLenderStats()`, `getLenderStats()`

**2. Client API Routes** ([routes/clientRoutes.js](routes/clientRoutes.js)):
- `POST /api/client/register` - Client registration (Gmail required)
- `POST /api/client/login` - Client authentication with JWT
- `GET /api/client/profile` - Get client profile
- `PATCH /api/client/profile` - Update client info & Gmail app password
- `GET /api/client/applications` - Get client's credit applications
- `GET /api/client/submissions` - Get lender submission status
- `POST /api/client/submit-to-lenders` - Trigger automation (placeholder)

**3. Lender API Routes** ([routes/lenderRoutes.js](routes/lenderRoutes.js)):
- `GET /api/lenders` - List all lenders (with filters)
- `GET /api/lenders/:id` - Get specific lender details
- `POST /api/lenders` - Create new lender (dealer or admin)
- `PUT /api/lenders/:id` - Update lender info
- `DELETE /api/lenders/:id` - Remove lender
- `GET /api/lenders/stats/overview` - Lender performance stats
- `PATCH /api/lenders/:id/stats` - Update lender stats after submission

**4. Security Features**:
- JWT token authentication for all endpoints
- Role-based access (client, dealer, admin)
- Email validation (Gmail only for client accounts)
- Password hashing with bcrypt
- Dealer-specific lender management
- Global lenders (admin-only)

**5. Dependencies**:
- Installed `bcrypt` package for password hashing

### API Architecture:

**Client Flow:**
1. Client registers via dealer's portal (`/api/client/register`)
2. Client fills out ONE credit application
3. Client selects lenders from available list
4. System submits to multiple lenders automatically
5. Client tracks all submissions in dashboard
6. Client receives email notifications from lenders

**Lender Management:**
- Admins can create global lenders (available to all dealers)
- Dealers can add custom lenders (specific to their business)
- Lender stats track success rates and response times
- Auto-recommendations based on performance

### Next Steps (Sprint 3B):
1. Build `/apply/{dealerId}` - Client application form
2. Build client dashboard with submission tracking
3. Add lender management UI to dealer dashboard
4. Create "Submit to Lenders" button workflow
