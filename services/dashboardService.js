// services/dashboardService.js - REFACTORED FOR NEW SYSTEM
const db = require('./databaseService');
const ghlApiService = require('./ghlApiService');
const { logger } = require('../utils/logger');
const config = require('../config');

class DashboardService {
    
    async getDealerDashboardData(dealer) {
        try {
            logger.info(`Fetching dashboard data for dealer: ${dealer.dealerName} (${dealer.subscriptionTier})`);
            
            // Get dealer's applications
            const applications = await db.getDealerApplications(dealer.id, 50);
            
            // Calculate statistics
            const statistics = this.calculateDealerStatistics(applications);
            
            // Get recent activity
            const recentActivity = await this.getRecentActivity(dealer.id, applications);
            
            // Base dashboard data
            const dashboardData = {
                dealer: {
                    id: dealer.id,
                    name: dealer.dealerName,
                    contactName: dealer.contactName,
                    email: dealer.email,
                    tier: dealer.subscriptionTier,
                    licenseNumber: dealer.dealerLicenseNumber,
                    finNumber: dealer.finNumber,
                    lastLogin: dealer.lastLogin,
                    memberSince: dealer.createdAt
                },
                applications: this.formatApplicationsForDashboard(applications),
                statistics: statistics,
                recentActivity: recentActivity,
                features: {
                    canSubmitApplications: true,
                    canViewAllApplications: true,
                    canManageProfile: true,
                    hasBasicReporting: true,
                    canAddNotes: true
                }
            };
            
            // Premium dealer enhancements
            if (dealer.subscriptionTier === 'premium') {
                dashboardData.features = {
                    ...dashboardData.features,
                    hasAdvancedReporting: true,
                    hasMarketingTools: true,
                    hasGHLIntegration: dealer.ghlIntegrationEnabled,
                    canTriggerWorkflows: dealer.ghlIntegrationEnabled,
                    hasCustomDashboard: true
                };
                
                // Add GHL integration data if enabled
                if (dealer.ghlIntegrationEnabled) {
                    try {
                        const ghlData = await this.getGHLDashboardData(dealer, applications);
                        dashboardData.ghlIntegration = ghlData;
                    } catch (ghlError) {
                        logger.warn(`GHL dashboard data fetch failed for dealer ${dealer.id}:`, ghlError);
                        dashboardData.ghlIntegration = {
                            status: 'error',
                            message: 'GHL integration temporarily unavailable'
                        };
                    }
                }
            }
            
            return dashboardData;
            
        } catch (error) {
            logger.error(`Error fetching dashboard data for dealer ${dealer.id}:`, error);
            throw new Error('Failed to fetch dashboard data');
        }
    }
    
    calculateDealerStatistics(applications) {
        const stats = {
            total: applications.length,
            pending: 0,
            processing: 0,
            approved: 0,
            declined: 0,
            funded: 0,
            totalAmount: 0,
            averageAmount: 0,
            thisMonth: 0,
            thisWeek: 0,
            approvalRate: 0
        };
        
        if (applications.length === 0) {
            return stats;
        }
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        
        let totalAmountSum = 0;
        let approvedCount = 0;
        let declinedCount = 0;
        
        applications.forEach(app => {
            const appDate = new Date(app.createdAt);
            const amount = parseFloat(app.amountFinanced) || 0;
            totalAmountSum += amount;
            
            // Status counts
            switch (app.status) {
                case 'submitted':
                    stats.pending++;
                    break;
                case 'processing':
                    stats.processing++;
                    break;
                case 'approved':
                    stats.approved++;
                    approvedCount++;
                    break;
                case 'declined':
                    stats.declined++;
                    declinedCount++;
                    break;
                case 'funded':
                    stats.funded++;
                    approvedCount++; // Funded counts as approved for rate calculation
                    break;
            }
            
            // Time-based counts
            if (appDate >= startOfMonth) {
                stats.thisMonth++;
            }
            if (appDate >= startOfWeek) {
                stats.thisWeek++;
            }
        });
        
        stats.totalAmount = totalAmountSum;
        stats.averageAmount = totalAmountSum / applications.length;
        
        // Calculate approval rate
        const decisionsCount = approvedCount + declinedCount;
        if (decisionsCount > 0) {
            stats.approvalRate = (approvedCount / decisionsCount) * 100;
        }
        
        return stats;
    }
    
    formatApplicationsForDashboard(applications) {
        return applications.slice(0, 10).map(app => ({
            id: app.id,
            applicantName: app.applicantName,
            vehicleInfo: app.vehicleInfo,
            amountFinanced: app.amountFinanced,
            status: app.status,
            dtStatus: app.dtStatus,
            dtReference: app.dtReferenceNumber,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            hasGHLIntegration: !!app.ghlMarketingContactId,
            statusDisplay: this.getStatusDisplay(app.status, app.dtStatus),
            urgency: this.calculateUrgency(app)
        }));
    }
    
    getStatusDisplay(status, dtStatus) {
        const statusMap = {
            'submitted': { label: 'Submitted', color: 'blue', priority: 1 },
            'processing': { label: 'Processing', color: 'yellow', priority: 2 },
            'approved': { label: 'Approved', color: 'green', priority: 3 },
            'declined': { label: 'Declined', color: 'red', priority: 3 },
            'funded': { label: 'Funded', color: 'green', priority: 4 }
        };
        
        const dtStatusMap = {
            'pending': { label: 'Pending DT', color: 'gray' },
            'submitted': { label: 'In DealerTrack', color: 'blue' },
            'processing': { label: 'DT Processing', color: 'yellow' },
            'approved': { label: 'DT Approved', color: 'green' },
            'declined': { label: 'DT Declined', color: 'red' },
            'funded': { label: 'Funded', color: 'green' }
        };
        
        return {
            primary: statusMap[status] || { label: status, color: 'gray', priority: 0 },
            secondary: dtStatusMap[dtStatus] || { label: dtStatus, color: 'gray' }
        };
    }
    
    calculateUrgency(application) {
        const now = new Date();
        const created = new Date(application.createdAt);
        const hoursSinceCreated = (now - created) / (1000 * 60 * 60);
        
        if (application.status === 'submitted' && hoursSinceCreated > 24) {
            return 'high';
        } else if (application.status === 'processing' && hoursSinceCreated > 48) {
            return 'high';
        } else if (hoursSinceCreated > 12) {
            return 'medium';
        }
        return 'low';
    }
    
    async getRecentActivity(dealerId, applications) {
        try {
            const activities = [];
            
            // Get recent conversations for all applications
            const recentApplications = applications.slice(0, 5);
            
            for (const app of recentApplications) {
                const conversations = await db.getConversationsByApplicationId(app.id);
                const recentConversations = conversations.slice(-3); // Last 3 conversations
                
                recentConversations.forEach(conv => {
                    activities.push({
                        type: 'conversation',
                        applicationId: app.id,
                        applicantName: app.applicantName,
                        content: conv.content,
                        createdBy: conv.createdByName,
                        timestamp: conv.timestamp,
                        noteType: conv.noteType,
                        importance: conv.importanceLevel
                    });
                });
            }
            
            // Add application submissions
            applications.slice(0, 5).forEach(app => {
                activities.push({
                    type: 'application_submitted',
                    applicationId: app.id,
                    applicantName: app.applicantName,
                    vehicleInfo: app.vehicleInfo,
                    amountFinanced: app.amountFinanced,
                    timestamp: app.createdAt
                });
            });
            
            // Sort by timestamp (most recent first) and limit
            return activities
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 20)
                .map(activity => ({
                    ...activity,
                    timeAgo: this.getTimeAgo(activity.timestamp)
                }));
                
        } catch (error) {
            logger.error(`Error getting recent activity for dealer ${dealerId}:`, error);
            return [];
        }
    }
    
    getTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    async getGHLDashboardData(dealer, applications) {
        try {
            if (!dealer.ghlIntegrationEnabled) {
                return { status: 'disabled' };
            }
            
            // Get GHL-integrated applications
            const ghlApps = applications.filter(app => app.ghlMarketingContactId);
            
            const ghlData = {
                status: 'connected',
                integratedApplications: ghlApps.length,
                totalContacts: ghlApps.length,
                recentContacts: [],
                workflows: {
                    triggered: 0,
                    active: 0
                },
                opportunities: {
                    total: ghlApps.filter(app => app.ghlOpportunityId).length,
                    open: ghlApps.filter(app => app.status === 'processing').length,
                    won: ghlApps.filter(app => app.status === 'funded').length,
                    lost: ghlApps.filter(app => app.status === 'declined').length
                }
            };
            
            // Get recent GHL contacts (up to 5)
            for (const app of ghlApps.slice(0, 5)) {
                if (app.ghlMarketingContactId) {
                    try {
                        const contact = await ghlApiService.getContactById(app.ghlMarketingContactId);
                        if (contact) {
                            ghlData.recentContacts.push({
                                id: contact.id,
                                name: `${contact.firstName} ${contact.lastName}`.trim(),
                                email: contact.email,
                                phone: contact.phone,
                                applicationId: app.id,
                                createdAt: contact.dateAdded || app.createdAt,
                                tags: contact.tags || []
                            });
                        }
                    } catch (contactError) {
                        logger.warn(`Failed to fetch GHL contact ${app.ghlMarketingContactId}:`, contactError);
                    }
                }
            }
            
            return ghlData;
            
        } catch (error) {
            logger.error(`Error fetching GHL dashboard data for dealer ${dealer.id}:`, error);
            return {
                status: 'error',
                message: 'Failed to fetch GHL data'
            };
        }
    }
    
    async getDealerPerformanceMetrics(dealer, timeframe = '30d') {
        try {
            const applications = await db.getDealerApplications(dealer.id, 500); // Get more for metrics
            
            const now = new Date();
            let startDate;
            
            switch (timeframe) {
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90d':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            
            const filteredApps = applications.filter(app => 
                new Date(app.createdAt) >= startDate
            );
            
            const metrics = {
                period: timeframe,
                startDate: startDate.toISOString(),
                endDate: now.toISOString(),
                ...this.calculateDealerStatistics(filteredApps),
                trends: this.calculateTrends(applications, startDate),
                topVehicles: this.getTopVehicles(filteredApps),
                averageProcessingTime: this.calculateAverageProcessingTime(filteredApps)
            };
            
            return metrics;
            
        } catch (error) {
            logger.error(`Error calculating performance metrics for dealer ${dealer.id}:`, error);
            throw new Error('Failed to calculate performance metrics');
        }
    }
    
    calculateTrends(applications, startDate) {
        const now = new Date();
        const midPoint = new Date((startDate.getTime() + now.getTime()) / 2);
        
        const firstHalf = applications.filter(app => {
            const appDate = new Date(app.createdAt);
            return appDate >= startDate && appDate < midPoint;
        });
        
        const secondHalf = applications.filter(app => {
            const appDate = new Date(app.createdAt);
            return appDate >= midPoint && appDate <= now;
        });
        
        const firstHalfStats = this.calculateDealerStatistics(firstHalf);
        const secondHalfStats = this.calculateDealerStatistics(secondHalf);
        
        return {
            applications: {
                change: secondHalfStats.total - firstHalfStats.total,
                percentChange: firstHalfStats.total > 0 ? 
                    ((secondHalfStats.total - firstHalfStats.total) / firstHalfStats.total) * 100 : 0
            },
            approvalRate: {
                change: secondHalfStats.approvalRate - firstHalfStats.approvalRate,
                current: secondHalfStats.approvalRate,
                previous: firstHalfStats.approvalRate
            },
            averageAmount: {
                change: secondHalfStats.averageAmount - firstHalfStats.averageAmount,
                percentChange: firstHalfStats.averageAmount > 0 ?
                    ((secondHalfStats.averageAmount - firstHalfStats.averageAmount) / firstHalfStats.averageAmount) * 100 : 0
            }
        };
    }
    
    getTopVehicles(applications) {
        const vehicleCounts = {};
        
        applications.forEach(app => {
            const vehicle = app.vehicleInfo || 'Unknown';
            vehicleCounts[vehicle] = (vehicleCounts[vehicle] || 0) + 1;
        });
        
        return Object.entries(vehicleCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([vehicle, count]) => ({ vehicle, count }));
    }
    
    calculateAverageProcessingTime(applications) {
        const processedApps = applications.filter(app => 
            app.status !== 'submitted' && app.updatedAt
        );
        
        if (processedApps.length === 0) return 0;
        
        const totalProcessingTime = processedApps.reduce((sum, app) => {
            const created = new Date(app.createdAt);
            const updated = new Date(app.updatedAt);
            return sum + (updated - created);
        }, 0);
        
        return Math.round(totalProcessingTime / (processedApps.length * 1000 * 60 * 60)); // Hours
    }
    
    async getSystemHealth() {
        try {
            const stats = await db.getDatabaseStats();
            const emailHealth = await require('./emailService').testConnection();
            
            return {
                status: 'healthy',
                services: {
                    database: 'healthy',
                    email: emailHealth ? 'healthy' : 'degraded',
                    ghl: config.GHL_API_KEY ? 'configured' : 'not_configured'
                },
                statistics: stats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting system health:', error);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new DashboardService();
