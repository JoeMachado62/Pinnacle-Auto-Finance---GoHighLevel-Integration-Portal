// services/ghlUserService.js - GHL User Registration and Management Service
const { logger } = require('../utils/logger');
const db = require('./databaseService');
const ghlApi = require('./ghlApiService');
const emailService = require('./emailService');
const config = require('../config');

class GHLUserService {
    /**
     * Process premium user upgrade - handle both new and existing GHL users
     */
    async processPremiumUpgrade(dealer, existingGhlUserId = null) {
        try {
            logger.info(`Processing premium upgrade for dealer: ${dealer.email}`);
            
            // Check if already registered
            const existingRegistration = await db.getGhlRegistrationByDealerId(dealer.id);
            if (existingRegistration) {
                logger.info(`Dealer already has GHL registration: ${dealer.email}`);
                return existingRegistration;
            }
            
            let ghlContactId;
            let registrationStatus = 'pending_approval';
            
            // If this is an existing GHL user, skip contact creation and set as active
            if (existingGhlUserId) {
                logger.info(`Using existing GHL user ID: ${existingGhlUserId} for dealer: ${dealer.email}`);
                ghlContactId = null; // May not have a separate contact record
                registrationStatus = 'active'; // Existing users are automatically active
                
                // Update dealer record immediately with existing GHL user ID
                await db.updateDealerById(dealer.id, {
                    ghlUserId: existingGhlUserId,
                    ghlIntegrationEnabled: true,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // New user - create GHL contact
                const result = await ghlApi.autoRegisterPremiumUser({
                    id: dealer.id,
                    email: dealer.email,
                    dealer_first_name: dealer.contactName?.split(' ')[0] || 'Dealer',
                    dealer_last_name: dealer.contactName?.split(' ').slice(1).join(' ') || 'User',
                    phone: dealer.phone,
                    dealerName: dealer.dealerName,
                    dealer_address: dealer.address,
                    dealerLicenseNumber: dealer.dealerLicenseNumber,
                    subscriptionTier: dealer.subscriptionTier
                });
                
                ghlContactId = result.ghlContactId;
                
                // Update dealer record with GHL contact ID
                await db.updateDealerById(dealer.id, {
                    ghlContactId: result.ghlContactId,
                    ghlIntegrationEnabled: true,
                    updatedAt: new Date().toISOString()
                });
            }
            
            // Create registration record
            const registrationData = {
                email: dealer.email,
                firstName: dealer.contactName?.split(' ')[0] || 'Dealer',
                lastName: dealer.contactName?.split(' ').slice(1).join(' ') || 'User',
                phone: dealer.phone,
                dealerName: dealer.dealerName,
                ghlContactId: ghlContactId,
                additionalInfo: {
                    dealerLicenseNumber: dealer.dealerLicenseNumber,
                    address: dealer.address,
                    subscriptionTier: dealer.subscriptionTier,
                    existingGhlUser: !!existingGhlUserId,
                    ghlUserId: existingGhlUserId
                }
            };
            
            const registration = await db.createGhlRegistration(dealer.id, registrationData);
            
            // If existing user, mark as active immediately
            if (existingGhlUserId) {
                await db.updateGhlRegistrationStatus(dealer.id, 'active', {
                    ghlUserId: existingGhlUserId,
                    activatedAt: new Date().toISOString(),
                    approvedBy: 'system_existing_user'
                });
                
                logger.info(`Existing GHL user upgraded to premium automatically: ${dealer.email}`);
            } else {
                // Send admin notification for new users only
                await this.notifyAdminNewRegistration(registration);
            }
            
            logger.info(`Premium upgrade processed successfully: ${dealer.email}`);
            return await db.getGhlRegistrationByDealerId(dealer.id);
            
        } catch (error) {
            logger.error('Error processing premium upgrade:', error);
            throw new Error('Failed to process premium upgrade for GHL integration');
        }
    }
    
    /**
     * Approve GHL user registration and create user account
     */
    async approveGhlRegistration(dealerId, approvedBy = 'admin') {
        try {
            logger.info(`Approving GHL registration for dealer: ${dealerId}`);
            
            // Get registration and dealer data
            const registration = await db.getGhlRegistrationByDealerId(dealerId);
            if (!registration) {
                throw new Error('GHL registration not found');
            }
            
            if (registration.status !== 'pending_approval') {
                throw new Error(`Registration is not pending approval. Current status: ${registration.status}`);
            }
            
            const dealer = await db.getDealerById(dealerId);
            if (!dealer) {
                throw new Error('Dealer not found');
            }
            
            // Update registration status to approved
            await db.updateGhlRegistrationStatus(dealerId, 'approved', {
                approvedBy: approvedBy
            });
            
            // Create GHL user account
            const ghlUser = await ghlApi.createGhlUserAccount({
                firstName: registration.firstName,
                lastName: registration.lastName,
                email: registration.email,
                phone: registration.phone
            });
            
            // Update registration status to active with user ID
            await db.updateGhlRegistrationStatus(dealerId, 'active', {
                ghlUserId: ghlUser.id,
                tempPassword: ghlUser.tempPassword
            });
            
            // Update dealer record with GHL user ID
            await db.updateDealerById(dealerId, {
                ghlUserId: ghlUser.id,
                updatedAt: new Date().toISOString()
            });
            
            // Update GHL contact with user ID
            if (registration.ghlContactId) {
                await ghlApi.updateContactWithUserId(registration.ghlContactId, ghlUser.id);
            }
            
            // Send welcome email with credentials
            await this.sendWelcomeEmail(dealer, ghlUser);
            
            logger.info(`GHL user account created successfully for dealer: ${dealerId}`);
            return {
                registration: await db.getGhlRegistrationByDealerId(dealerId),
                ghlUserId: ghlUser.id
            };
            
        } catch (error) {
            logger.error('Error approving GHL registration:', error);
            throw error;
        }
    }
    
    /**
     * Generate access token for auto-login to GHL dashboard
     */
    async generateGhlAccessToken(dealerId) {
        try {
            const dealer = await db.getDealerById(dealerId);
            if (!dealer) {
                throw new Error('Dealer not found');
            }
            
            // Check if user is premium
            if (dealer.subscriptionTier !== 'premium') {
                throw new Error('Premium subscription required for GHL access');
            }
            
            const registration = await db.getGhlRegistrationByDealerId(dealerId);
            
            // For existing GHL users with same credentials, we can provide direct access
            // since they already have accounts with identical login credentials
            if (!registration || registration.status === 'not_registered') {
                // This is likely an existing GHL user - create a registration record
                logger.info(`Creating registration record for existing GHL user: ${dealer.email}`);
                
                const registrationData = {
                    email: dealer.email,
                    firstName: dealer.contactName?.split(' ')[0] || 'Dealer',
                    lastName: dealer.contactName?.split(' ').slice(1).join(' ') || 'User',
                    phone: dealer.phone,
                    dealerName: dealer.dealerName,
                    ghlContactId: null, // No separate contact needed
                    additionalInfo: {
                        dealerLicenseNumber: dealer.dealerLicenseNumber,
                        address: dealer.address,
                        subscriptionTier: dealer.subscriptionTier,
                        existingGhlUser: true,
                        sameCredentials: true,
                        autoActivated: true
                    }
                };
                
                await db.createGhlRegistration(dealer.id, registrationData);
                
                // Mark as active immediately for existing users with same credentials
                await db.updateGhlRegistrationStatus(dealer.id, 'active', {
                    ghlUserId: 'existing_user_' + dealer.id, // Placeholder ID
                    activatedAt: new Date().toISOString(),
                    approvedBy: 'system_existing_credentials'
                });
                
                logger.info(`Auto-activated GHL access for existing user: ${dealer.email}`);
            }
            
            const activeRegistration = await db.getGhlRegistrationByDealerId(dealerId);
            if (!activeRegistration || activeRegistration.status !== 'active') {
                throw new Error('GHL registration not active');
            }
            
            // Generate access info for existing GHL users
            return {
                ghlUserId: activeRegistration.ghlUserId,
                loginUrl: `${config.GHL_LOGIN_URL || 'https://app.gohighlevel.com'}`,
                accessToken: this.generateTemporaryToken(activeRegistration.ghlUserId || dealer.id),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
                existingUser: true,
                message: 'Existing GHL user - use your regular GHL login credentials'
            };
        } catch (error) {
            logger.error('Error generating GHL access token:', error);
            throw error;
        }
    }
    
    /**
     * Generate temporary token for auto-login (simplified version)
     */
    generateTemporaryToken(ghlUserId) {
        const jwt = require('jsonwebtoken');
        return jwt.sign(
            { 
                ghlUserId,
                purpose: 'ghl_auto_login',
                iat: Math.floor(Date.now() / 1000)
            },
            config.JWT_SECRET,
            { expiresIn: '15m' }
        );
    }
    
    /**
     * Send welcome email with GHL credentials
     */
    async sendWelcomeEmail(dealer, ghlUser) {
        try {
            const emailContent = `
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">Welcome to GoHighLevel!</h1>
                        <p style="color: #e0e7ff; margin: 10px 0 0 0;">Your premium account has been activated</p>
                    </div>
                    
                    <div style="padding: 30px 20px;">
                        <h2 style="color: #1e40af;">Hello ${dealer.contactName}!</h2>
                        
                        <p>Great news! Your premium account has been approved and your GoHighLevel access is now active.</p>
                        
                        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                            <h3 style="margin: 0 0 10px 0; color: #1e40af;">Your Login Credentials:</h3>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li><strong>Login URL:</strong> <a href="${config.GHL_LOGIN_URL || 'https://app.gohighlevel.com'}">${config.GHL_LOGIN_URL || 'https://app.gohighlevel.com'}</a></li>
                                <li><strong>Email:</strong> ${dealer.email}</li>
                                <li><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">${ghlUser.tempPassword}</code></li>
                            </ul>
                        </div>
                        
                        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; color: #dc2626;"><strong>Important:</strong> Please change your password upon first login for security.</p>
                        </div>
                        
                        <h3 style="color: #1e40af;">What You Can Do:</h3>
                        <ul>
                            <li>✅ View and manage your assigned contacts and leads</li>
                            <li>✅ Track opportunities and deals in your pipeline</li>
                            <li>✅ Schedule appointments with customers</li>
                            <li>✅ Communicate with customers through multiple channels</li>
                            <li>✅ View your performance dashboard and analytics</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${config.GHL_LOGIN_URL || 'https://app.gohighlevel.com'}" 
                               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                                Login to GoHighLevel
                            </a>
                        </div>
                        
                        <p>If you have any questions or need assistance, please contact our support team.</p>
                        
                        <p>Best regards,<br>
                        <strong>The Pinnacle Auto Finance Team</strong></p>
                    </div>
                    
                    <div style="background: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
                        <p>© 2025 Pinnacle Auto Finance. All rights reserved.</p>
                    </div>
                </body>
            </html>
            `;
            
            await emailService.sendEmail({
                to: dealer.email,
                subject: '🎉 Welcome! Your GoHighLevel Account is Ready',
                html: emailContent
            });
            
            logger.info(`Welcome email sent to ${dealer.email}`);
        } catch (error) {
            logger.error('Error sending welcome email:', error);
            // Don't throw - email failure shouldn't stop the registration process
        }
    }
    
    /**
     * Send admin notification for new registration
     */
    async notifyAdminNewRegistration(registration) {
        try {
            const adminEmails = ['admin@pinnacleautofinance.com', 'joemachado62@gmail.com'];
            
            const emailContent = `
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f59e0b; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">🔔 New GHL Registration</h1>
                        <p style="color: #fef3c7; margin: 10px 0 0 0;">Requires admin approval</p>
                    </div>
                    
                    <div style="padding: 20px;">
                        <h2>Registration Details:</h2>
                        <ul>
                            <li><strong>Dealer:</strong> ${registration.dealerName}</li>
                            <li><strong>Contact:</strong> ${registration.firstName} ${registration.lastName}</li>
                            <li><strong>Email:</strong> ${registration.email}</li>
                            <li><strong>Phone:</strong> ${registration.phone}</li>
                            <li><strong>Registration Date:</strong> ${new Date(registration.createdAt).toLocaleString()}</li>
                            <li><strong>Status:</strong> ${registration.status}</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p>Please review and approve this registration in the admin dashboard.</p>
                        </div>
                    </div>
                </body>
            </html>
            `;
            
            for (const adminEmail of adminEmails) {
                await emailService.sendEmail({
                    to: adminEmail,
                    subject: '🔔 New GHL Registration Pending Approval',
                    html: emailContent
                });
            }
            
            logger.info(`Admin notification sent for registration: ${registration.id}`);
        } catch (error) {
            logger.error('Error sending admin notification:', error);
            // Don't throw - notification failure shouldn't stop the registration process
        }
    }
    
    /**
     * Get registration status for a dealer
     */
    async getRegistrationStatus(dealerId) {
        try {
            const registration = await db.getGhlRegistrationByDealerId(dealerId);
            if (!registration) {
                return { status: 'not_registered' };
            }
            
            return {
                status: registration.status,
                registrationId: registration.id,
                createdAt: registration.createdAt,
                ghlUserId: registration.ghlUserId,
                ghlContactId: registration.ghlContactId
            };
        } catch (error) {
            logger.error('Error getting registration status:', error);
            throw error;
        }
    }
    
    /**
     * List all pending registrations (for admin)
     */
    async getPendingRegistrations() {
        try {
            return await db.getAllPendingGhlRegistrations();
        } catch (error) {
            logger.error('Error getting pending registrations:', error);
            throw error;
        }
    }
}

module.exports = new GHLUserService();