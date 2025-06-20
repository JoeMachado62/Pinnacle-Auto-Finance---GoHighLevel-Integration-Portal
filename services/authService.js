// /var/www/paf-ghl/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const ghlApiService = require('./ghlApiService');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

class AuthService {
    constructor() {
        this.ensureDataDirectory();
    }

    async ensureDataDirectory() {
        const dataDir = path.join(__dirname, '..', 'data');
        try {
            await fs.access(dataDir);
        } catch (error) {
            await fs.mkdir(dataDir, { recursive: true });
            logger.info('Created data directory');
        }
        
        // Initialize users file if it doesn't exist
        try {
            await fs.access(USERS_FILE);
        } catch (error) {
            await this.initializeUsersFile();
        }
    }

    async initializeUsersFile() {
        const initialData = {
            users: [],
            lastUpdated: new Date().toISOString()
        };
        await fs.writeFile(USERS_FILE, JSON.stringify(initialData, null, 2));
        logger.info('Initialized users.json file');
    }

    async loadUsers() {
        try {
            const data = await fs.readFile(USERS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error('Error loading users file:', error);
            await this.initializeUsersFile();
            return { users: [], lastUpdated: new Date().toISOString() };
        }
    }

    async saveUsers(userData) {
        try {
            userData.lastUpdated = new Date().toISOString();
            await fs.writeFile(USERS_FILE, JSON.stringify(userData, null, 2));
            logger.info('Users data saved successfully');
        } catch (error) {
            logger.error('Error saving users file:', error);
            throw new Error('Failed to save user data');
        }
    }

    async registerDealer(registrationData) {
        const {
            username,
            password,
            dealerName,
            dealerLicenseNumber,
            finNumber,
            contactName,
            email,
            phone,
            address
        } = registrationData;

        // Validate required fields
        if (!username || !password || !dealerName || !contactName || !email) {
            throw new Error('Missing required fields');
        }

        if (!dealerLicenseNumber && !finNumber) {
            throw new Error('Either Dealer License Number or FIN Number is required');
        }

        const userData = await this.loadUsers();

        // Check if username already exists
        const existingUser = userData.users.find(user => user.username === username);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Check if dealer license/FIN already exists
        const existingDealer = userData.users.find(user => 
            (dealerLicenseNumber && user.dealerLicenseNumber === dealerLicenseNumber) ||
            (finNumber && user.finNumber === finNumber)
        );
        if (existingDealer) {
            throw new Error('Dealer with this license/FIN number already exists');
        }

        try {
            // Create dealer contact in GHL first using the new dealer-specific function
            // Parse address to extract city, state, postalCode if possible
            let city = '', state = '', postalCode = '';
            if (address) {
                // Basic parsing attempt - address format: "Street, City, State ZIP"
                const addressParts = address.split(',').map(part => part.trim());
                if (addressParts.length >= 3) {
                    city = addressParts[addressParts.length - 2] || '';
                    const lastPart = addressParts[addressParts.length - 1] || '';
                    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
                    if (stateZipMatch) {
                        state = stateZipMatch[1];
                        postalCode = stateZipMatch[2];
                    }
                }
            }

            const ghlDealerContactData = {
                firstName: contactName.split(' ')[0] || contactName,
                lastName: contactName.split(' ').slice(1).join(' ') || '',
                email: email,
                phone: phone,
                dealer_address: address,
                city: city,
                state: state,
                postalCode: postalCode,
                website: '', // Could be added to registration form later
                timezone: 'America/New_York', // Default timezone
                tags: ['dealer_contact', 'portal_user'],
                source: 'Dealer Portal Registration',
                // Add custom fields for dealer info
                dealer_name: dealerName,
                dealer_license_number: dealerLicenseNumber,
                fin_number: finNumber
            };

            const ghlContactId = await ghlApiService.createGhlDealerContact(ghlDealerContactData);
            logger.info(`GHL dealer contact processed for dealer: ${ghlContactId}`);

            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Create user record
            const newUser = {
                userId: uuidv4(),
                username: username,
                passwordHash: passwordHash,
                dealerName: dealerName,
                dealerLicenseNumber: dealerLicenseNumber || null,
                finNumber: finNumber || null,
                ghlContactId: ghlContactId,
                contactName: contactName,
                email: email,
                phone: phone,
                address: address,
                status: 'active',
                createdAt: new Date().toISOString(),
                lastLogin: null
            };

            userData.users.push(newUser);
            await this.saveUsers(userData);

            logger.info(`Dealer registered successfully: ${username} (${dealerName})`);

            // Return user data without password hash
            const { passwordHash: _, ...userResponse } = newUser;
            return userResponse;

        } catch (error) {
            logger.error('Error during dealer registration:', error);
            throw new Error(`Registration failed: ${error.message}`);
        }
    }

    async authenticateDealer(username, password) {
        const userData = await this.loadUsers();
        const user = userData.users.find(u => u.username === username && u.status === 'active');

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        await this.saveUsers(userData);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.userId,
                username: user.username,
                dealerLicenseNumber: user.dealerLicenseNumber,
                finNumber: user.finNumber,
                ghlContactId: user.ghlContactId
            },
            config.JWT_SECRET,
            { expiresIn: '24h' }
        );

        logger.info(`Dealer logged in: ${username}`);

        // Return user data without password hash
        const { passwordHash: _, ...userResponse } = user;
        return { user: userResponse, token };
    }

    async getUserById(userId) {
        const userData = await this.loadUsers();
        const user = userData.users.find(u => u.userId === userId && u.status === 'active');
        
        if (!user) {
            return null;
        }

        const { passwordHash: _, ...userResponse } = user;
        return userResponse;
    }

    async getUserByDealerIdentifier(dealerLicenseNumber, finNumber) {
        const userData = await this.loadUsers();
        const user = userData.users.find(u => 
            u.status === 'active' && (
                (dealerLicenseNumber && u.dealerLicenseNumber === dealerLicenseNumber) ||
                (finNumber && u.finNumber === finNumber)
            )
        );
        
        if (!user) {
            return null;
        }

        const { passwordHash: _, ...userResponse } = user;
        return userResponse;
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, config.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}

module.exports = new AuthService();
