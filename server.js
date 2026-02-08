const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dns = require("dns");

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Enable CORS with specific frontend domain
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


// Define the rate limiter

// app.use(limiter);

// Use morgan for logging
app.use(morgan("dev"));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware to log all requests (can be removed in production)
app.use((req, res, next) => {
  if (req.path.includes('/uploads/ra-bills')) {
    console.log(`[RA-BILLS] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    console.log(`[RA-BILLS] Looking for file: ${path.join(__dirname, 'uploads', req.path.replace('/uploads/', ''))}`);
    console.log(`[RA-BILLS] File exists: ${fs.existsSync(path.join(__dirname, 'uploads', req.path.replace('/uploads/', '')))}`);
  }
  if (req.path.includes('/branch')) {
    console.log(`[BRANCH API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       useDefaults: true,
//       directives: {
//         "img-src": [
//           "'self'",
//           "data:",
//           "http://localhost:3000", 
//           "https://madhuveer.com",
//           "http://localhost:5173",
//           "https://hotelviratrestaurant.netlify.app",
//           "https://hotelvirat.com",
//           "https://hotelvirat.netlify.app",
//         ],
//       },
//     },
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//   })
// );
  
 app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],

        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "http:",
          "https://madhuveer.com",
          "https://hotelvirat.com",
          "https://hotelvirat.netlify.app",
          "https://hotelviratrestaurant.netlify.app",
          "http://localhost:5173",
          "http://localhost:3000"
        ],

        "connect-src": [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "http:"
        ],

        "media-src": [
          "'self'",
          "blob:",
          "data:",
          "https:",
          "http:"
        ],

        "worker-src": [
          "'self'",
          "blob:",
          "data:"
        ],

        "frame-src": [
          "'self'",
          "blob:",
          "data:"
        ]
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const cron = require("node-cron");

// Run at 11:59 PM every day
cron.schedule("59 23 * * *", async () => {
  try {
    console.log("Running daily attendance processing...");
    await AttendanceMaster.processDailyAttendance();
    console.log("Daily attendance processing completed");
  } catch (error) {
    console.error("Error in daily attendance processing:", error);
  }
});

const {
  processDailyAttendance,
} = require("./controller/attendanceMasterController");

// Run at 11:59 PM every day to mark absent employees
cron.schedule("59 23 * * *", async () => {
  try {
    console.log("Running daily attendance processing...");

    // Create mock request and response objects
    const mockReq = {
      body: { date: new Date().toISOString().split("T")[0] },
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            console.log("Daily attendance processing completed:", data.message);
          } else {
            console.error("Daily attendance processing failed:", data);
          }
        },
      }),
    };

    await processDailyAttendance(mockReq, mockRes);
  } catch (error) {
    console.error("Error in daily attendance processing:", error);
  }
});

// Create upload directories if they don't exist
const createDirIfNotExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  }
};

createDirIfNotExists("uploads");
createDirIfNotExists("uploads/profile");
createDirIfNotExists("uploads/category");
createDirIfNotExists("uploads/menu");
createDirIfNotExists("uploads/offer");
createDirIfNotExists("uploads/table");

// Serve static files from the "uploads" directory
// Add logging middleware for uploads
app.use("/uploads", (req, res, next) => {
  console.log(`📁 Static file request: ${req.url}`);
  console.log(`📂 Looking in: ${path.join(__dirname, "uploads", req.url)}`);
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Note: Mongoose will buffer commands if not connected
// Connection state checks in controllers will prevent operations when disconnected

// Helper function to show DNS error guidance
function showDnsErrorGuidance() {
  console.error("💡 DNS Resolution Error - Possible fixes:");
  console.error("   1. Check your internet connection");
  console.error("   2. Try using a different DNS server (e.g., 8.8.8.8 or 1.1.1.1)");
  console.error("   3. Check if your firewall/VPN is blocking DNS queries");
  console.error("   4. Get standard connection string from MongoDB Atlas:");
  console.error("      - Go to Atlas → Connect → Connect your application");
  console.error("      - Select 'Standard connection string' instead of 'SRV connection string'");
  console.error("   5. Temporarily disable VPN if active");
}

// Helper function to convert SRV connection string to standard connection string
async function convertSrvToStandard(srvUri) {
  try {
    // Extract parts from mongodb+srv://username:password@cluster.mongodb.net/dbname?options
    const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(\?.*)?$/);
    if (!match) return null;
    
    const [, username, password, cluster, dbname, options] = match;
    
    // Try to resolve SRV record to get actual replica set members
    try {
      const srvRecords = await new Promise((resolve, reject) => {
        dns.resolveSrv(`_mongodb._tcp.${cluster}`, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      
      if (srvRecords && srvRecords.length > 0) {
        // Build connection string with all replica set members
        const hosts = srvRecords.map(record => `${record.name}:${record.port}`).join(',');
        const replicaSetName = srvRecords[0].name.split('.')[0];
        const opts = options ? options.replace('?', '&') : '';
        const standardUri = `mongodb://${username}:${password}@${hosts}/${dbname}?replicaSet=${replicaSetName}${opts}`;
        return standardUri;
      }
    } catch (dnsErr) {
      // If DNS resolution fails, fall back to simplified conversion
      console.warn("⚠️  Could not resolve SRV record, using simplified conversion");
    }
    
    // Fallback: Use cluster name directly with port 27017
    // Note: This may not work for all clusters. Best to get standard connection string from MongoDB Atlas
    const standardUri = `mongodb://${username}:${password}@${cluster}:27017/${dbname}${options || ''}`;
    return standardUri;
  } catch (err) {
    return null;
  }
}

// MongoDB Connection with retry logic
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function connectToMongoDB(mongoUri, isRetry = false, isFallback = false) {
  const connectionOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    retryWrites: true,
    retryReads: true,
    family: 4, // Force IPv4
  };

  try {
    await mongoose.connect(mongoUri, connectionOptions);
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📊 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    // Reset retry count on successful connection
    retryCount = 0;
    
    // One-time cleanup: Drop old grnId index if it exists
    mongoose.connection.db.collection('grns').dropIndex('grnId_1')
      .then(() => console.log('✅ Dropped old grnId_1 index'))
      .catch(() => {
        // Index doesn't exist or already dropped - ignore
      });
  } catch (err) {
    console.error("❌ MongoDB Connection Error: ", err.message);
    
    // Handle DNS resolution errors
    if ((err.message.includes('querySrv EREFUSED') || err.message.includes('ENOTFOUND')) && !isFallback) {
      console.warn("⚠️  DNS Resolution Error detected. Attempting fallback to standard connection string...");
      
      // Try converting SRV to standard connection string
      if (mongoUri.startsWith('mongodb+srv://')) {
        convertSrvToStandard(mongoUri)
          .then(standardUri => {
            if (standardUri) {
              console.log("🔄 Attempting connection with standard connection string...");
              // Try with standard connection string (without SRV)
              connectToMongoDB(standardUri, false, true);
            } else {
              // If conversion failed, proceed with error guidance
              showDnsErrorGuidance();
            }
          })
          .catch(() => {
            showDnsErrorGuidance();
          });
        return; // Exit early, will retry with standard URI or show guidance
      } else {
        showDnsErrorGuidance();
      }
    } else if (err.message.includes('authentication failed')) {
      console.error("💡 Authentication Error:");
      console.error("   1. Check your MongoDB username and password");
      console.error("   2. Ensure special characters in password are URL-encoded");
    } else if (err.message.includes('IP')) {
      console.error("💡 IP Whitelist Error:");
      console.error("   1. Add your current IP to MongoDB Atlas IP Whitelist");
      console.error("   2. Or add 0.0.0.0/0 to allow all IPs (less secure)");
    } else {
      console.error("💡 General troubleshooting:");
      console.error("   1. MongoDB server is running");
      console.error("   2. MONGO_URI is correct in your .env file");
      console.error("   3. Network connectivity to MongoDB");
      console.error("   4. Check MongoDB Atlas cluster status");
    }
    
    // Retry logic
    if (!isRetry && retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = RETRY_DELAY * retryCount; // Exponential backoff
      console.log(`🔄 Retrying connection in ${delay / 1000} seconds... (Attempt ${retryCount}/${MAX_RETRIES})`);
      setTimeout(() => {
        connectToMongoDB(mongoUri, true, isFallback);
      }, delay);
    } else if (retryCount >= MAX_RETRIES) {
      console.error("❌ Max retries reached. Please check your connection and try again.");
    }
  }
}

// MongoDB Connection
if (!process.env.MONGO_URI) {
  console.error("⚠️  MONGO_URI environment variable is not set!");
  console.error("💡 Please create a .env file in the crm_backend directory with:");
  console.error("   MONGO_URI=your_mongodb_connection_string");
} else {
  console.log("🔌 Attempting to connect to MongoDB...");
  
  // Validate MongoDB URI format
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri.includes('mongodb.net') && !mongoUri.includes('mongodb://') && !mongoUri.includes('mongodb+srv://')) {
    console.warn("⚠️  MONGO_URI doesn't appear to be a valid MongoDB connection string");
  }
  
  // Start connection
  connectToMongoDB(mongoUri);
}

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  // Mongoose will automatically attempt to reconnect, but we can also manually trigger
  if (process.env.MONGO_URI && mongoose.connection.readyState === 0) {
    setTimeout(() => {
      if (mongoose.connection.readyState === 0) {
        console.log('🔄 Manual reconnection attempt...');
        connectToMongoDB(process.env.MONGO_URI, false, false);
      }
    }, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
  retryCount = 0; // Reset retry count on successful reconnection
});

mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
  retryCount = 0; // Reset retry count on successful connection
});

// Import Worker Models to ensure they are registered
require("./model/ConstructionWorker");
require("./model/ConstructionWorkerAttendance");

// Import Routes
const payrollRoutes = require("./routes/payrollRoutes");
const userRoutes = require("./routes/userRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
// Branch routes moved to Restaurant folder
const restaurantBranchRoutes = require("./Restaurant/RestaurantRoutes/RestaurantBranchRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const menuRoutes = require("./routes/menuRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const aboutUsRoutes = require("./routes/aboutUsRoutes");
const helpSupportRoutes = require("./routes/helpSupportRoutes");
const termsRoutes = require("./routes/termsRoutes");
const addressRoutes = require("./routes/addressRoutes");
const adminRoutes = require("./routes/adminRoutes");
const counterLoginRoutes = require("./routes/counterLoginRoutes");
const customerDetailsRoutes = require("./routes/customerDetailsRoutes");
const counterInvoiceRoutes = require("./routes/counterInvoiceRoutes");
const staffLoginRoutes = require("./routes/staffLoginRoutes");
const tableRoutes = require("./routes/tableRoutes");
const peopleSelectionRoutes = require("./routes/peopleSelectionRoutes");
const staffOrderRoutes = require("./routes/staffOrderRoutes");
const counterOrderRoutes = require("./routes/counterOrderRoutes");
const counterBillRoutes = require("./routes/counterBillRoutes");
const staffInvoiceRoutes = require("./routes/staffInvoiceRoutes");
const recipeRoutes = require("./Restaurant/RestaurantRoutes/RestaurantRecipeRoutes");
// const poRoutes = require("./routes/poRoutes"); // File doesn't exist
const customerRoutes = require("./routes/customerRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseRoutes = require("./construction/routes/purchaseRoutes");
const rawMaterialRoutes = require("./Restaurant/RestaurantRoutes/RestaurantRawMaterialRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const purchaseUserRoutes = require("./routes/purchaseUserRoutes");
const productSubmissionRoutes = require("./routes/productSubmissionRoutes");
const stockRoutes = require("./routes/stockRoutes");
const stockInwardRoutes = require("./Restaurant/RestaurantRoutes/RestaurantStockInvardRoutes");
const storeLocationRoutes = require("./Restaurant/RestaurantRoutes/RestaurantStoreLocationRoutes");
// const inventoryRoutes = require("./construction/routes/inventoryRoutes");
const quotation = require("./construction/routes/quotationRoutes");
const distributionRoutes = require("./routes/distributionRoutes");
const inventoryDistributionRoutes = require("./Restaurant/routes/inventoryDistributionRoutes");
const storeInventoryRoutes = require("./routes/storeInventoryRoutes");
const roleRoutes = require("./construction/routes/roleRoutes"); // Construction role management routes
const configurationRoutes = require("./routes/configurationRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const employeeAuthRoutes = require("./routes/employeeAuthRoutes");
const siteManagementRoutes = require("./routes/siteManagementRoutes");
const workerRoutes = require("./routes/workerRoutes");
const constructionIndex = require("./routes/constructionIndex");
const constructionInvoiceRoutes = require("./routes/constructionInvoiceRoutes");
const constructionPaymentRoutes = require("./routes/constructionPaymentRoutes");
const constructionClientRoutes = require("./routes/constructionClientRoutes");
const constructionProjectRoutes = require("./routes/constructionProjectRoutes");
const constructionWorkOrderRoutes = require("./routes/constructionWorkOrderRoutes");
const constructionReportRoutes = require("./routes/constructionReportRoutes");
const constructionSettingsRoutes = require("./routes/constructionSettingsRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
// const attendanceRoutes = require("./routes/attendanceRoutes");
const Vendor = require("./routes/vendorRoutes");
// const constructionWorkOrderRoutes = require("./routes/constructionWorkOrderRoutes");
const attendanceConsRoutes = require("./routes/attendanceRoutesConstruction");
const supervisorExpenseRoutes = require("./routes/supervisorexpenseRoutes");
const PayslipCons = require("./routes/payslipRoutes");
const PayrollCons = require("./routes/payrollRoutesConstruction");
const reportRoutes = require("./routes/reportRoutes");
const safetytRoutes = require("./routes/SafetyRoutes");
const siteRoutes = require("./routes/siteroutes");
const indentRoutes = require("./routes/indentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const grnRoutes = require("./construction/routes/grnRoutes");
const vendorInvoiceRoutes = require("./construction/routes/vendorInvoiceRoutes");
const vendorPaymentRoutes = require("./construction/routes/vendorPaymentRoutes");
const constructionRoutes = require("./routes/constructionRoutes");
const staffRoutes = require("./routes/staffRoutes");
const HolidayCalendar = require("./routes/holidayRoutes");
const followUp = require("./routes/followUpRoutes");
const communication = require("./routes/communicationRoutes");
const ticket = require("./routes/ticketRoutes");
const contract = require("./routes/contractRoutes");
const salaryStructureRoutes = require("./routes/salaryStructureRoutes");
const lead = require("./routes/leadRoutes");
const deliveries = require("./routes/deliveryRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const salesOrder = require("./routes/salesRoutes");
const AuditLog = require("./routes/auditLogRoutes");
const transferRoutes = require("./routes/transferRoutes");
const probationRoutes = require("./routes/probationRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const subAdminRoutes = require("./routes/subAdminRoutes");
const authUser = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const alertRoutes = require("./routes/alertRoutes");
const dailyReportRoutes = require("./routes/dailyReportRoutes");
const resUOMroutes = require("./routes/resUOMroute");
const resTaxSlabRoutes = require("./routes/resTaxSlabRoute");
const resSupplierRoutes = require("./routes/resSupplierRoute");
const newRecipeRequirementRoutes = require("./routes/newRecipeRequirementRoutes");
const attendanceMasterRoutes = require("./routes/attendanceMaster");
const attendanceRecordRoutes = require("./routes/attendanceRecord");
const restaurantMenuRoutes = require("./routes/restaurantMenuRoutes");
const hrmsRoutes = require("./Restaurant/RestaurantRoutes/RestaurantHrmsRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const majorExpenseRoutes = require("./routes/majorExpenseRoutes");
const accountantExpenseRoutes = require("./routes/accountantExpenseRoutes");
const expenseAdminRoutes = require("./routes/expenseAdminRoutes");
const raBillRoutes = require("./routes/raBillRoutes");
const pieceWorkRoutes = require("./routes/pieceWorkRoutes");
const subcontractorRoutes = require("./routes/subcontractorRoutes");

// Accounts & Finance Routes
const accountsRoutes = require("./routes/accountsRoutes");
const journalRoutes = require("./routes/journalRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const financialStatementRoutes = require("./routes/financialStatementRoutes");
const taxRoutes = require("./routes/taxRoutes");

// Notification Routes
const notificationRoutes = require("./routes/notificationRoutes");

// Approval Workflow Routes
const approvalRoutes = require("./routes/approvalRoutes");

// Security Routes (Audit Logs, 2FA, Sessions, Security Settings)
const securityRoutes = require("./routes/securityRoutes");

//new changes
app.use("/api/v1/hotel/restaurant-menu", restaurantMenuRoutes);
app.use("/api/v1/attendance-master", attendanceMasterRoutes);
app.use("/api/v1/attendance-record", attendanceRecordRoutes);
app.use("/api/v1/hrms", hrmsRoutes);
const materialCategoryRoutes = require("./routes/materialCategoryRoutes");
const resRawmaterialRoutes = require("./routes/resRawMaterialRoute");
const purchaseOrdersRoutes = require("./construction/routes/purchaseRoutes");
const restaurantProfileRoutes = require("./Restaurant/RestaurantRoutes/RestaurantProfileRoutes");
const restaurantTableRoutes = require("./Restaurant/RestaurantRoutes/RestaurantTabelRoutes");
const restaurantGRNRoutes = require("./Restaurant/RestaurantRoutes/RestaurantGoodReceiptNotesRoutes");
const restaurantSupplierRoutes = require("./Restaurant/RestaurantRoutes/RestaurantSupplierRoutes");
console.log("✓ Restaurant Supplier Routes loaded:", typeof restaurantSupplierRoutes);
const restaurantPurchaseRoutes = require("./Restaurant/RestaurantRoutes/RestaurantPurchaseRoutes");
console.log("✓ Restaurant Purchase Routes loaded:", typeof restaurantPurchaseRoutes);
const restaurantInvoiceRoutes = require("./Restaurant/RestaurantRoutes/RestaurantInvoiceRoutes");
console.log("✓ Restaurant Invoice Routes loaded:", typeof restaurantInvoiceRoutes);
const restaurantPaymentRoutes = require("./Restaurant/RestaurantRoutes/RestaurantPaymentRoutes");
console.log("✓ Restaurant Payment Routes loaded:", typeof restaurantPaymentRoutes);
const restaurantRoomRoutes = require("./routes/restaurantRoomRoutes");
console.log("✓ Restaurant Room Routes loaded:", typeof restaurantRoomRoutes);
const kitchenPrinterRoutes = require("./routes/kitchenPrinterRoutes");
const employeeRegistrationRoutes = require("./routes/employeeRegistrationRoutes");
const salarySlipRoutes = require("./routes/salarySlipRoutes");

// const inventoryRoutes = require("./construction/routes/inventoryRoutes")
const kitchenRoutes = require("./routes/kitchenRoutes");
const kitchenDisplayRoutes = require("./routes/kitchenDisplayRoutes");
const claimRoutes = require("./routes/claimRoutes");
const settingroutes = require("./routes/settingsRoutes");
const expenseManagementRoutes = require("./routes/expenseManagementRoutes");
// const claimRoutes = require("./routes/claimRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const salesReportRoutes = require("./routes/salesReport");

// API v1 Routes with proper prefix
app.use("/api/v1/hotel/sales-report", salesReportRoutes);
app.use("/api/v1/salary-slip", salarySlipRoutes);
app.use("/api/expenses", expenseManagementRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/v1/employee", employeeRegistrationRoutes);
app.use("/api/v1/hotel", restaurantProfileRoutes);
app.use("/api/v1/hotel/table", restaurantTableRoutes);
app.use("/api/v1/hotel/grn", restaurantGRNRoutes); // GRN routes (now with PO integration)
// New integrated Purchase Management routes
app.use("/api/v1/restaurant/invoice", restaurantInvoiceRoutes); // Invoice management
console.log("✓ Restaurant Invoice routes registered at /api/v1/restaurant/invoice");
app.use("/api/v1/restaurant/payment", restaurantPaymentRoutes); // Payment management
console.log("✓ Restaurant Payment routes registered at /api/v1/restaurant/payment");
// Restaurant Supplier routes - register before catch-all restaurant route
app.use("/api/v1/restaurant/supplier", restaurantSupplierRoutes);
console.log("✓ Restaurant Supplier routes registered at /api/v1/restaurant/supplier");
// Restaurant Room routes - proxy to HotelViratAws
app.use("/api/v1/restaurant/menu", restaurantRoomRoutes);
console.log("✓ Restaurant Room routes registered at /api/v1/restaurant/menu");
app.use("/api/v1/hotel/kitchen-printer", kitchenPrinterRoutes);
app.use("/api/v1/hotel/user-auth", userRoutes);
// Module Access Management - User routes for admin
app.use("/api/users", userRoutes);
console.log("✓ User management routes registered at /api/users");
app.use("/api/v1/hotel/branch", restaurantBranchRoutes);
app.use("/api/v1/hotel/category", categoryRoutes);
app.use("/api/v1/hotel/menu", menuRoutes);
app.use("/api/v1/hotel/recipemanagement", menuRoutes);
app.use("/api/v1/hotel/cart", cartRoutes);
app.use("/api/v1/hotel/order", orderRoutes);
app.use("/api/v1/hotel/coupon", couponRoutes);
app.use("/api/v1/hotel/about-us", aboutUsRoutes);
app.use("/api/v1/hotel/help-support", helpSupportRoutes);
app.use("/api/v1/hotel/terms", termsRoutes);
app.use("/api/v1/hotel/address", addressRoutes);
app.use("/api/v1/hotel/admin-auth", adminRoutes);
app.use("/api/v1/hotel/counter-auth", counterLoginRoutes);
app.use("/api/v1/hotel/customer-details", customerDetailsRoutes);
app.use("/api/v1/hotel/counter-invoice", counterInvoiceRoutes);
app.use("/api/v1/hotel/staff-auth", staffLoginRoutes);
// app.use("/api/v1/hotel/table", tableRoutes); // Replaced by restaurantTableRoutes
app.use("/api/v1/hotel/people-selection", peopleSelectionRoutes);
app.use("/api/v1/hotel/staff-order", staffOrderRoutes);
app.use("/api/v1/hotel/counter-order", counterOrderRoutes);
app.use("/api/v1/hotel/counter-bill", counterBillRoutes);
app.use("/api/v1/hotel/staff-invoice", staffInvoiceRoutes);
app.use("/api/v1/hotel/recipes", recipeRoutes);
app.use("/api/new-recipe-requirements", newRecipeRequirementRoutes);
// app.use("/api", newRecipeRequirementRoutes);
app.use("/api/v1/hotel/customer", customerRoutes);
app.use("/api/v1/hotel/supplier", supplierRoutes);
app.use("/api/v1/hotel/purchase", purchaseRoutes);
app.use("/api/v1/hotel/raw-material", rawMaterialRoutes);
app.use("/api/v1/hotel/vendor-invoice", vendorInvoiceRoutes);
app.use("/api/v1/hotel/vendor-payment", vendorPaymentRoutes);
app.use("/api/v1/hotel/reservation", reservationRoutes);
app.use("/api/v1/hotel/expense", expenseRoutes);
// app.use("/api/v1/hotel/attendance", attendanceRoutes);
app.use("/api/v1/hotel/payroll", payrollRoutes);
app.use("/api/v1/hotel/staff", staffRoutes);
app.use("/api/v1/hotel/store-location", storeLocationRoutes);
app.use("/api/v1/hotel/stock-inward", stockInwardRoutes);
app.use("/api/v1/hotel/distribution", distributionRoutes);
app.use("/api/v1/hotel/inventory-distribution", inventoryDistributionRoutes);
app.use("/api/v1/hotel/store-inventory", storeInventoryRoutes);
// app.use("/api/v1/hotel/location-inventory", inventoryRoutes); // Add this line - this is the missing route!
// const materialCategoryRoutes = require("./routes/materialCategoryRoutes");
// const resRawmaterialRoutes = require("./routes/resRawMaterialRoute");
// const purchaseOrdersRoutes = require("./construction/routes/purchaseRoutes");
const resStockRoutes = require("./routes/resStockRoutes");

// API v1 Routes with proper prefix
app.use("/api/v1/hotel/user-auth", userRoutes);
// Branch route already registered above (line 307)
app.use("/api/v1/hotel/category", categoryRoutes);
// app.use("/api/v1/hotel/menu", menuRoutes);
app.use("/api/v1/hotel/order", orderRoutes);
app.use("/api/v1/hotel/coupon", couponRoutes);
app.use("/api/v1/hotel/about-us", aboutUsRoutes);
app.use("/api/v1/hotel/help-support", helpSupportRoutes);
app.use("/api/v1/hotel/terms", termsRoutes);
app.use("/api/v1/hotel/address", addressRoutes);
app.use("/api/v1/hotel/admin-auth", adminRoutes);
app.use("/api/v1/hotel/counter-auth", counterLoginRoutes);
app.use("/api/v1/hotel/customer-details", customerDetailsRoutes);
app.use("/api/v1/hotel/counter-invoice", counterInvoiceRoutes);
app.use("/api/v1/hotel/staff-auth", staffLoginRoutes);
// app.use("/api/v1/hotel/table", tableRoutes); // Replaced by restaurantTableRoutes
app.use("/api/v1/hotel/people-selection", peopleSelectionRoutes);
app.use("/api/v1/hotel/staff-order", staffOrderRoutes);
app.use("/api/v1/hotel/counter-order", counterOrderRoutes);
app.use("/api/v1/hotel/counter-bill", counterBillRoutes);
app.use("/api/v1/hotel/staff-invoice", staffInvoiceRoutes);
app.use("/api/v1/hotel/recipes", recipeRoutes);
// Duplicate hotel routes removed - already registered above (lines 315-327)

//new changes
app.use("/api/v1/hotel/matCategory", materialCategoryRoutes);
app.use("/api/v1/hotel/matRawMaterial", resRawmaterialRoutes);
app.use("/api/v1/hotel/purchaseOrders", purchaseOrdersRoutes);
app.use("/api/v1/hotel/purchase-orders", restaurantPurchaseRoutes); // Restaurant Purchase Orders
app.use("/api/v1/construction/purchase-orders", purchaseOrdersRoutes); // Construction Purchase Orders
app.use("/api/v1/config/departments", departmentRoutes);
// app.use("/api/v1/hotel/inventory", inventoryRoutes);

// Construction routes
app.use("/api/v1/hotel/purchase-user-auth", purchaseUserRoutes);
app.use("/api/v1/hotel/product-submission", productSubmissionRoutes);
app.use("/api/v1/hotel/stock", stockRoutes);
// app.use("/api/v1/config/roles", roleRoutes); // Old unused route - replaced by construction role routes
app.use("/api/v1/config/configuration", configurationRoutes);
app.use("/api/v1/config/employee", employeeRoutes);
app.use("/api/v1/hotel/employee", employeeRoutes);
app.use("/api/v1/employees", employeeRoutes); // New employee management route
app.use("/api/v1/employee-auth", employeeAuthRoutes); // Employee mobile app authentication
const employeeAttendanceRoutes = require("./routes/employeeAttendanceRoutes");
app.use("/api/v1/employee/attendance", employeeAttendanceRoutes); // Employee attendance for mobile app
app.use("/api/v1/site-management", siteManagementRoutes); // Site management routes
app.use("/api/v1/workers", workerRoutes); // Worker management routes
app.use("/api/v1/ra-bills", raBillRoutes); // RA Bills management routes
app.use("/api/v1/piece-works", pieceWorkRoutes); // Piece Work management routes
app.use("/api/v1/subcontractors", subcontractorRoutes); // Subcontractor management routes

// Indent & Inventory Management Routes (using existing indentRoutes from line 208)
const inventoryRoutes = require("./construction/routes/inventoryRoutes");
const materialTypeRoutes = require("./construction/routes/materialTypeRoutes");
const directPurchaseRoutes = require("./construction/routes/directPurchaseRoutes");
app.use("/api/v1/indents", indentRoutes); // Indent management routes
app.use("/api/v1/inventory", inventoryRoutes); // Inventory management routes
app.use("/api/v1/material-types", materialTypeRoutes); // Material types catalog
app.use("/api/v1/direct-purchase", directPurchaseRoutes); // Direct purchase with auto-documentation
app.use("/api/v1/hotel/vendor", vendorRoutes); // Vendor management routes

// Purchase Management Routes (using existing purchaseRoutes from line 175)
app.use("/api/v1/purchase", purchaseRoutes); // Purchase management routes (Quotation, PO, GRN, Invoice)

app.use("/api/v1/leaves", leaveRoutes);

// app.use("/api/v1/construction/Invoice", constructionInvoiceRoutes)
// app.use("/api/v1/costruction/vendor", Vendor)
app.use("/api/v1/construction/attendanceCons", attendanceConsRoutes);
app.use("/api/v1/construction/payslipcons", PayslipCons);

// HRS (Human Resource System) Routes - using construction payroll routes
const hrsPayrollRoutes = require("./routes/payrollRoutesConstruction");
const simpleAttendanceRoutes = require("./routes/simpleAttendanceRoutes");
app.use("/api/v1/leaves", leaveRoutes); // Using already declared leaveRoutes
app.use("/api/v1/payroll", hrsPayrollRoutes); // Using construction payroll routes
app.use("/api/v1/attendance", simpleAttendanceRoutes);
// Supplier and indent routes already registered above as /api/v1/indents and hotel suppliers
app.use("/api/v1/construction/dashboard", dashboardRoutes);
app.use("/api/v1/construction/work-orders", constructionWorkOrderRoutes);
// app.use("/api/v1/construction/supervisorexpense", supervisorExpenseRoutes)
app.use("/api/v1/construction/PayrollCons", PayrollCons);
app.use("/api/v1/construction/sefty", safetytRoutes);
app.use("/api/v1/construction/site", siteRoutes);
app.use("/api/v1/construction/grn", grnRoutes);
app.use("/api/v1/construction/quotation", quotation);
app.use("/api/v1/construction/vendor-invoice", vendorInvoiceRoutes);
app.use("/api/v1/construction", constructionRoutes);

// Expense Management Routes
const constructionExpenseRoutes = require("./construction/routes/expenseRoutes");
app.use("/api/v1/construction/expenses", constructionExpenseRoutes);

// Fixed Assets Management Routes
const fixedAssetRoutes = require("./construction/routes/fixedAssetRoutes");
app.use("/api/v1/construction/fixed-assets", fixedAssetRoutes);
app.use("/construction/fixed-assets", fixedAssetRoutes);

// Role Management Routes (Construction)
const constructionRoleRoutes = require("./construction/routes/roleRoutes");
app.use("/api/v1/construction/roles", constructionRoleRoutes);

// Site Supervisor App Routes
const siteSupervisorAuthRoutes = require("./construction/sitesupervisorapp/routes/siteSupervisorAuthRoutes");
const siteSupervisorDashboardRoutes = require("./construction/sitesupervisorapp/routes/dashboardRoutes");
const siteSupervisorAttendanceRoutes = require("./construction/sitesupervisorapp/routes/attendanceRoutes");
const siteSupervisorLabourRoutes = require("./construction/sitesupervisorapp/routes/labourRoutes");
const siteSupervisorStockRoutes = require("./construction/sitesupervisorapp/routes/stockRoutes");
const siteSupervisorExpenseRoutes = require("./construction/sitesupervisorapp/routes/expenseRoutes");
const siteSupervisorBudgetRoutes = require("./construction/sitesupervisorapp/routes/budgetRoutes");
const siteSupervisorProgressRoutes = require("./construction/sitesupervisorapp/routes/siteProgressRoutes");
app.use("/api/v1/sitesupervisor", siteSupervisorAuthRoutes);
app.use("/api/v1/sitesupervisor/dashboard", siteSupervisorDashboardRoutes);
app.use("/api/v1/sitesupervisor/attendance", siteSupervisorAttendanceRoutes);
app.use("/api/v1/sitesupervisor/labour", siteSupervisorLabourRoutes);
app.use("/api/v1/sitesupervisor/stock", siteSupervisorStockRoutes);
app.use("/api/v1/sitesupervisor/expense", siteSupervisorExpenseRoutes);
app.use("/api/v1/sitesupervisor/budget", siteSupervisorBudgetRoutes);
app.use("/api/v1/sitesupervisor/progress", siteSupervisorProgressRoutes);

// Health check endpoint
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "Server is running",
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//   });
// });
 
app.use(express.static(path.join(__dirname, 'build'))); // Change 'build' to your frontend folder if needed

// Redirect all non-API requests to the index.html file (for frontend routing)
app.get("*", (req, res, next) => {
  // Skip API routes and specific backend routes - let them return 404 if not found
  if (req.path.startsWith('/api/') || req.path.startsWith('/UOM')) {
    return next();
  }
  return res.sendFile(path.join(__dirname, 'build', 'index.html'));
}); 

// Construction
app.use("/hotel/purchase-user-auth", purchaseUserRoutes);
app.use("/hotel/product-submission", productSubmissionRoutes);
app.use("/hotel/stock", stockRoutes);
app.use("/hotel/store-location", storeLocationRoutes);
// app.use("/config/roles", roleRoutes); // Old unused route - replaced by construction role routes
app.use("/config/configuration", configurationRoutes);
app.use("/config/employee", employeeRoutes);
app.use("/config/leave", leaveRoutes);
app.use("/construction/work-orders", constructionWorkOrderRoutes);
app.use("/construction/Invoice", constructionInvoiceRoutes);
app.use("/construction/Payment", constructionPaymentRoutes);

app.use("/construction/vendor", vendorRoutes);
app.use("/construction/po/vendor", vendorRoutes); // For PurchaseAccountant component
app.use("/construction/po", purchaseRoutes); // For PurchaseAdmin component - maps to purchase-orders
app.use("/construction/attendanceCons", attendanceConsRoutes);
app.use("/construction/payslipcons", PayslipCons);
app.use("/construction/indents", indentRoutes);
app.use("/construction/dashboard", dashboardRoutes);


app.use("/construction/task", taskRoutes);
app.use("/construction/alert", alertRoutes);
app.use("/construction/daily-report", dailyReportRoutes);


app.use("/construction/supervisorexpense", supervisorExpenseRoutes);
app.use("/construction/major", majorExpenseRoutes);
app.use("/api/accountant", accountantExpenseRoutes);
app.use("/construction/expense-admin", expenseAdminRoutes);

app.use("/construction/PayrollCons", PayrollCons);
app.use("/construction/reports", reportRoutes);
app.use("/construction/sefty", safetytRoutes);
app.use("/construction/site", siteRoutes);
app.use("/construction/grn", grnRoutes);
app.use("/construction/quotation", quotation);
app.use("/construction/vendor-invoice", vendorInvoiceRoutes);
app.use("/construction/vendor-payment", vendorPaymentRoutes);

//Common
app.use("/holiday", HolidayCalendar);
app.use("/followUp", followUp);
app.use("/communication", communication);
app.use("/ticket", ticket);
app.use("/contract", contract);
app.use("/salary-structure", salaryStructureRoutes);
app.use("/api/v1/subadmin", subAdminRoutes);
app.use("/api/v1/auth", authUser);
app.use("/lead", lead);
app.use("/delivery", deliveries);
app.use("/opportunities", opportunityRoutes);
app.use("/salesOrder", salesOrder);
app.use("/auditLog", AuditLog);
app.use("/api/v1/common/transfers", transferRoutes);
app.use("/api/v1/common/probation", probationRoutes);
app.use("/subAdmin", subAdminRoutes);
app.use("/authUser", authUser);
app.use("/UOM", resUOMroutes);

// Accounts & Finance Routes
app.use("/api/v1/accounts", accountsRoutes);
app.use("/api/v1/journal", journalRoutes);
app.use("/api/v1/ledger", ledgerRoutes);
app.use("/api/v1/financial-statements", financialStatementRoutes);
app.use("/api/v1/tax", taxRoutes);

// Notification Routes
app.use("/api/v1/notifications", notificationRoutes);

// Approval Workflow Routes
app.use("/api/v1/approvals", approvalRoutes);

// Security Routes (Audit Logs, 2FA, Sessions, Security Settings)
app.use("/api/v1/security", securityRoutes);

app.use("/taxSlab", resTaxSlabRoutes);
app.use("/res/supplier", resSupplierRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/v1/kds", kitchenDisplayRoutes);

// Sales & CRM Routes (for Common CRM)
const salesRoutes = require("./routes/salesRoutes");
const crmRoutes = require("./routes/crmRoutes");
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/crm", crmRoutes);

// Business-type specific sales routes (Construction & Restaurant)
app.use("/api/v1/restaurant/quotation", quotation);
app.use("/api/v1/construction", salesRoutes);
app.use("/api/v1/restaurant", salesRoutes);

// Define Port
const PORT = process.env.PORT || 5000;

// Initialize HTTP server and Socket.io
const http = require("http");
const { initializeSocketIO } = require("./socketio");

const server = http.createServer(app);

// Initialize Socket.io with HTTP server
initializeSocketIO(server);

// Export server for Socket.io; app for Express routes
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server accessible at http://192.168.1.28:${PORT}`);
    console.log(`BASE_URL: ${process.env.BASE_URL || 'https://hotelviratbackend-1spr.onrender.com'}`);
    console.log(`Socket.io server ready for real-time connections`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please free the port or use a different port.`);
      process.exit(1);
    }
  });
} else {
  // For testing, just create the server without listening
  module.exports = app;
}

module.exports = { app, server };


//new changes

app.use("/api/v1/hotel/restaurant-menu", restaurantMenuRoutes);

app.use("/api/v1/attendance-master", attendanceMasterRoutes);

app.use("/api/v1/attendance-record", attendanceRecordRoutes);

app.use("/api/v1/hrms", hrmsRoutes);

//new changes

app.use("/api/v1/config/departments", departmentRoutes);

// app.use("/api/v1/hotel/inventory", inventoryRoutes);



// Construction routes

app.use("/api/v1/hotel/purchase-user-auth", purchaseUserRoutes);

app.use("/api/v1/hotel/product-submission", productSubmissionRoutes);

app.use("/api/v1/hotel/stock", stockRoutes);

app.use("/api/v1/config/roles", roleRoutes);

app.use("/api/v1/config/configuration", configurationRoutes);

app.use("/api/v1/config/employee", employeeRoutes);

app.use("/api/v1/hotel/employee", employeeRoutes);

app.use("/api/v1/employees", employeeRoutes); // New employee management route

app.use("/api/v1/employee-auth", employeeAuthRoutes); // Employee mobile app authentication

app.use("/api/v1/site-management", siteManagementRoutes); // Site management routes

app.use("/api/v1/workers", workerRoutes); // Worker management routes



// Indent & Inventory Management Routes (using existing indentRoutes from line 208)

app.use("/api/v1/indents", indentRoutes); // Indent management routes

app.use("/api/v1/inventory", inventoryRoutes); // Inventory management routes

app.use("/api/v1/material-types", materialTypeRoutes); // Material types catalog

app.use("/api/v1/direct-purchase", directPurchaseRoutes); // Direct purchase with auto-documentation

app.use("/api/v1/hotel/vendor", vendorRoutes); // Vendor management routes





app.use("/api/v1/purchase", purchaseRoutes); // Purchase management routes (Quotation, PO, GRN, Invoice)



app.use("/api/v1/leaves", leaveRoutes);



app.use("/api/v1/construction/attendanceCons", attendanceConsRoutes);

app.use("/api/v1/construction/payslipcons", PayslipCons);




app.use("/api/v1/leaves", leaveRoutes); // Using already declared leaveRoutes

app.use("/api/v1/payroll", hrsPayrollRoutes);

app.use("/api/v1/attendance", simpleAttendanceRoutes);

// Supplier and indent routes already registered above as /api/v1/indents and hotel suppliers

app.use("/api/v1/construction/dashboard", dashboardRoutes);

app.use("/api/v1/construction/work-orders", constructionWorkOrderRoutes);

// app.use("/api/v1/construction/supervisorexpense", supervisorExpenseRoutes)

app.use("/api/v1/construction/PayrollCons", PayrollCons);

app.use("/api/v1/construction/sefty", safetytRoutes);

app.use("/api/v1/construction/site", siteRoutes);

app.use("/api/v1/construction/grn", grnRoutes);

app.use("/api/v1/construction/quotation", quotation);

app.use("/api/v1/construction/vendor-invoice", vendorInvoiceRoutes);

app.use("/api/v1/construction", constructionRoutes);



// Expense Management Routes

app.use("/api/v1/construction/expenses", constructionExpenseRoutes);



// Health check endpoint

app.get("/health", (req, res) => {

  res.status(200).json({

    success: true,

    message: "Server is running",

    timestamp: new Date().toISOString(),

    uptime: process.uptime(),

  });

});



// Construction

app.use("/hotel/purchase-user-auth", purchaseUserRoutes);

app.use("/hotel/product-submission", productSubmissionRoutes);

app.use("/hotel/stock", stockRoutes);

app.use("/hotel/store-location", storeLocationRoutes);

app.use("/config/roles", roleRoutes);

app.use("/config/configuration", configurationRoutes);

app.use("/config/employee", employeeRoutes);

app.use("/config/leave", leaveRoutes);



app.use("/construction/work-orders", constructionWorkOrderRoutes);

app.use("/construction/Invoice", constructionInvoiceRoutes);

app.use("/construction/Payment", constructionPaymentRoutes);



app.use("/construction/vendor", vendorRoutes);

app.use("/construction/po/vendor", vendorRoutes); // For PurchaseAccountant component

app.use("/construction/po", purchaseRoutes); // For PurchaseAdmin component - maps to purchase-orders

app.use("/construction/attendanceCons", attendanceConsRoutes);

app.use("/construction/payslipcons", PayslipCons);

app.use("/construction/indents", indentRoutes);

app.use("/construction/dashboard", dashboardRoutes);



// app.use("/construction/work-orders", constructionWorkOrderRoutes);

app.use("/construction/task", taskRoutes);

app.use("/construction/alert", alertRoutes);

app.use("/construction/daily-report", dailyReportRoutes);





app.use("/construction/supervisorexpense", supervisorExpenseRoutes);

app.use("/construction/major", majorExpenseRoutes);

app.use("/api/accountant", accountantExpenseRoutes);

app.use("/construction/expense-admin", expenseAdminRoutes);



app.use("/construction/PayrollCons", PayrollCons);

app.use("/construction/reports", reportRoutes);

app.use("/construction/sefty", safetytRoutes);

app.use("/construction/site", siteRoutes);

app.use("/construction/grn", grnRoutes);

app.use("/construction/quotation", quotation);

app.use("/construction/vendor-invoice", vendorInvoiceRoutes);

app.use("/construction/vendor-payment", vendorPaymentRoutes);



//Common

app.use("/holiday", HolidayCalendar);

app.use("/followUp", followUp);

app.use("/communication", communication);

app.use("/ticket", ticket);

app.use("/contract", contract);

app.use("/salary-structure", salaryStructureRoutes);

app.use("/api/v1/subadmin", subAdminRoutes);

app.use("/api/v1/auth", authUser);

app.use("/lead", lead);

app.use("/delivery", deliveries);

app.use("/opportunities", opportunityRoutes);

app.use("/salesOrder", salesOrder);

app.use("/auditLog", AuditLog);

app.use("/api/v1/common/transfers", transferRoutes);

app.use("/api/v1/common/probation", probationRoutes);

app.use("/subAdmin", subAdminRoutes);

app.use("/authUser", authUser);

app.use("/UOM", resUOMroutes);



// Accounts & Finance Routes

app.use("/api/v1/accounts", accountsRoutes);

app.use("/api/v1/journal", journalRoutes);

app.use("/api/v1/ledger", ledgerRoutes);

app.use("/api/v1/financial-statements", financialStatementRoutes);

app.use("/api/v1/tax", taxRoutes);




app.use("/taxSlab", resTaxSlabRoutes);

app.use("/res/supplier", resSupplierRoutes);

app.use("/api/kitchen", kitchenRoutes);

app.use("/api/v1/kds", kitchenDisplayRoutes);



// Sales & CRM Routes (for Common CRM)

app.use("/api/v1/sales", salesRoutes);

app.use("/api/v1/crm", crmRoutes);



// Business-type specific sales routes (Construction & Restaurant)

app.use("/api/v1/restaurant/quotation", quotation);

app.use("/api/v1/construction", salesRoutes);

app.use("/api/v1/restaurant", salesRoutes);







