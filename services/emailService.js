// services/emailService.js - ADAPTED FROM LEAD ROUTER PRO
// Node.js implementation of Lead Router Pro's free_email_2fa.py
const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../utils/logger');

class EmailService {
    constructor() {
    this.transporter = null;
    this.fromName = "Pinnacle Auto Finance Security";
    this.fromEmail = null; // Will be set in initializeTransporter
    this.initializeTransporter();
}


async initializeTransporter() {
    try {
        // Support both SMTP_ and FREE_2FA_ variable naming
        const emailAddress = config.SMTP_USERNAME || config.FREE_2FA_EMAIL;
        const emailPassword = config.SMTP_PASSWORD || config.FREE_2FA_PASSWORD;
        const smtpHost = config.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = config.SMTP_PORT || 587;
        
        if (!emailAddress || !emailPassword) {
            if (config.EMAIL_TEST_MODE) {
                logger.info('Email service initialized in TEST MODE - no credentials required');
                return;
            } else {
                throw new Error('Email credentials not configured. Set SMTP_USERNAME/SMTP_PASSWORD or FREE_2FA_EMAIL/FREE_2FA_PASSWORD in .env');
            }
        }

        // Use Gmail configuration from .env
        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: false, // true for 465, false for other ports
            auth: {
                user: emailAddress,
                pass: emailPassword
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Set from name and email
        this.fromName = config.SMTP_FROM_NAME || "Pinnacle Auto Finance Security";
        this.fromEmail = config.SMTP_FROM_EMAIL || emailAddress;

        // Verify connection only if not in test mode
        if (!config.EMAIL_TEST_MODE) {
            await this.transporter.verify();
            logger.info(`Email service initialized successfully with ${smtpHost}`);
        } else {
            logger.info('Email service initialized in TEST MODE');
        }
    } catch (error) {
        logger.error('Email service initialization failed:', error);
        
        if (config.EMAIL_TEST_MODE) {
            logger.info('Continuing in TEST MODE despite email initialization failure');
        } else {
            throw error;
        }
      }
    }

    async send2FACode(email, code, userName = null) {
        try {
            // Test mode - simulate sending
            if (config.EMAIL_TEST_MODE) {
                logger.info(`TEST MODE: Would send 2FA code ${code} to ${email}`);
                console.log(`🔐 TEST 2FA CODE for ${email}: ${code}`);
                return true;
            }

            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            const subject = `Your Pinnacle Portal Security Code: ${code}`;
            const htmlContent = this.create2FAEmailHTML(code, userName);
            const textContent = this.create2FAEmailText(code, userName);

            const mailOptions = {
            from: `"${this.fromName}" <${this.fromEmail}>`,
            to: email,
            subject: subject,
            text: textContent,
            html: htmlContent
        };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`2FA email sent to ${email}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Error sending 2FA email:', error);
            return false;
        }
    }

    async sendApplicationNotification(email, dealerName, applicationData, updateMessage) {
        try {
            // Test mode - simulate sending
            if (config.EMAIL_TEST_MODE) {
                logger.info(`TEST MODE: Would send application notification to ${email}`);
                console.log(`📧 TEST NOTIFICATION for ${email}: ${updateMessage}`);
                return true;
            }

            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            const subject = `Application Update - ${applicationData.applicantName}`;
            const htmlContent = this.createApplicationNotificationHTML(dealerName, applicationData, updateMessage);
            
            const mailOptions = {
                from: `"Pinnacle Auto Finance" <${this.fromEmail}>`,
                to: email,
                subject: subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Application notification sent to ${email}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Error sending application notification:', error);
            return false;
        }
    }

    async sendWelcomeEmail(email, dealerName, subscriptionTier) {
        try {
            if (config.EMAIL_TEST_MODE) {
                logger.info(`TEST MODE: Would send welcome email to ${email}`);
                return true;
            }

            const subject = `Welcome to Pinnacle Auto Finance Portal`;
            const htmlContent = this.createWelcomeEmailHTML(dealerName, subscriptionTier);
            
            const mailOptions = {
                from: `"Pinnacle Auto Finance" <${this.fromEmail}>`,
                to: email,
                subject: subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Welcome email sent to ${email}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Error sending welcome email:', error);
            return false;
        }
    }

    create2FAEmailHTML(code, userName) {
        // Adapted from Lead Router Pro's 2FA email template
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pinnacle Auto Finance - Security Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                        Pinnacle Auto Finance
                    </h1>
                    <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 16px;">
                        Security Verification
                    </p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                        ${userName ? `Hello ${userName},` : 'Hello,'}
                    </h2>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        You're attempting to sign in to your Pinnacle Dealer Portal account.
                    </p>
                    
                    <!-- Code Box -->
                    <div style="background: #f8fafc; padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 25px; border: 2px solid #e2e8f0;">
                        <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0;">Your verification code is:</p>
                        <div style="font-size: 32px; font-weight: 700; color: #1e3a8a; letter-spacing: 4px; font-family: 'Courier New', monospace; margin: 15px 0;">
                            ${code}
                        </div>
                        <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
                            This code expires in 10 minutes. Never share this code with anyone.
                        </p>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 25px;">
                        <p style="color: #dc2626; font-size: 14px; margin: 0; font-weight: 500;">
                            <strong>🔒 Security Notice:</strong> If you didn't request this code, please ignore this email and consider changing your password.
                        </p>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        This verification code was requested from IP address and will expire in 10 minutes for your security.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        This is an automated security message from Pinnacle Auto Finance<br>
                        © 2025 Pinnacle Auto Finance. All rights reserved.
                    </p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0; text-align: center;">
                        Sent: ${new Date().toLocaleString()}
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    create2FAEmailText(code, userName) {
        return `
PINNACLE AUTO FINANCE - SECURITY VERIFICATION

${userName ? `Hello ${userName},` : 'Hello,'}

You're attempting to sign in to your Pinnacle Dealer Portal account.

Your verification code is: ${code}

This code expires in 10 minutes.

SECURITY NOTICE: If you didn't request this code, please ignore this email and consider changing your password. Never share this code with anyone.

---
This is an automated security message from Pinnacle Auto Finance
© 2025 Pinnacle Auto Finance. All rights reserved.
Sent: ${new Date().toLocaleString()}
        `;
    }

    createApplicationNotificationHTML(dealerName, applicationData, updateMessage) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pinnacle Auto Finance - Application Update</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                        Pinnacle Auto Finance
                    </h1>
                    <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 16px;">
                        Application Status Update
                    </p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                        Hello ${dealerName},
                    </h2>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        We have an update regarding the credit application for 
                        <strong style="color: #1f2937;">${applicationData.applicantName}</strong>:
                    </p>
                    
                    <!-- Status Update Box -->
                    <div style="background: #f8fafc; padding: 25px; border-radius: 12px; border-left: 5px solid #3b82f6; margin-bottom: 25px;">
                        <div style="font-size: 18px; font-weight: 600; color: #1e3a8a; margin-bottom: 10px;">
                            Status Update:
                        </div>
                        <div style="font-size: 16px; color: #374151; line-height: 1.5;">
                            ${updateMessage}
                        </div>
                    </div>
                    
                    <!-- Application Details -->
                    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Application Details:</h3>
                        <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li><strong>Vehicle:</strong> ${applicationData.vehicleInfo || 'N/A'}</li>
                            <li><strong>Amount Financed:</strong> $${applicationData.amountFinanced ? Number(applicationData.amountFinanced).toLocaleString() : 'N/A'}</li>
                            <li><strong>Application ID:</strong> ${applicationData.id}</li>
                            <li><strong>Submitted:</strong> ${new Date(applicationData.createdAt).toLocaleDateString()}</li>
                        </ul>
                    </div>
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="https://pinnacle-portal.com/dashboard" 
                           style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            View Full Details in Dashboard
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        If you have any questions about this application, please contact our support team or 
                        log into your dealer dashboard for complete details.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        This is an automated notification from Pinnacle Auto Finance<br>
                        © 2025 Pinnacle Auto Finance. All rights reserved.
                    </p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0; text-align: center;">
                        Sent: ${new Date().toLocaleString()}
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    createWelcomeEmailHTML(dealerName, subscriptionTier) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Pinnacle Auto Finance Portal</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                        Welcome to Pinnacle Auto Finance
                    </h1>
                    <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 16px;">
                        Your dealer portal is ready
                    </p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                        Hello ${dealerName},
                    </h2>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Welcome to the Pinnacle Auto Finance Dealer Portal! Your ${subscriptionTier} account has been successfully created.
                    </p>
                    
                    <!-- Features Box -->
                    <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 18px;">What you can do:</h3>
                        <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                            <li>Submit credit applications securely</li>
                            <li>Track application status in real-time</li>
                            <li>Manage deal jackets and conversations</li>
                            <li>Receive instant notifications</li>
                            ${subscriptionTier === 'premium' ? '<li><strong>Premium:</strong> Access GHL CRM and marketing tools</li>' : ''}
                        </ul>
                    </div>
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="https://pinnacle-portal.com/dashboard" 
                           style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Access Your Dashboard
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        If you have any questions, our support team is here to help. We're excited to work with you!
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        This is an automated message from Pinnacle Auto Finance<br>
                        © 2025 Pinnacle Auto Finance. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    async testConnection() {
        try {
            if (config.EMAIL_TEST_MODE) {
                logger.info('Email test connection - TEST MODE active');
                return true;
            }

            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            await this.transporter.verify();
            logger.info('Email connection test successful');
            return true;
        } catch (error) {
            logger.error('Email connection test failed:', error);
            return false;
        }
    }
}

module.exports = new EmailService();
