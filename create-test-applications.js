#!/usr/bin/env node

const db = require('./services/databaseService');
const { logger } = require('./utils/logger');

// Test Applications Data - 5 comprehensive applications
const testApplications = [
    {
        // Application 1: Individual borrower with complete data including alimony, trade-in
        dealerEmail: 'joemachado62@live.com',
        applicantData: {
            // Dealer Information
            dealer_name: 'MJM Motors',
            dealer_telephone: '(555) 123-4567',
            dealer_contact: 'Joe Machado',

            // Borrower 1 - Complete Information
            borrower1_firstName: 'Sarah',
            borrower1_lastName: 'Johnson',
            borrower1_dob: '1985-03-15',
            borrower1_ssn: '123-45-6789',
            borrower1_drivers_license: 'CA-D123456789',
            borrower1_home_phone: '(555) 234-5678',
            borrower1_work_phone: '(555) 345-6789',
            borrower1_cellPhone: '(555) 456-7890',
            borrower1_email: 'sarah.johnson@email.com',

            // Address Information
            borrower1_address_type: 'own',
            borrower1_current_address: '123 Oak Street, Los Angeles, CA 90210',
            borrower1_landlord_info: '',
            borrower1_current_address_years: '5',
            borrower1_current_address_months: '6',
            borrower1_previous_address_1: '456 Elm Ave, San Diego, CA 92101',
            borrower1_prev_address_1_landlord_info: 'Mike Smith - (555) 111-2222',
            borrower1_prev_address_1_years: '3',
            borrower1_prev_address_1_months: '2',
            borrower1_previous_address_2: '789 Pine Rd, San Francisco, CA 94102',
            borrower1_prev_address_2_landlord_info: 'ABC Properties - (555) 333-4444',
            borrower1_prev_address_2_years: '2',
            borrower1_prev_address_2_months: '8',

            // Employment Information
            borrower1_current_employer: 'TechCorp Inc.',
            borrower1_employer_phone: '(555) 567-8901',
            borrower1_title: 'Software Engineer',
            borrower1_employer_address: '789 Business Blvd, Los Angeles, CA 90213',
            borrower1_income: '95000',
            borrower1_employment_years: '4',
            borrower1_employment_months: '8',
            borrower1_other_income: '12000',
            borrower1_income_source: 'Rental Property Income',

            // Previous Employment
            borrower1_previous_employer_1: 'StartupXYZ',
            borrower1_prev_employer_1_phone: '(555) 678-9012',
            borrower1_prev_employer_1_title: 'Junior Developer',
            borrower1_prev_employer_1_address: '456 Innovation Way, San Diego, CA 92103',
            borrower1_prev_employer_1_income: '65000',
            borrower1_prev_employment_1_years: '2',
            borrower1_prev_employment_1_months: '4',
            borrower1_previous_employer_2: 'Local Coffee Shop',
            borrower1_prev_employer_2_phone: '(555) 789-0123',
            borrower1_prev_employer_2_title: 'Barista',
            borrower1_prev_employer_2_address: '123 Main St, San Francisco, CA 94104',
            borrower1_prev_employer_2_income: '28000',
            borrower1_prev_employment_2_years: '1',
            borrower1_prev_employment_2_months: '6',

            // Financial Information
            borrower1_alimony_payments: 'yes',
            borrower1_alimony_recipient: 'Michael Johnson, 321 Park Ave, LA, CA 90211',
            borrower1_alimony_amount: '1500',
            borrower1_co_maker: 'no',
            borrower1_co_maker_for: '',
            borrower1_co_maker_to_whom: '',
            borrower1_judgments: 'no',
            borrower1_judgment_to_whom: '',
            borrower1_judgment_amount: '',
            borrower1_bankruptcy: 'no',
            borrower1_bankruptcy_where: '',
            borrower1_bankruptcy_year: '',

            // Vehicle Information
            vehicle_year: '2022',
            vehicle_make_model: 'Honda Accord',
            vehicle_trim: 'EX-L',
            vehicle_mileage: '25000',
            vehicle_vin: '1HGCV1F30MA123456',
            vehicle_condition: 'excellent',
            vehicle_color: 'Pearl White',
            vehicle_transmission: 'automatic',
            vehicle_fuel_type: 'gasoline',

            // Transaction Details with Trade-in
            sellingPrice: '28500',
            cashDown: '3500',
            trade_value: '8500',
            trade_payoff: '6200',
            net_trade_value: '2300',
            totalDown: '5800', // cashDown + netTradeValue
            amountFinanced: '22700', // sellingPrice - totalDown
            taxes: '2280',
            titleFees: '450',
            warrantyFees: '1200',
            gapInsurance: '695',
            term: '60',
            apr: '7.25'
        }
    },

    {
        // Application 2: Joint borrowers with minimal data
        dealerEmail: 'joemachado62@live.com',
        applicantData: {
            dealer_name: 'MJM Motors',
            dealer_telephone: '(555) 123-4567',
            dealer_contact: 'Joe Machado',

            // Borrower 1
            borrower1_firstName: 'James',
            borrower1_lastName: 'Martinez',
            borrower1_dob: '1990-07-22',
            borrower1_ssn: '234-56-7890',
            borrower1_drivers_license: 'CA-D234567890',
            borrower1_cellPhone: '(555) 567-8901',
            borrower1_email: 'james.martinez@email.com',
            borrower1_address_type: 'rent',
            borrower1_current_address: '456 Sunset Blvd, Los Angeles, CA 90028',
            borrower1_landlord_info: 'Sunset Properties - (555) 999-8888',
            borrower1_current_address_years: '2',
            borrower1_current_address_months: '3',
            borrower1_current_employer: 'LA Construction Co.',
            borrower1_employer_phone: '(555) 678-9012',
            borrower1_title: 'Foreman',
            borrower1_employer_address: '789 Industrial Ave, LA, CA 90021',
            borrower1_income: '72000',
            borrower1_employment_years: '3',
            borrower1_employment_months: '0',
            borrower1_alimony_payments: 'no',
            borrower1_co_maker: 'no',
            borrower1_judgments: 'no',
            borrower1_bankruptcy: 'no',

            // Borrower 2 (Co-borrower)
            borrower2_firstName: 'Maria',
            borrower2_lastName: 'Martinez',
            borrower2_dob: '1992-11-08',
            borrower2_ssn: '345-67-8901',
            borrower2_drivers_license: 'CA-D345678901',
            borrower2_cellPhone: '(555) 678-9012',
            borrower2_email: 'maria.martinez@email.com',
            borrower2_address_type: 'rent',
            borrower2_current_address: '456 Sunset Blvd, Los Angeles, CA 90028',
            borrower2_landlord_info: 'Sunset Properties - (555) 999-8888',
            borrower2_current_address_years: '2',
            borrower2_current_address_months: '3',
            borrower2_current_employer: 'LA Medical Center',
            borrower2_employer_phone: '(555) 789-0123',
            borrower2_title: 'Nurse',
            borrower2_employer_address: '123 Medical Plaza, LA, CA 90027',
            borrower2_income: '68000',
            borrower2_employment_years: '4',
            borrower2_employment_months: '6',
            borrower2_alimony_payments: 'no',
            borrower2_co_maker: 'no',
            borrower2_judgments: 'no',
            borrower2_bankruptcy: 'no',

            // Vehicle Information
            vehicle_year: '2021',
            vehicle_make_model: 'Toyota Camry',
            vehicle_trim: 'LE',
            vehicle_mileage: '32000',
            vehicle_vin: '4T1C11AK8MU123456',
            vehicle_condition: 'good',

            // Transaction Details (No Trade)
            sellingPrice: '24500',
            cashDown: '4500',
            trade_value: '0',
            trade_payoff: '0',
            net_trade_value: '0',
            totalDown: '4500',
            amountFinanced: '20000',
            taxes: '1960',
            titleFees: '350',
            term: '72',
            apr: '6.75'
        }
    },

    {
        // Application 3: Individual with complex financial history (bankruptcy, judgments)
        dealerEmail: 'joemachado62@live.com',
        applicantData: {
            dealer_name: 'MJM Motors',
            dealer_telephone: '(555) 123-4567',
            dealer_contact: 'Joe Machado',

            // Borrower 1 - Complex Financial History
            borrower1_firstName: 'Robert',
            borrower1_lastName: 'Williams',
            borrower1_dob: '1978-12-03',
            borrower1_ssn: '456-78-9012',
            borrower1_drivers_license: 'CA-D456789012',
            borrower1_home_phone: '(555) 789-0123',
            borrower1_work_phone: '(555) 890-1234',
            borrower1_cellPhone: '(555) 901-2345',
            borrower1_email: 'robert.williams@email.com',

            // Address
            borrower1_address_type: 'other',
            borrower1_current_address: '321 Recovery Lane, Los Angeles, CA 90015',
            borrower1_landlord_info: 'Living with parents - John Williams (555) 111-0000',
            borrower1_current_address_years: '1',
            borrower1_current_address_months: '8',
            borrower1_previous_address_1: '654 Old Street, LA, CA 90016',
            borrower1_prev_address_1_landlord_info: 'Foreclosed Property',
            borrower1_prev_address_1_years: '4',
            borrower1_prev_address_1_months: '0',

            // Employment
            borrower1_current_employer: 'Second Chance Construction',
            borrower1_employer_phone: '(555) 012-3456',
            borrower1_title: 'Equipment Operator',
            borrower1_employer_address: '987 New Hope Blvd, LA, CA 90017',
            borrower1_income: '55000',
            borrower1_employment_years: '1',
            borrower1_employment_months: '10',
            borrower1_other_income: '8400',
            borrower1_income_source: 'Child Support Received',

            // Previous Employment
            borrower1_previous_employer_1: 'Self-Employed Contractor',
            borrower1_prev_employer_1_title: 'Business Owner',
            borrower1_prev_employer_1_income: '45000',
            borrower1_prev_employment_1_years: '5',
            borrower1_prev_employment_1_months: '0',

            // Complex Financial History
            borrower1_alimony_payments: 'yes',
            borrower1_alimony_recipient: 'Jennifer Williams, 789 Maple St, LA, CA 90018',
            borrower1_alimony_amount: '800',
            borrower1_co_maker: 'yes',
            borrower1_co_maker_for: 'Previous auto loan',
            borrower1_co_maker_to_whom: 'Ex-wife Jennifer Williams - Bank of America',
            borrower1_judgments: 'yes',
            borrower1_judgment_to_whom: 'LA County Court - Unpaid contractor dispute',
            borrower1_judgment_amount: '12000',
            borrower1_bankruptcy: 'yes',
            borrower1_bankruptcy_where: 'LA County Superior Court',
            borrower1_bankruptcy_year: '2019',

            // Vehicle
            vehicle_year: '2019',
            vehicle_make_model: 'Ford F-150',
            vehicle_trim: 'XLT',
            vehicle_mileage: '68000',
            vehicle_vin: '1FTEW1EP5KFA12345',
            vehicle_condition: 'fair',

            // Transaction
            sellingPrice: '32000',
            cashDown: '2000',
            trade_value: '0',
            trade_payoff: '0',
            net_trade_value: '0',
            totalDown: '2000',
            amountFinanced: '30000',
            taxes: '2560',
            titleFees: '450',
            term: '72',
            apr: '12.95'
        }
    },

    {
        // Application 4: Joint borrowers with ALL fields filled - comprehensive test
        dealerEmail: 'joemachado62@live.com',
        applicantData: {
            dealer_name: 'MJM Motors',
            dealer_telephone: '(555) 123-4567',
            dealer_contact: 'Joe Machado',

            // Borrower 1 - COMPLETE DATA
            borrower1_firstName: 'David',
            borrower1_lastName: 'Thompson',
            borrower1_dob: '1983-09-17',
            borrower1_ssn: '567-89-0123',
            borrower1_drivers_license: 'CA-D567890123',
            borrower1_home_phone: '(555) 123-9876',
            borrower1_work_phone: '(555) 234-8765',
            borrower1_cellPhone: '(555) 345-7654',
            borrower1_email: 'david.thompson@email.com',

            // Complete Address History
            borrower1_address_type: 'own',
            borrower1_current_address: '555 Executive Drive, Beverly Hills, CA 90210',
            borrower1_landlord_info: '',
            borrower1_current_address_years: '7',
            borrower1_current_address_months: '3',
            borrower1_previous_address_1: '333 Corporate Ave, Century City, CA 90067',
            borrower1_prev_address_1_landlord_info: 'Century Properties LLC - (555) 777-8888',
            borrower1_prev_address_1_years: '4',
            borrower1_prev_address_1_months: '9',
            borrower1_previous_address_2: '111 Startup Blvd, Santa Monica, CA 90401',
            borrower1_prev_address_2_landlord_info: 'Beach Rentals Inc - (555) 666-5555',
            borrower1_prev_address_2_years: '3',
            borrower1_prev_address_2_months: '1',

            // Complete Employment History
            borrower1_current_employer: 'Global Tech Solutions',
            borrower1_employer_phone: '(555) 456-6543',
            borrower1_title: 'Senior Director of Engineering',
            borrower1_employer_address: '777 Innovation Way, Los Angeles, CA 90024',
            borrower1_income: '155000',
            borrower1_employment_years: '6',
            borrower1_employment_months: '2',
            borrower1_other_income: '25000',
            borrower1_income_source: 'Stock options and consulting fees',

            borrower1_previous_employer_1: 'Tech Innovators Corp',
            borrower1_prev_employer_1_phone: '(555) 654-3210',
            borrower1_prev_employer_1_title: 'Engineering Manager',
            borrower1_prev_employer_1_address: '444 Silicon Ave, LA, CA 90025',
            borrower1_prev_employer_1_income: '125000',
            borrower1_prev_employment_1_years: '4',
            borrower1_prev_employment_1_months: '6',
            borrower1_previous_employer_2: 'Digital Dreams LLC',
            borrower1_prev_employer_2_phone: '(555) 321-0987',
            borrower1_prev_employer_2_title: 'Software Architect',
            borrower1_prev_employer_2_address: '222 Code Street, LA, CA 90026',
            borrower1_prev_employer_2_income: '95000',
            borrower1_prev_employment_2_years: '3',
            borrower1_prev_employment_2_months: '8',

            // Financial Details
            borrower1_alimony_payments: 'no',
            borrower1_alimony_recipient: '',
            borrower1_alimony_amount: '',
            borrower1_co_maker: 'no',
            borrower1_co_maker_for: '',
            borrower1_co_maker_to_whom: '',
            borrower1_judgments: 'no',
            borrower1_judgment_to_whom: '',
            borrower1_judgment_amount: '',
            borrower1_bankruptcy: 'no',
            borrower1_bankruptcy_where: '',
            borrower1_bankruptcy_year: '',

            // Borrower 2 - COMPLETE DATA
            borrower2_firstName: 'Lisa',
            borrower2_lastName: 'Thompson',
            borrower2_dob: '1987-04-25',
            borrower2_ssn: '678-90-1234',
            borrower2_drivers_license: 'CA-D678901234',
            borrower2_home_phone: '(555) 123-9876',
            borrower2_work_phone: '(555) 987-6543',
            borrower2_cellPhone: '(555) 876-5432',
            borrower2_email: 'lisa.thompson@email.com',

            borrower2_address_type: 'own',
            borrower2_current_address: '555 Executive Drive, Beverly Hills, CA 90210',
            borrower2_landlord_info: '',
            borrower2_current_address_years: '7',
            borrower2_current_address_months: '3',
            borrower2_previous_address_1: '888 Professional Plaza, West Hollywood, CA 90069',
            borrower2_prev_address_1_landlord_info: 'Hollywood Luxury Apartments - (555) 444-3333',
            borrower2_prev_address_1_years: '3',
            borrower2_prev_address_1_months: '5',
            borrower2_previous_address_2: '666 University Ave, Westwood, CA 90024',
            borrower2_prev_address_2_landlord_info: 'Student Housing Corp - (555) 222-1111',
            borrower2_prev_address_2_years: '4',
            borrower2_prev_address_2_months: '0',

            borrower2_current_employer: 'LA Medical Group',
            borrower2_employer_phone: '(555) 765-4321',
            borrower2_title: 'Chief of Cardiology',
            borrower2_employer_address: '999 Medical Center Dr, LA, CA 90048',
            borrower2_income: '275000',
            borrower2_employment_years: '8',
            borrower2_employment_months: '4',
            borrower2_other_income: '45000',
            borrower2_income_source: 'Private practice and medical consulting',

            borrower2_previous_employer_1: 'Cedar Sinai Medical Center',
            borrower2_prev_employer_1_phone: '(555) 111-2222',
            borrower2_prev_employer_1_title: 'Cardiologist',
            borrower2_prev_employer_1_address: '8700 Beverly Blvd, LA, CA 90048',
            borrower2_prev_employer_1_income: '225000',
            borrower2_prev_employment_1_years: '5',
            borrower2_prev_employment_1_months: '2',
            borrower2_previous_employer_2: 'UCLA Medical Residency',
            borrower2_prev_employer_2_phone: '(555) 333-4444',
            borrower2_prev_employer_2_title: 'Resident Physician',
            borrower2_prev_employer_2_address: '757 Westwood Plaza, LA, CA 90095',
            borrower2_prev_employer_2_income: '65000',
            borrower2_prev_employment_2_years: '4',
            borrower2_prev_employment_2_months: '0',

            borrower2_alimony_payments: 'no',
            borrower2_co_maker: 'no',
            borrower2_judgments: 'no',
            borrower2_bankruptcy: 'no',

            // Luxury Vehicle
            vehicle_year: '2023',
            vehicle_make_model: 'BMW X5',
            vehicle_trim: 'xDrive40i M Sport',
            vehicle_mileage: '8500',
            vehicle_vin: '5UXCR6C07P9123456',
            vehicle_condition: 'excellent',
            vehicle_color: 'Alpine White',
            vehicle_transmission: 'automatic',
            vehicle_fuel_type: 'gasoline',

            // Premium Transaction with Trade
            sellingPrice: '72500',
            cashDown: '15000',
            trade_value: '35000',
            trade_payoff: '28500',
            net_trade_value: '6500',
            totalDown: '21500',
            amountFinanced: '51000',
            taxes: '5800',
            titleFees: '650',
            warrantyFees: '2800',
            gapInsurance: '1295',
            term: '60',
            apr: '4.25'
        }
    },

    {
        // Application 5: Individual with maximum complexity - stress test all fields
        dealerEmail: 'joemachado62@live.com',
        applicantData: {
            dealer_name: 'MJM Motors',
            dealer_telephone: '(555) 123-4567',
            dealer_contact: 'Joe Machado',

            // Borrower 1 - MAXIMUM COMPLEXITY
            borrower1_firstName: 'Patricia',
            borrower1_lastName: 'Rodriguez-Chen',
            borrower1_dob: '1975-06-30',
            borrower1_ssn: '789-01-2345',
            borrower1_drivers_license: 'CA-D789012345',
            borrower1_home_phone: '(555) 987-6543',
            borrower1_work_phone: '(555) 876-5432', 
            borrower1_cellPhone: '(555) 765-4321',
            borrower1_email: 'patricia.rodriguez.chen@email.com',

            // Complex Address History (All 3 addresses)
            borrower1_address_type: 'rent',
            borrower1_current_address: '1234 International Blvd, Los Angeles, CA 90021',
            borrower1_landlord_info: 'Golden Gate Properties - (555) 888-9999 - Contact: Maria Gonzalez',
            borrower1_current_address_years: '2',
            borrower1_current_address_months: '11',
            borrower1_previous_address_1: '5678 Business Center Dr, Unit 456, Monterey Park, CA 91754',
            borrower1_prev_address_1_landlord_info: 'Corporate Housing Solutions - (555) 777-6666 - Emergency: (555) 777-6667',
            borrower1_prev_address_1_years: '3',
            borrower1_prev_address_1_months: '7',
            borrower1_previous_address_2: '9012 Family Street, East LA, CA 90063',
            borrower1_prev_address_2_landlord_info: 'Mother-in-law: Carmen Rodriguez - (555) 555-4444',
            borrower1_prev_address_2_years: '1',
            borrower1_prev_address_2_months: '4',

            // Complex Employment (All fields filled)
            borrower1_current_employer: 'International Import Export LLC',
            borrower1_employer_phone: '(555) 654-3210',
            borrower1_title: 'Operations Manager / Bilingual Coordinator',
            borrower1_employer_address: '2468 Trade Center Way, Suite 1200, Los Angeles, CA 90058',
            borrower1_income: '78500',
            borrower1_employment_years: '2',
            borrower1_employment_months: '9',
            borrower1_other_income: '18600',
            borrower1_income_source: 'Freelance translation services, rental income from spare room, alimony received from ex-husband',

            // Full Previous Employment History
            borrower1_previous_employer_1: 'ABC Manufacturing Corp',
            borrower1_prev_employer_1_phone: '(555) 432-1098',
            borrower1_prev_employer_1_title: 'Quality Control Supervisor',
            borrower1_prev_employer_1_address: '3579 Industrial Ave, Building C, Carson, CA 90746',
            borrower1_prev_employer_1_income: '67500',
            borrower1_prev_employment_1_years: '4',
            borrower1_prev_employment_1_months: '3',
            borrower1_previous_employer_2: 'Local Community College',
            borrower1_prev_employer_2_phone: '(555) 210-9876',
            borrower1_prev_employer_2_title: 'Part-time ESL Instructor',
            borrower1_prev_employer_2_address: '4680 Education Blvd, Los Angeles, CA 90037',
            borrower1_prev_employer_2_income: '35000',
            borrower1_prev_employment_2_years: '6',
            borrower1_prev_employment_2_months: '8',

            // Complex Financial Obligations
            borrower1_alimony_payments: 'yes',
            borrower1_alimony_recipient: 'Carlos Rodriguez, 1357 Divorce Court Lane, Glendale, CA 91201',
            borrower1_alimony_amount: '650',
            borrower1_co_maker: 'yes',
            borrower1_co_maker_for: 'Student loan for daughter and business loan for brother',
            borrower1_co_maker_to_whom: 'Federal Student Aid (daughter Sofia) and Wells Fargo Business (brother Miguel Rodriguez)',
            borrower1_judgments: 'yes',
            borrower1_judgment_to_whom: 'LA Superior Court - Medical bills from 2020 accident - Currently on payment plan',
            borrower1_judgment_amount: '8750',
            borrower1_bankruptcy: 'no',
            borrower1_bankruptcy_where: '',
            borrower1_bankruptcy_year: '',

            // Commercial Vehicle
            vehicle_year: '2020',
            vehicle_make_model: 'Chevrolet Silverado 2500HD',
            vehicle_trim: 'LTZ Crew Cab',
            vehicle_mileage: '85000',
            vehicle_vin: '1GC4YREY8LF123456',
            vehicle_condition: 'good',
            vehicle_color: 'Summit White',
            vehicle_transmission: 'automatic',
            vehicle_fuel_type: 'diesel',

            // Complex Transaction with Multiple Trade and Fees
            sellingPrice: '45500',
            cashDown: '2500',
            trade_value: '12500',
            trade_payoff: '9800',
            net_trade_value: '2700',
            totalDown: '5200',
            amountFinanced: '40300',
            taxes: '3640',
            titleFees: '550',
            warrantyFees: '2200',
            gapInsurance: '895',
            documentationFees: '395',
            term: '84',
            apr: '9.75'
        }
    }
];

async function createTestApplications() {
    try {
        logger.info('Starting creation of 5 comprehensive test applications...');
        
        // Get dealer information
        const dealer = await db.getDealerByEmail('joemachado62@live.com');
        if (!dealer) {
            throw new Error('Test dealer not found: joemachado62@live.com');
        }
        
        logger.info(`Creating applications for dealer: ${dealer.dealerName}`);
        
        const createdApplications = [];
        
        for (let i = 0; i < testApplications.length; i++) {
            const testApp = testApplications[i];
            
            // Create application data structure
            const applicationData = {
                dealerId: dealer.id,
                dealerName: dealer.dealerName,
                dealerLicenseNumber: dealer.dealerLicenseNumber,
                finNumber: dealer.finNumber,
                
                // Basic application info (unencrypted for dashboard display)
                applicantName: `${testApp.applicantData.borrower1_firstName} ${testApp.applicantData.borrower1_lastName}`,
                applicantEmail: testApp.applicantData.borrower1_email,
                vehicleInfo: `${testApp.applicantData.vehicle_year} ${testApp.applicantData.vehicle_make_model}`.trim(),
                amountFinanced: parseFloat(testApp.applicantData.amountFinanced?.replace(/[$,]/g, '') || 0),
                downPayment: parseFloat(testApp.applicantData.totalDown?.replace(/[$,]/g, '') || testApp.applicantData.cashDown?.replace(/[$,]/g, '') || 0),
                
                // Store complete application data
                applicantData: testApp.applicantData,
                
                // Status tracking
                status: 'submitted',
                dtStatus: 'pending',
                submittedFrom: '127.0.0.1',
                
                // GHL integration fields
                ghlMarketingContactId: null,
                ghlOpportunityId: null
            };
            
            // Store application in database
            const application = await db.createApplication(applicationData);
            
            // Add initial conversation log
            await db.addConversationNote(application.id, {
                content: `Credit application submitted for ${application.applicantName}. Vehicle: ${application.vehicleInfo}, Amount: $${application.amountFinanced.toLocaleString()}`,
                noteType: 'system_note',
                createdBy: 'system',
                createdByName: 'System',
                importanceLevel: 'normal'
            });
            
            createdApplications.push({
                id: application.id,
                applicantName: application.applicantName,
                vehicleInfo: application.vehicleInfo,
                amountFinanced: application.amountFinanced,
                type: i === 1 || i === 3 ? 'Joint Application' : 'Individual Application',
                complexity: ['Complete w/ Alimony & Trade', 'Joint - Minimal', 'Complex Financial History', 'Joint - All Fields', 'Maximum Complexity'][i]
            });
            
            logger.info(`Created application ${i + 1}/5: ${application.applicantName} - ${application.vehicleInfo}`);
        }
        
        // Summary
        logger.info('\n' + '='.repeat(80));
        logger.info('TEST APPLICATIONS CREATED SUCCESSFULLY');
        logger.info('='.repeat(80));
        
        createdApplications.forEach((app, i) => {
            logger.info(`${i + 1}. ID: ${app.id}`);
            logger.info(`   Applicant: ${app.applicantName}`);
            logger.info(`   Vehicle: ${app.vehicleInfo}`);
            logger.info(`   Amount: $${app.amountFinanced.toLocaleString()}`);
            logger.info(`   Type: ${app.type}`);
            logger.info(`   Test Focus: ${app.complexity}`);
            logger.info('');
        });
        
        logger.info('All applications can be viewed in the admin dashboard at:');
        logger.info('http://localhost:3000/admin-dashboard.html');
        logger.info('');
        logger.info('Dealer can view applications at:');
        logger.info('http://localhost:3000/dashboard.html (login as joemachado62@live.com)');
        
        return createdApplications;
        
    } catch (error) {
        logger.error('Error creating test applications:', error);
        throw error;
    }
}

// Run the script if called directly
if (require.main === module) {
    createTestApplications()
        .then(() => {
            logger.info('Test application creation completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Failed to create test applications:', error);
            process.exit(1);
        });
}

module.exports = { createTestApplications, testApplications };