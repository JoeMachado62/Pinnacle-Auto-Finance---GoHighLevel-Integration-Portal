# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm start` - Run in production mode
- `npm run dev` - Run in development mode with nodemon
- `npm test` or `npm run test:auth` - Run authentication tests
- `npm run setup` - Initialize the application and database files
- `npm run health` - Check server health status

### Logging and Monitoring
- `npm run logs` - View combined logs in real-time
- `npm run logs:error` - View error logs in real-time  
- `npm run logs:security` - View security logs in real-time

### Data Management
- `npm run migrate-data` - Migrate existing data
- `npm run cleanup` - Clean up temporary files and data

## Project Architecture

### High-Level Structure
This is a Node.js/Express dealer portal for Pinnacle Auto Finance with GoHighLevel (GHL) integration. The application serves as a bridge between dealers, GHL CRM, and DealerTrack for credit application processing.

### Key Architectural Components

#### 1. Authentication & Security System
- **JWT-based authentication** with 2FA support
- **Tier-based permissions**: basic, premium, admin subscription tiers
- **Comprehensive middleware stack**: rate limiting, CORS, Helmet security headers
- **Role-based access control** with granular permissions
- **Security logging** for all auth events and suspicious activity

#### 2. Data Layer (JSON-based, transitioning to SQL)
- **File-based database service** (`services/databaseService.js`) using JSON files in `/data/` directory
- **Core entities**: dealers, applications, conversations, 2FA codes
- **Backup system** with timestamped backups in `/backups/` directory
- **Migration path** planned for PostgreSQL/MySQL in production

#### 3. External Integrations
- **GoHighLevel API integration** (`services/ghlApiService.js`) for CRM operations
- **Email service** (`services/emailService.js`) supporting both SMTP and Gmail for 2FA
- **DealerTrack integration** (planned) via Puppeteer automation agent

#### 4. API Routes Structure
- `/api/auth/*` - Authentication endpoints (login, register, 2FA)
- `/api/applications/*` - Credit application CRUD operations
- `/api/dashboard/*` - Dealer dashboard data and statistics
- `/api/admin/*` - Administrative functions for admin tier users

#### 5. Frontend Integration
- **Static HTML pages** served from `/public/` directory
- **Client-side JavaScript** handles API communication and auth state
- **Responsive design** for dealer dashboard and credit application forms

### Configuration Management
- **Environment-based configuration** via `.env` files
- **Validation system** for critical configuration values
- **Support for multiple environments**: development, staging, production
- **Feature flags** for premium features and external integrations

### File Upload System
- **Profile pictures and documents** stored in `/uploads/` directory
- **File type validation** and size limits
- **Static file serving** with caching headers

### Logging Architecture
- **Winston-based logging** with multiple log levels and transports
- **Categorized logging**: business, security, debug, auth events
- **Daily log rotation** and retention policies
- **Structured logging** with metadata for debugging

## Development Guidelines

### Database Operations
- Use `db` service (`services/databaseService.js`) for all data operations
- **Never directly manipulate JSON files** - always use service methods
- **Backup considerations**: JSON files are backed up automatically before major operations

### Authentication Flow
- All protected routes require `authenticateToken` middleware from `middleware/auth.js`
- Premium features require `authenticatePremiumDealer` middleware
- Admin features require `authenticateAdmin` middleware
- Use `optionalAuth` for routes that work with or without authentication

### Error Handling
- Use structured error responses with consistent format
- **Security**: Never expose sensitive information in error messages
- **Logging**: Always log errors with context for debugging
- **Client communication**: Provide user-friendly error messages

### Security Practices
- **Rate limiting** is applied to auth endpoints and API routes
- **Input validation** is required for all endpoints
- **CORS configuration** restricts origins based on environment
- **JWT tokens** have expiration and refresh logic
- **2FA codes** have attempt limits and expiration

### GHL Integration
- Use `ghlApiService` for all GoHighLevel API operations
- **Pipeline management**: Applications flow through defined stages
- **Contact and Opportunity creation** follows standard GHL patterns
- **Webhook handling** planned for bidirectional sync

### Testing
- **Authentication tests** available via `npm run test:auth`
- **Health checks** available via `/api/health` endpoint
- **Manual testing** scripts in root directory for specific flows

## Important File Locations

### Configuration
- `config/index.js` - Main configuration with environment validation
- `config/ghlCustomFieldMap.json` - GHL custom field mappings

### Services
- `services/authService.js` - Authentication and user management
- `services/databaseService.js` - JSON-based data persistence
- `services/ghlApiService.js` - GoHighLevel API integration
- `services/emailService.js` - Email delivery for 2FA and notifications

### Data Storage
- `data/` - JSON database files (dealers.json, applications.json, etc.)
- `uploads/` - User-uploaded files and profile pictures
- `logs/` - Application logs with rotation

### Frontend
- `public/` - Static HTML pages and assets
- `public/dashboard.html` - Main dealer dashboard
- `public/credit_application.html` - Credit application form
- `public/login.html` - Authentication pages

## Environment Variables Setup

### Required Variables
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)

### Email Configuration (for 2FA)
- `FREE_2FA_EMAIL` - Gmail address for 2FA emails
- `FREE_2FA_PASSWORD` - Gmail app password
- `EMAIL_TEST_MODE` - Set to 'true' for development

### GoHighLevel Integration
- `GHL_API_KEY` - GHL private integration token
- `GHL_LOCATION_ID` - GHL location/sub-account ID
- `GHL_DEALS_PIPELINE_ID` - Pipeline ID for opportunities
- Stage IDs for different deal statuses

### Security Settings
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `TWO_FACTOR_ENABLED` - Enable/disable 2FA system
- `PREMIUM_FEATURES_ENABLED` - Enable premium tier features

## Testing and Debugging

### Health Monitoring
- Access `/api/health` for comprehensive system status
- Check logs in `/logs/` directory for troubleshooting
- Use `npm run logs` for real-time log monitoring

### Authentication Testing
- Use `npm run test:auth` for authentication flow testing
- Check `test-authentication.js` for manual testing scenarios
- 2FA codes are stored in `data/2fa_codes.json` during development

### Common Development Tasks
- **Adding new API endpoints**: Follow existing route pattern in `/routes/`
- **Database schema changes**: Update `databaseService.js` methods
- **New permissions**: Add to permission definitions in `middleware/auth.js`
- **GHL integration changes**: Modify `ghlApiService.js` with proper error handling

## Production Considerations

### Database Migration
- **Current**: JSON file-based storage for development
- **Planned**: PostgreSQL/MySQL with connection pooling
- **Migration tools**: Available in `/scripts/` directory

### Scalability
- **Session storage**: Migrate from memory to Redis for production
- **File uploads**: Consider cloud storage (S3) for production
- **Logging**: Implement log aggregation (ELK stack or similar)

### Security Hardening
- **HTTPS enforcement** in production
- **Environment variable validation** prevents misconfiguration
- **Rate limiting** and DDoS protection at infrastructure level
- **Regular security audits** of dependencies and code

This architecture supports the goal of creating a comprehensive dealer portal that integrates multiple external services while maintaining security, scalability, and maintainability.