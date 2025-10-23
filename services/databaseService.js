// services/databaseService.js - NEW FILE
// Simple JSON-based database service for development/testing
// TODO: Replace with PostgreSQL/MySQL in production
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data');
        this.dealersFile = path.join(this.dataPath, 'dealers.json');
        this.applicationsFile = path.join(this.dataPath, 'applications.json');
        this.conversationsFile = path.join(this.dataPath, 'conversations.json');
        this.twoFactorCodesFile = path.join(this.dataPath, '2fa_codes.json');
        this.ghlRegistrationsFile = path.join(this.dataPath, 'ghl_registrations.json');
        this.submissionsFile = path.join(this.dataPath, 'submissions.json');
        this.clientsFile = path.join(this.dataPath, 'clients.json');
        this.lendersFile = path.join(this.dataPath, 'lenders.json');

        this.initializeFiles();
    }

    async initializeFiles() {
        try {
            // Create data directory if it doesn't exist
            await fs.mkdir(this.dataPath, { recursive: true });
            
            // Initialize files if they don't exist
            await this.ensureFileExists(this.dealersFile, { dealers: [] });
            await this.ensureFileExists(this.applicationsFile, { applications: [] });
            await this.ensureFileExists(this.conversationsFile, { conversations: [] });
            await this.ensureFileExists(this.twoFactorCodesFile, { codes: [] });
            await this.ensureFileExists(this.ghlRegistrationsFile, { registrations: [] });
            await this.ensureFileExists(this.submissionsFile, { submissions: [] });
            await this.ensureFileExists(this.clientsFile, { clients: [] });
            await this.ensureFileExists(this.lendersFile, { lenders: [] });
            
            logger.info('Database files initialized successfully');
        } catch (error) {
            logger.error('Error initializing database files:', error);
            throw new Error('Database initialization failed');
        }
    }

    async ensureFileExists(filePath, defaultData) {
        try {
            await fs.access(filePath);
        } catch (error) {
            // File doesn't exist, create it
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
            logger.info(`Created database file: ${path.basename(filePath)}`);
        }
    }

    async readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read database file: ${path.basename(filePath)}`);
        }
    }

    async writeFile(filePath, data) {
        try {
            // Add metadata
            if (typeof data === 'object' && data !== null) {
                data.lastUpdated = new Date().toISOString();
            }
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error(`Error writing file ${filePath}:`, error);
            throw new Error(`Failed to write database file: ${path.basename(filePath)}`);
        }
    }

    // ===== DEALER METHODS =====
    
    async createDealer(dealerData) {
        const data = await this.readFile(this.dealersFile);
        data.dealers.push(dealerData);
        await this.writeFile(this.dealersFile, data);
        
        logger.info(`Dealer created: ${dealerData.email}`);
        return dealerData;
    }

    async getDealerByEmail(email) {
        const data = await this.readFile(this.dealersFile);
        return data.dealers.find(dealer => 
            dealer.email === email && dealer.status === 'active'
        );
    }

    async getDealerById(id) {
        const data = await this.readFile(this.dealersFile);
        return data.dealers.find(dealer => dealer.id === id);
    }

    async updateDealerLastLogin(id) {
        const data = await this.readFile(this.dealersFile);
        const dealer = data.dealers.find(d => d.id === id);
        if (dealer) {
            dealer.lastLogin = new Date().toISOString();
            await this.writeFile(this.dealersFile, data);
        }
    }

    async updateDealer(id, updates) {
        const data = await this.readFile(this.dealersFile);
        const dealerIndex = data.dealers.findIndex(d => d.id === id);
        if (dealerIndex !== -1) {
            data.dealers[dealerIndex] = { 
                ...data.dealers[dealerIndex], 
                ...updates,
                updatedAt: new Date().toISOString()
            };
            await this.writeFile(this.dealersFile, data);
            return data.dealers[dealerIndex];
        }
        return null;
    }

    async getAllDealers() {
        const data = await this.readFile(this.dealersFile);
        return data.dealers.filter(dealer => dealer.status === 'active');
    }

    // ===== APPLICATION METHODS =====
    
    async createApplication(applicationData) {
        const data = await this.readFile(this.applicationsFile);
        applicationData.id = require('uuid').v4();
        applicationData.createdAt = new Date().toISOString();
        applicationData.status = applicationData.status || 'submitted';
        applicationData.dtStatus = applicationData.dtStatus || 'pending';
        
        data.applications.push(applicationData);
        await this.writeFile(this.applicationsFile, data);
        
        logger.info(`Application created: ${applicationData.id} for dealer: ${applicationData.dealerId}`);
        return applicationData;
    }

    async getDealerApplications(dealerId, limit = 50, status = null) {
        const data = await this.readFile(this.applicationsFile);
        let applications = data.applications.filter(app => app.dealerId === dealerId);
        
        if (status) {
            applications = applications.filter(app => app.status === status);
        }
        
        // Sort by creation date (newest first)
        applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return applications.slice(0, limit);
    }

    async getAllApplications(limit = 100, status = null, dealerId = null, sortBy = 'createdAt', sortOrder = 'desc') {
        const data = await this.readFile(this.applicationsFile);
        let applications = [...data.applications];
        
        // Filter by status if provided
        if (status) {
            applications = applications.filter(app => app.status === status);
        }
        
        // Filter by dealer if provided
        if (dealerId) {
            applications = applications.filter(app => app.dealerId === dealerId);
        }
        
        // Sort applications
        applications.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            // Handle date sorting
            if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
            } else {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
        });
        
        return applications.slice(0, limit);
    }

    async getApplicationById(id) {
        const data = await this.readFile(this.applicationsFile);
        return data.applications.find(app => app.id === id);
    }

    async getApplicationsWithDealerInfo(limit = 100, filters = {}) {
        const applications = await this.getAllApplications(limit, filters.status, filters.dealerId, filters.sortBy, filters.sortOrder);
        const dealersData = await this.readFile(this.dealersFile);
        
        // Enrich applications with dealer information
        return applications.map(app => {
            const dealer = dealersData.dealers.find(d => d.id === app.dealerId);
            return {
                ...app,
                dealerInfo: dealer ? {
                    dealerName: dealer.dealerName,
                    contactName: dealer.contactName,
                    email: dealer.email,
                    phone: dealer.phone,
                    subscriptionTier: dealer.subscriptionTier
                } : null
            };
        });
    }

    async updateApplication(id, updates) {
        const data = await this.readFile(this.applicationsFile);
        const appIndex = data.applications.findIndex(app => app.id === id);
        if (appIndex !== -1) {
            data.applications[appIndex] = { 
                ...data.applications[appIndex], 
                ...updates,
                updatedAt: new Date().toISOString()
            };
            await this.writeFile(this.applicationsFile, data);
            return data.applications[appIndex];
        }
        return null;
    }

    async getApplicationsByDTStatus(dtStatus) {
        const data = await this.readFile(this.applicationsFile);
        return data.applications.filter(app => app.dtStatus === dtStatus);
    }

    // ===== CONVERSATION METHODS =====
    
    async createConversationLog(conversationData) {
        const data = await this.readFile(this.conversationsFile);
        conversationData.id = require('uuid').v4();
        conversationData.timestamp = new Date().toISOString();
        
        data.conversations.push(conversationData);
        await this.writeFile(this.conversationsFile, data);
        
        logger.info(`Conversation log created for application: ${conversationData.applicationId}`);
        return conversationData;
    }

    async getConversationsByApplicationId(applicationId) {
        const data = await this.readFile(this.conversationsFile);
        const conversations = data.conversations.filter(conv => conv.applicationId === applicationId);
        
        // Sort by timestamp (oldest first for conversation flow)
        conversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return conversations;
    }

    async addConversationNote(applicationId, noteData) {
        const conversation = {
            applicationId: applicationId,
            noteType: noteData.noteType || 'dealer_note',
            content: noteData.content,
            createdBy: noteData.createdBy || 'system',
            createdByName: noteData.createdByName || 'System',
            createdByType: noteData.createdByType || 'user',
            attachments: noteData.attachments || [],
            isInternal: noteData.isInternal || false,
            importanceLevel: noteData.importanceLevel || 'normal',
            notificationSent: false,
            ghlSynced: false
        };

        return await this.createConversationLog(conversation);
    }

    // ===== 2FA METHODS =====
    
    async store2FACode(dealerId, code, email, codeType = 'login', expiresInMinutes = 10) {
        const data = await this.readFile(this.twoFactorCodesFile);
        
        // Clean up expired codes
        const now = new Date();
        data.codes = data.codes.filter(c => new Date(c.expiresAt) > now);
        
        const codeData = {
            id: require('uuid').v4(),
            dealerId: dealerId,
            code: code,
            codeType: codeType,
            email: email,
            attempts: 0,
            maxAttempts: 3,
            used: false,
            expiresAt: new Date(now.getTime() + (expiresInMinutes * 60 * 1000)).toISOString(),
            createdAt: now.toISOString()
        };
        
        data.codes.push(codeData);
        await this.writeFile(this.twoFactorCodesFile, data);
        
        return codeData;
    }

    async get2FACode(dealerId, code) {
        const data = await this.readFile(this.twoFactorCodesFile);
        return data.codes.find(c => 
            c.dealerId === dealerId && 
            c.code === code && 
            !c.used && 
            new Date(c.expiresAt) > new Date()
        );
    }

    async use2FACode(dealerId, code) {
        const data = await this.readFile(this.twoFactorCodesFile);
        const codeIndex = data.codes.findIndex(c => 
            c.dealerId === dealerId && 
            c.code === code && 
            !c.used
        );
        
        if (codeIndex !== -1) {
            data.codes[codeIndex].used = true;
            data.codes[codeIndex].usedAt = new Date().toISOString();
            await this.writeFile(this.twoFactorCodesFile, data);
            return data.codes[codeIndex];
        }
        return null;
    }

    async increment2FAAttempts(dealerId, code) {
        const data = await this.readFile(this.twoFactorCodesFile);
        const codeIndex = data.codes.findIndex(c => 
            c.dealerId === dealerId && 
            c.code === code
        );
        
        if (codeIndex !== -1) {
            data.codes[codeIndex].attempts += 1;
            await this.writeFile(this.twoFactorCodesFile, data);
            return data.codes[codeIndex];
        }
        return null;
    }

    // ===== UTILITY METHODS =====
    
    async getDatabaseStats() {
        try {
            const dealersData = await this.readFile(this.dealersFile);
            const applicationsData = await this.readFile(this.applicationsFile);
            const conversationsData = await this.readFile(this.conversationsFile);
            
            return {
                dealers: {
                    total: dealersData.dealers.length,
                    active: dealersData.dealers.filter(d => d.status === 'active').length,
                    basic: dealersData.dealers.filter(d => d.subscriptionTier === 'basic').length,
                    premium: dealersData.dealers.filter(d => d.subscriptionTier === 'premium').length
                },
                applications: {
                    total: applicationsData.applications.length,
                    pending: applicationsData.applications.filter(a => a.status === 'submitted').length,
                    processing: applicationsData.applications.filter(a => a.dtStatus === 'processing').length
                },
                conversations: {
                    total: conversationsData.conversations.length
                },
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting database stats:', error);
            throw error;
        }
    }

    // GHL Registration Management
    async createGhlRegistration(dealerId, registrationData) {
        try {
            const data = await this.readFile(this.ghlRegistrationsFile);
            
            const registration = {
                id: this.generateId(),
                dealerId,
                email: registrationData.email,
                firstName: registrationData.firstName,
                lastName: registrationData.lastName,
                phone: registrationData.phone,
                dealerName: registrationData.dealerName,
                ghlContactId: registrationData.ghlContactId || null,
                ghlUserId: null,
                status: 'pending_approval', // pending_approval, approved, active, rejected
                createdAt: new Date().toISOString(),
                approvedAt: null,
                activatedAt: null,
                approvedBy: null,
                tempPassword: null,
                additionalInfo: registrationData.additionalInfo || {}
            };
            
            data.registrations.push(registration);
            data.lastUpdated = new Date().toISOString();
            
            await this.writeFile(this.ghlRegistrationsFile, data);
            logger.info(`GHL registration created for dealer: ${dealerId}`);
            
            return registration;
        } catch (error) {
            logger.error('Error creating GHL registration:', error);
            throw error;
        }
    }

    async getGhlRegistrationByDealerId(dealerId) {
        try {
            const data = await this.readFile(this.ghlRegistrationsFile);
            return data.registrations.find(reg => reg.dealerId === dealerId);
        } catch (error) {
            logger.error('Error getting GHL registration:', error);
            throw error;
        }
    }

    async updateGhlRegistrationStatus(dealerId, status, updateData = {}) {
        try {
            const data = await this.readFile(this.ghlRegistrationsFile);
            const registrationIndex = data.registrations.findIndex(reg => reg.dealerId === dealerId);
            
            if (registrationIndex === -1) {
                throw new Error('GHL registration not found');
            }
            
            const registration = data.registrations[registrationIndex];
            registration.status = status;
            registration.updatedAt = new Date().toISOString();
            
            // Add status-specific fields
            if (status === 'approved') {
                registration.approvedAt = new Date().toISOString();
                registration.approvedBy = updateData.approvedBy;
            }
            
            if (status === 'active') {
                registration.activatedAt = new Date().toISOString();
                registration.ghlUserId = updateData.ghlUserId;
                registration.tempPassword = updateData.tempPassword;
            }
            
            // Add any other update data
            Object.assign(registration, updateData);
            
            data.lastUpdated = new Date().toISOString();
            await this.writeFile(this.ghlRegistrationsFile, data);
            
            logger.info(`GHL registration status updated to ${status} for dealer: ${dealerId}`);
            return registration;
        } catch (error) {
            logger.error('Error updating GHL registration status:', error);
            throw error;
        }
    }

    async getAllPendingGhlRegistrations() {
        try {
            const data = await this.readFile(this.ghlRegistrationsFile);
            return data.registrations.filter(reg => reg.status === 'pending_approval');
        } catch (error) {
            logger.error('Error getting pending GHL registrations:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            // Clean up expired 2FA codes
            const data = await this.readFile(this.twoFactorCodesFile);
            const now = new Date();
            const before = data.codes.length;
            
            data.codes = data.codes.filter(c => new Date(c.expiresAt) > now);
            
            if (data.codes.length !== before) {
                await this.writeFile(this.twoFactorCodesFile, data);
                logger.info(`Cleaned up ${before - data.codes.length} expired 2FA codes`);
            }
            
            return true;
        } catch (error) {
            logger.error('Error during database cleanup:', error);
            return false;
        }
    }

    // ===== SUBMISSION TRACKING METHODS =====

    async createSubmission(submissionData) {
        const data = await this.readFile(this.submissionsFile);
        const submission = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            dealerId: submissionData.dealerId,
            applicationId: submissionData.applicationId,
            lenderUrl: submissionData.lenderUrl,
            lenderName: submissionData.lenderName || null,
            status: submissionData.status || 'pending', // pending, submitted, approved, declined, error
            errorMessage: submissionData.errorMessage || null,
            automationPlan: submissionData.automationPlan || null,
            sessionId: submissionData.sessionId || null,
            userInterventions: submissionData.userInterventions || 0,
            submittedAt: submissionData.submittedAt || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.submissions.push(submission);
        await this.writeFile(this.submissionsFile, data);

        logger.info(`Submission created: ${submission.id} for application ${submissionData.applicationId}`);
        return submission;
    }

    async getSubmissionById(id) {
        const data = await this.readFile(this.submissionsFile);
        return data.submissions.find(s => s.id === id);
    }

    async getSubmissionsByDealer(dealerId, options = {}) {
        const data = await this.readFile(this.submissionsFile);
        let submissions = data.submissions.filter(s => s.dealerId === dealerId);

        // Filter by status if provided
        if (options.status) {
            submissions = submissions.filter(s => s.status === options.status);
        }

        // Filter by application if provided
        if (options.applicationId) {
            submissions = submissions.filter(s => s.applicationId === options.applicationId);
        }

        // Sort by most recent first
        submissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;

        return {
            submissions: submissions.slice(offset, offset + limit),
            total: submissions.length,
            hasMore: submissions.length > offset + limit
        };
    }

    async updateSubmissionStatus(id, status, additionalData = {}) {
        const data = await this.readFile(this.submissionsFile);
        const submission = data.submissions.find(s => s.id === id);

        if (!submission) {
            throw new Error('Submission not found');
        }

        submission.status = status;
        submission.updatedAt = new Date().toISOString();

        // Update additional fields if provided
        if (additionalData.errorMessage) {
            submission.errorMessage = additionalData.errorMessage;
        }
        if (additionalData.submittedAt) {
            submission.submittedAt = additionalData.submittedAt;
        }
        if (additionalData.userInterventions !== undefined) {
            submission.userInterventions = additionalData.userInterventions;
        }

        await this.writeFile(this.submissionsFile, data);

        logger.info(`Submission ${id} status updated to: ${status}`);
        return submission;
    }

    async incrementUserInterventions(id) {
        const data = await this.readFile(this.submissionsFile);
        const submission = data.submissions.find(s => s.id === id);

        if (!submission) {
            throw new Error('Submission not found');
        }

        submission.userInterventions = (submission.userInterventions || 0) + 1;
        submission.updatedAt = new Date().toISOString();

        await this.writeFile(this.submissionsFile, data);

        return submission;
    }

    async deleteSubmission(id) {
        const data = await this.readFile(this.submissionsFile);
        const initialLength = data.submissions.length;

        data.submissions = data.submissions.filter(s => s.id !== id);

        if (data.submissions.length === initialLength) {
            throw new Error('Submission not found');
        }

        await this.writeFile(this.submissionsFile, data);

        logger.info(`Submission deleted: ${id}`);
        return true;
    }

    async getSubmissionStats(dealerId) {
        const data = await this.readFile(this.submissionsFile);
        const submissions = data.submissions.filter(s => s.dealerId === dealerId);

        const stats = {
            total: submissions.length,
            pending: submissions.filter(s => s.status === 'pending').length,
            submitted: submissions.filter(s => s.status === 'submitted').length,
            approved: submissions.filter(s => s.status === 'approved').length,
            declined: submissions.filter(s => s.status === 'declined').length,
            error: submissions.filter(s => s.status === 'error').length,
            averageInterventions: submissions.length > 0
                ? submissions.reduce((sum, s) => sum + (s.userInterventions || 0), 0) / submissions.length
                : 0,
            recentSubmissions: submissions
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10)
        };

        return stats;
    }

    // ===== CLIENT METHODS =====

    async createClient(clientData) {
        const data = await this.readFile(this.clientsFile);

        // Check for existing client with same email
        const existingClient = data.clients.find(c => c.email === clientData.email);
        if (existingClient) {
            throw new Error('Client with this email already exists');
        }

        const client = {
            id: this.generateId(),
            email: clientData.email,
            passwordHash: clientData.passwordHash,
            firstName: clientData.firstName,
            lastName: clientData.lastName,
            phone: clientData.phone,
            dealerId: clientData.dealerId,
            gmailAppPassword: clientData.gmailAppPassword || null, // Encrypted
            createdAt: new Date().toISOString(),
            lastLogin: null,
            status: 'active'
        };

        data.clients.push(client);
        await this.writeFile(this.clientsFile, data);
        logger.info('Client created', { clientId: client.id, email: client.email });

        return client;
    }

    async getClientByEmail(email) {
        const data = await this.readFile(this.clientsFile);
        return data.clients.find(c => c.email === email);
    }

    async getClientById(id) {
        const data = await this.readFile(this.clientsFile);
        return data.clients.find(c => c.id === id);
    }

    async getClientsByDealer(dealerId) {
        const data = await this.readFile(this.clientsFile);
        return data.clients.filter(c => c.dealerId === dealerId);
    }

    async updateClient(id, updates) {
        const data = await this.readFile(this.clientsFile);
        const clientIndex = data.clients.findIndex(c => c.id === id);

        if (clientIndex === -1) {
            throw new Error('Client not found');
        }

        // Don't allow email changes if it conflicts with another client
        if (updates.email && updates.email !== data.clients[clientIndex].email) {
            const emailExists = data.clients.some(c => c.email === updates.email && c.id !== id);
            if (emailExists) {
                throw new Error('Email already in use by another client');
            }
        }

        data.clients[clientIndex] = {
            ...data.clients[clientIndex],
            ...updates,
            id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(this.clientsFile, data);
        logger.info('Client updated', { clientId: id });

        return data.clients[clientIndex];
    }

    async deleteClient(id) {
        const data = await this.readFile(this.clientsFile);
        const initialLength = data.clients.length;
        data.clients = data.clients.filter(c => c.id !== id);

        if (data.clients.length === initialLength) {
            throw new Error('Client not found');
        }

        await this.writeFile(this.clientsFile, data);
        logger.info('Client deleted', { clientId: id });

        return true;
    }

    async updateClientLastLogin(id) {
        const data = await this.readFile(this.clientsFile);
        const clientIndex = data.clients.findIndex(c => c.id === id);

        if (clientIndex === -1) {
            throw new Error('Client not found');
        }

        data.clients[clientIndex].lastLogin = new Date().toISOString();
        await this.writeFile(this.clientsFile, data);

        return data.clients[clientIndex];
    }

    // ===== LENDER METHODS =====

    async createLender(lenderData) {
        const data = await this.readFile(this.lendersFile);

        const lender = {
            id: this.generateId(),
            name: lenderData.name,
            url: lenderData.url,
            category: lenderData.category || 'bank', // 'bank' | 'credit_union' | 'specialty'
            dealerId: lenderData.dealerId || null, // null = global lender
            active: lenderData.active !== false, // Default true
            successRate: 0,
            avgResponseTimeDays: 0,
            totalSubmissions: 0,
            approvalCount: 0,
            declineCount: 0,
            createdAt: new Date().toISOString()
        };

        data.lenders.push(lender);
        await this.writeFile(this.lendersFile, data);
        logger.info('Lender created', { lenderId: lender.id, name: lender.name });

        return lender;
    }

    async getLenderById(id) {
        const data = await this.readFile(this.lendersFile);
        return data.lenders.find(l => l.id === id);
    }

    async getLendersByDealer(dealerId) {
        const data = await this.readFile(this.lendersFile);
        // Return both global lenders (dealerId === null) and dealer-specific lenders
        return data.lenders.filter(l => l.dealerId === null || l.dealerId === dealerId);
    }

    async getAllLenders() {
        const data = await this.readFile(this.lendersFile);
        return data.lenders;
    }

    async getActiveLenders(dealerId = null) {
        const data = await this.readFile(this.lendersFile);
        let lenders = data.lenders.filter(l => l.active === true);

        if (dealerId) {
            lenders = lenders.filter(l => l.dealerId === null || l.dealerId === dealerId);
        }

        return lenders;
    }

    async updateLender(id, updates) {
        const data = await this.readFile(this.lendersFile);
        const lenderIndex = data.lenders.findIndex(l => l.id === id);

        if (lenderIndex === -1) {
            throw new Error('Lender not found');
        }

        data.lenders[lenderIndex] = {
            ...data.lenders[lenderIndex],
            ...updates,
            id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(this.lendersFile, data);
        logger.info('Lender updated', { lenderId: id });

        return data.lenders[lenderIndex];
    }

    async deleteLender(id) {
        const data = await this.readFile(this.lendersFile);
        const initialLength = data.lenders.length;
        data.lenders = data.lenders.filter(l => l.id !== id);

        if (data.lenders.length === initialLength) {
            throw new Error('Lender not found');
        }

        await this.writeFile(this.lendersFile, data);
        logger.info('Lender deleted', { lenderId: id });

        return true;
    }

    async updateLenderStats(id, submissionOutcome) {
        const data = await this.readFile(this.lendersFile);
        const lenderIndex = data.lenders.findIndex(l => l.id === id);

        if (lenderIndex === -1) {
            throw new Error('Lender not found');
        }

        const lender = data.lenders[lenderIndex];

        // Increment totals
        lender.totalSubmissions = (lender.totalSubmissions || 0) + 1;

        if (submissionOutcome === 'approved') {
            lender.approvalCount = (lender.approvalCount || 0) + 1;
        } else if (submissionOutcome === 'declined') {
            lender.declineCount = (lender.declineCount || 0) + 1;
        }

        // Calculate success rate (approvals / total non-pending submissions)
        const decisiveSubmissions = lender.approvalCount + lender.declineCount;
        if (decisiveSubmissions > 0) {
            lender.successRate = (lender.approvalCount / decisiveSubmissions) * 100;
        }

        await this.writeFile(this.lendersFile, data);
        logger.info('Lender stats updated', { lenderId: id, outcome: submissionOutcome });

        return data.lenders[lenderIndex];
    }

    async getLenderStats(dealerId = null) {
        const data = await this.readFile(this.lendersFile);
        let lenders = data.lenders;

        if (dealerId) {
            lenders = lenders.filter(l => l.dealerId === null || l.dealerId === dealerId);
        }

        // Sort by success rate descending
        lenders.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));

        const stats = {
            totalLenders: lenders.length,
            activeLenders: lenders.filter(l => l.active).length,
            topPerformers: lenders.slice(0, 5),
            averageSuccessRate: lenders.length > 0
                ? lenders.reduce((sum, l) => sum + (l.successRate || 0), 0) / lenders.length
                : 0
        };

        return stats;
    }
}

module.exports = new DatabaseService();
