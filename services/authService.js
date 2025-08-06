// services/authService.js - COMPLETE REWRITE
// Adapted from Lead Router Pro's proven authentication patterns
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logger } = require('../utils/logger');
const db = require('./databaseService');

class AuthService {
    async createDealer(dealerData) {
        try {
            // Validate required fields
            const required = ['email', 'password', 'dealerName', 'contactName'];
            for (const field of required) {
                if (!dealerData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Check for existing dealer
            const existingDealer = await db.getDealerByEmail(dealerData.email.toLowerCase().trim());
            if (existingDealer) {
                throw new Error('Dealer with this email already exists');
            }

            // Hash password with high security
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(dealerData.password, saltRounds);

            // Create dealer record
            const newDealer = {
                id: uuidv4(),
                email: dealerData.email.toLowerCase().trim(),
                passwordHash: passwordHash,
                dealerName: dealerData.dealerName,
                contactName: dealerData.contactName,
                phone: dealerData.phone || null,
                address: dealerData.address || null,
                dealerLicenseNumber: dealerData.dealerLicenseNumber || null,
                finNumber: dealerData.finNumber || null,
                subscriptionTier: dealerData.subscriptionTier || 'basic',
                status: 'active',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                failedLoginAttempts: 0,
                accountLockedUntil: null,
                emailVerified: false,
                // GHL integration fields (for premium tier)
                ghlUserId: null,
                ghlContactId: null,
                ghlIntegrationEnabled: false
            };

            // Store in database
            const dealer = await db.createDealer(newDealer);
            
            // Remove password hash from response
            const { passwordHash: _, ...dealerResponse } = dealer;
            
            logger.info(`New dealer created: ${dealerData.email}`);
            return dealerResponse;

        } catch (error) {
            logger.error('Error creating dealer:', error);
            throw new Error(`Dealer creation failed: ${error.message}`);
        }
    }

    async authenticateDealer(email, password, skipPasswordCheck = false) {
        try {
            const dealer = await db.getDealerByEmail(email.toLowerCase().trim());
            if (!dealer) {
                // Add delay to prevent timing attacks
                await new Promise(resolve => setTimeout(resolve, 1000));
                throw new Error('Invalid credentials');
            }

            // Check if account is locked
            if (dealer.accountLockedUntil && new Date(dealer.accountLockedUntil) > new Date()) {
                const lockTimeRemaining = Math.ceil((new Date(dealer.accountLockedUntil) - new Date()) / (1000 * 60));
                throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes.`);
            }

            // Verify password (skip if this is completing 2FA)
            if (!skipPasswordCheck) {
                const isValidPassword = await bcrypt.compare(password, dealer.passwordHash);
                if (!isValidPassword) {
                    // Increment failed attempts
                    await this.handleFailedLogin(dealer.id);
                    throw new Error('Invalid credentials');
                }
            }

            // Reset failed attempts on successful login (non-critical operation)
            if (dealer.failedLoginAttempts > 0) {
                try {
                    await db.updateDealer(dealer.id, {
                        failedLoginAttempts: 0,
                        accountLockedUntil: null
                    });
                } catch (error) {
                    logger.warn('Failed to reset failed login attempts, but continuing authentication:', error);
                }
            }

            // Update last login (non-critical operation)
            try {
                await db.updateDealerLastLogin(dealer.id);
            } catch (error) {
                logger.warn('Failed to update last login time, but continuing authentication:', error);
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: dealer.id,
                    email: dealer.email,
                    dealerName: dealer.dealerName,
                    subscriptionTier: dealer.subscriptionTier,
                    iat: Math.floor(Date.now() / 1000)
                },
                config.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const { passwordHash: _, ...dealerResponse } = dealer;
            return { dealer: dealerResponse, token };

        } catch (error) {
            logger.error('Authentication error:', error);
            throw error;
        }
    }

    async handleFailedLogin(dealerId) {
        try {
            const dealer = await db.getDealerById(dealerId);
            if (!dealer) return;

            // Don't increment attempts if account is already locked and still within lockout period
            if (dealer.accountLockedUntil && new Date(dealer.accountLockedUntil) > new Date()) {
                logger.warn(`Blocked additional login attempt for already locked account: ${dealer.email}`);
                return; // Don't extend lockout time
            }

            const newFailedAttempts = (dealer.failedLoginAttempts || 0) + 1;
            const updates = { failedLoginAttempts: newFailedAttempts };

            // Lock account after 5 failed attempts for 30 minutes
            if (newFailedAttempts >= 5) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + 30);
                updates.accountLockedUntil = lockUntil.toISOString();
                
                logger.warn(`Account locked for dealer ${dealer.email} due to failed login attempts`);
            }

            await db.updateDealer(dealerId, updates);
        } catch (error) {
            logger.error('Error handling failed login:', error);
        }
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, config.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error('Token verification failed');
            }
        }
    }

    async getDealerById(id) {
        try {
            const dealer = await db.getDealerById(id);
            if (!dealer) {
                return null;
            }
            const { passwordHash: _, ...dealerResponse } = dealer;
            return dealerResponse;
        } catch (error) {
            logger.error('Error getting dealer by ID:', error);
            throw error;
        }
    }

    async updateDealerSubscription(dealerId, subscriptionTier, ghlUserData = null) {
        try {
            const updates = {
                subscriptionTier: subscriptionTier,
                upgradedAt: subscriptionTier === 'premium' ? new Date().toISOString() : null
            };

            // Add GHL integration data for premium tier
            if (subscriptionTier === 'premium' && ghlUserData) {
                updates.ghlUserId = ghlUserData.ghlUserId;
                updates.ghlContactId = ghlUserData.ghlContactId;
                updates.ghlIntegrationEnabled = true;
            }

            const updatedDealer = await db.updateDealer(dealerId, updates);
            
            logger.info(`Dealer ${dealerId} upgraded to ${subscriptionTier} tier`);
            return updatedDealer;
        } catch (error) {
            logger.error('Error updating dealer subscription:', error);
            throw error;
        }
    }

    async changePassword(dealerId, currentPassword, newPassword) {
        try {
            const dealer = await db.getDealerById(dealerId);
            if (!dealer) {
                throw new Error('Dealer not found');
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, dealer.passwordHash);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await db.updateDealer(dealerId, {
                passwordHash: newPasswordHash
            });

            logger.info(`Password changed for dealer: ${dealer.email}`);
            return true;
        } catch (error) {
            logger.error('Error changing password:', error);
            throw error;
        }
    }

    async resetPassword(dealerId, newPassword) {
        try {
            const dealer = await db.getDealerById(dealerId);
            if (!dealer) {
                throw new Error('Dealer not found');
            }

            // Hash new password
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password and reset failed attempts
            await db.updateDealer(dealerId, {
                passwordHash: newPasswordHash,
                failedLoginAttempts: 0,
                accountLockedUntil: null
            });

            logger.info(`Password reset for dealer: ${dealer.email}`);
            return true;
        } catch (error) {
            logger.error('Error resetting password:', error);
            throw error;
        }
    }

    // Generate 6-digit 2FA code
    generate2FACode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Validate 2FA code format
    isValid2FACode(code) {
        return /^\d{6}$/.test(code);
    }
}

module.exports = new AuthService();
