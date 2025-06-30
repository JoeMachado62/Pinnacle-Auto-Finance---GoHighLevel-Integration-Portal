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

    async getApplicationById(id) {
        const data = await this.readFile(this.applicationsFile);
        return data.applications.find(app => app.id === id);
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
}

module.exports = new DatabaseService();
