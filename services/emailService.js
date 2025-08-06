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

    async send2FACode(email, code, codeType = 'login', additionalData = null) {
        try {
            // Test mode - simulate sending
            if (config.EMAIL_TEST_MODE) {
                logger.info(`TEST MODE: Would send ${codeType} code ${code} to ${email}`);
                console.log(`🔐 TEST ${codeType.toUpperCase()} CODE for ${email}: ${code}`);
                return true;
            }

            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            let subject, htmlContent, textContent;
            
            if (codeType === 'password_reset') {
                subject = `Your Pinnacle Portal Password Reset Code: ${code}`;
                htmlContent = this.createPasswordResetEmailHTML(code, additionalData);
                textContent = this.createPasswordResetEmailText(code, additionalData);
            } else {
                subject = `Your Pinnacle Portal Security Code: ${code}`;
                htmlContent = this.create2FAEmailHTML(code, additionalData?.userName);
                textContent = this.create2FAEmailText(code, additionalData?.userName);
            }

            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: email,
                subject: subject,
                text: textContent,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`${codeType} email sent to ${email}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error(`Error sending ${codeType} email:`, error);
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
                        <a href="https://portal.pinnacleautofinance.com/dashboard.html" 
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
                        <a href="https://portal.pinnacleautofinance.com/dashboard.html" 
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

    createPasswordResetEmailHTML(code, additionalData) {
        const dealerName = additionalData?.dealerName || 'Dealer';
        const resetUrl = additionalData?.resetUrl || '';
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pinnacle Auto Finance - Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                        Password Reset Request
                    </h1>
                    <p style="color: #fca5a5; margin: 8px 0 0 0; font-size: 16px;">
                        Secure access to your dealer portal
                    </p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">
                        Hello ${dealerName},
                    </h2>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        We received a request to reset your password for the Pinnacle Auto Finance Dealer Portal.
                    </p>
                    
                    <!-- Security Code -->
                    <div style="background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px;">
                        <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                            Your Reset Code
                        </p>
                        <div style="background: white; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; display: inline-block; margin-bottom: 15px;">
                            <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #dc2626; letter-spacing: 8px;">
                                ${code}
                            </span>
                        </div>
                        <p style="color: #7c2d12; margin: 0; font-size: 14px; font-weight: 500;">
                            ⏰ This code expires in 30 minutes
                        </p>
                    </div>
                    
                    <!-- Instructions -->
                    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">
                            🔐 How to reset your password:
                        </h3>
                        <ol style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li>Click the button below or visit the reset page</li>
                            <li>Enter the 6-digit code: <strong>${code}</strong></li>
                            <li>Create your new secure password</li>
                            <li>Log in with your new password</li>
                        </ol>
                    </div>
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${resetUrl}" 
                           style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Reset My Password
                        </a>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <p style="color: #991b1b; margin: 0; font-size: 14px; line-height: 1.5;">
                            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
                            Your account remains secure and no changes have been made.
                        </p>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        If you continue to have issues accessing your account, please contact our support team.
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

    createPasswordResetEmailText(code, additionalData) {
        const dealerName = additionalData?.dealerName || 'Dealer';
        const resetUrl = additionalData?.resetUrl || '';
        
        return `
Pinnacle Auto Finance - Password Reset Request

Hello ${dealerName},

We received a request to reset your password for the Pinnacle Auto Finance Dealer Portal.

Your Reset Code: ${code}

This code expires in 30 minutes.

To reset your password:
1. Visit: ${resetUrl}
2. Enter the 6-digit code: ${code}
3. Create your new secure password
4. Log in with your new password

SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.

If you continue to have issues accessing your account, please contact our support team.

© 2025 Pinnacle Auto Finance. All rights reserved.
Sent: ${new Date().toLocaleString()}
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
    async sendStatusUpdateNotification(dealerEmail, dealerName, applicationData, statusChange) {
        if (!this.transporter || this.testMode) {
            logger.info(`TEST MODE: Would send status update notification to ${dealerEmail} for application ${applicationData.id}`);
            return true;
        }

        const subject = `Application Status Update - ${applicationData.applicantName}`;
        const htmlContent = this.createStatusUpdateEmailHTML(dealerName, applicationData, statusChange);
        
        const mailOptions = {
            from: `"Pinnacle Auto Finance" <${this.fromEmail}>`,
            to: dealerEmail,
            subject: subject,
            html: htmlContent
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Status update notification sent to ${dealerEmail} for application ${applicationData.id}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Failed to send status update notification:', error);
            return false;
        }
    }

    async sendAdminNoteNotification(dealerEmail, dealerName, applicationData, adminNote) {
        if (!this.transporter || this.testMode) {
            logger.info(`TEST MODE: Would send admin note notification to ${dealerEmail} for application ${applicationData.id}`);
            return true;
        }

        const subject = `New Message from Pinnacle Auto Finance - ${applicationData.applicantName}`;
        const htmlContent = this.createAdminNoteEmailHTML(dealerName, applicationData, adminNote);
        
        const mailOptions = {
            from: `"Pinnacle Auto Finance" <${this.fromEmail}>`,
            to: dealerEmail,
            subject: subject,
            html: htmlContent
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            logger.info(`Admin note notification sent to ${dealerEmail} for application ${applicationData.id}, messageId: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Failed to send admin note notification:', error);
            return false;
        }
    }

    createStatusUpdateEmailHTML(dealerName, applicationData, statusChange) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Application Status Update</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Pinnacle Auto Finance</h1>
                    <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Application Status Update</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="color: #1f2937; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">Hello ${dealerName},</p>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                        The status of your credit application has been updated by our team.
                    </p>
                    
                    <!-- Application Details -->
                    <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">📋 Application Details</h3>
                        <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li><strong>Applicant:</strong> ${applicationData.applicantName}</li>
                            <li><strong>Vehicle:</strong> ${applicationData.vehicleInfo}</li>
                            <li><strong>Amount:</strong> $${applicationData.amountFinanced.toLocaleString()}</li>
                            <li><strong>Application ID:</strong> ${applicationData.id}</li>
                        </ul>
                    </div>
                    
                    <!-- Status Update -->
                    <div style="background: #ffffff; border: 2px solid #059669; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">🔄 Status Update</h3>
                        <p style="margin: 5px 0;"><strong>Previous Status:</strong> <span style="color: #6b7280;">${statusChange.oldStatus}</span></p>
                        <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="color: #dc2626; font-weight: bold; font-size: 16px;">${statusChange.newStatus}</span></p>
                        ${statusChange.notes ? `
                        <div style="margin: 15px 0 0 0;">
                            <strong>Additional Notes:</strong>
                            <div style="margin: 8px 0; padding: 12px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #dc2626;">
                                ${statusChange.notes}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'https://yoursite.com'}/deal-jacket.html?id=${applicationData.id}" 
                           style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            🔍 View Deal Jacket
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        You can log into your dealer dashboard to view the complete application details, conversation history, and add any notes or questions.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        This is an automated notification from Pinnacle Auto Finance<br>
                        © ${new Date().getFullYear()} Pinnacle Auto Finance. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    createAdminNoteEmailHTML(dealerName, applicationData, adminNote) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Message from Pinnacle Auto Finance</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Pinnacle Auto Finance</h1>
                    <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">💬 New Message</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="color: #1f2937; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">Hello ${dealerName},</p>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                        You have received a new message regarding your credit application.
                    </p>
                    
                    <!-- Application Details -->
                    <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">📋 Application Details</h3>
                        <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li><strong>Applicant:</strong> ${applicationData.applicantName}</li>
                            <li><strong>Vehicle:</strong> ${applicationData.vehicleInfo}</li>
                            <li><strong>Application ID:</strong> ${applicationData.id}</li>
                        </ul>
                    </div>
                    
                    <!-- Message -->
                    <div style="background: #ffffff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                        <h3 style="color: #3b82f6; margin: 0 0 15px 0; font-size: 18px;">👨‍💼 Message from ${adminNote.createdByName}</h3>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #dc2626;">
                            <p style="margin: 0; color: #1f2937; line-height: 1.5;">${adminNote.content}</p>
                        </div>
                        <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">
                            📅 Sent: ${new Date(adminNote.timestamp).toLocaleString()}
                        </p>
                    </div>
                    
                    <!-- Call to Action -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'https://yoursite.com'}/deal-jacket.html?id=${applicationData.id}" 
                           style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            💬 View & Reply
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        Please log into your dealer dashboard to view the complete conversation history and add your response.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        This is an automated notification from Pinnacle Auto Finance<br>
                        © ${new Date().getFullYear()} Pinnacle Auto Finance. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = new EmailService();
