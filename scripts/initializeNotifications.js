/**
 * Initialize Notification Templates
 * This script will set up default notification templates
 * for both Restaurant and Construction business types
 */

require("dotenv").config();
const mongoose = require("mongoose");
const NotificationTemplate = require("../model/NotificationTemplate");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/hotelvirat",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Default notification templates
const getDefaultTemplates = () => [
  // Low Stock Alert
  {
    name: "Low Stock Alert",
    code: "LOW_STOCK_ALERT",
    description: "Alert when inventory is running low",
    businessType: "both",
    category: "Inventory",
    channels: {
      email: {
        enabled: true,
        subject: "⚠️ Low Stock Alert - {{itemName}}",
        body: "Hello,\n\n{{itemName}} stock is running low.\n\nCurrent Stock: {{currentStock}}\nReorder Level: {{reorderLevel}}\nBusiness: {{businessType}}\n\nPlease reorder immediately to avoid stock-out.\n\nBest Regards,\nInventory Management",
        htmlBody: "<h2>⚠️ Low Stock Alert</h2><p><strong>Item:</strong> {{itemName}}</p><p><strong>Current Stock:</strong> {{currentStock}}</p><p><strong>Reorder Level:</strong> {{reorderLevel}}</p><p><strong>Business:</strong> {{businessType}}</p><p>Please reorder immediately.</p>",
      },
      sms: {
        enabled: true,
        message: "LOW STOCK: {{itemName}} - {{currentStock}} left. Reorder now!",
      },
      whatsapp: {
        enabled: true,
        message: "⚠️ LOW STOCK ALERT\n{{itemName}}\nCurrent: {{currentStock}}\nReorder Level: {{reorderLevel}}",
      },
      inApp: {
        enabled: true,
        title: "Low Stock - {{itemName}}",
        message: "{{itemName}} stock is low: {{currentStock}} units",
      },
    },
    variables: [
      { name: "itemName", description: "Name of the item", required: true },
      { name: "currentStock", description: "Current stock quantity", required: true },
      { name: "reorderLevel", description: "Reorder level quantity", required: true },
      { name: "businessType", description: "Business type", required: true },
    ],
    priority: "High",
    triggerEvent: "stock_low",
    autoSend: true,
    isActive: true,
  },

  // Invoice Overdue
  {
    name: "Invoice Overdue Alert",
    code: "INVOICE_OVERDUE",
    description: "Alert when an invoice is overdue",
    businessType: "both",
    category: "Payment",
    channels: {
      email: {
        enabled: true,
        subject: "💰 Invoice Overdue - #{{invoiceNumber}}",
        body: "Dear Team,\n\nInvoice #{{invoiceNumber}} is now overdue.\n\nCustomer: {{customerName}}\nAmount: ₹{{amount}}\nDue Date: {{dueDate}}\nDays Overdue: {{daysOverdue}}\n\nPlease follow up for payment.\n\nBest Regards,\nAccounts Team",
        htmlBody: "<h2>💰 Invoice Overdue</h2><p><strong>Invoice:</strong> #{{invoiceNumber}}</p><p><strong>Customer:</strong> {{customerName}}</p><p><strong>Amount:</strong> ₹{{amount}}</p><p><strong>Due Date:</strong> {{dueDate}}</p><p><strong>Days Overdue:</strong> {{daysOverdue}}</p>",
      },
      sms: {
        enabled: true,
        message: "OVERDUE: Invoice #{{invoiceNumber}} - ₹{{amount}} - {{daysOverdue}} days",
      },
      inApp: {
        enabled: true,
        title: "Invoice Overdue - #{{invoiceNumber}}",
        message: "Invoice #{{invoiceNumber}} is {{daysOverdue}} days overdue",
      },
    },
    variables: [
      { name: "invoiceNumber", required: true },
      { name: "customerName", required: true },
      { name: "amount", required: true },
      { name: "dueDate", required: true },
      { name: "daysOverdue", required: true },
    ],
    priority: "Urgent",
    triggerEvent: "invoice_overdue",
    autoSend: true,
    isActive: true,
  },

  // Payment Received
  {
    name: "Payment Received",
    code: "PAYMENT_RECEIVED",
    description: "Notification when payment is received",
    businessType: "both",
    category: "Payment",
    channels: {
      email: {
        enabled: true,
        subject: "✅ Payment Received - #{{invoiceNumber}}",
        body: "Hello,\n\nPayment received successfully.\n\nInvoice: #{{invoiceNumber}}\nCustomer: {{customerName}}\nAmount: ₹{{amount}}\nPayment Method: {{paymentMethod}}\nDate: {{paymentDate}}\n\nThank you!\n\nBest Regards,\nAccounts Team",
      },
      inApp: {
        enabled: true,
        title: "Payment Received - #{{invoiceNumber}}",
        message: "₹{{amount}} received from {{customerName}}",
      },
    },
    variables: [
      { name: "invoiceNumber", required: true },
      { name: "customerName", required: true },
      { name: "amount", required: true },
      { name: "paymentMethod", required: true },
      { name: "paymentDate", required: true },
    ],
    priority: "Normal",
    triggerEvent: "payment_received",
    autoSend: true,
    isActive: true,
  },

  // New Order - Restaurant
  {
    name: "New Restaurant Order",
    code: "NEW_ORDER_RESTAURANT",
    description: "Notification for new restaurant orders",
    businessType: "restaurant",
    category: "Order",
    channels: {
      email: {
        enabled: true,
        subject: "🍽️ New Order - #{{orderNumber}}",
        body: "New order received!\n\nOrder: #{{orderNumber}}\nCustomer: {{customerName}}\nTable: {{tableNumber}}\nAmount: ₹{{amount}}\nItems: {{itemCount}}\n\nPlease prepare the order.",
      },
      sms: {
        enabled: true,
        message: "NEW ORDER #{{orderNumber}} - Table {{tableNumber}} - ₹{{amount}}",
      },
      inApp: {
        enabled: true,
        title: "New Order - #{{orderNumber}}",
        message: "Table {{tableNumber}} - {{itemCount}} items - ₹{{amount}}",
      },
    },
    variables: [
      { name: "orderNumber", required: true },
      { name: "customerName", required: true },
      { name: "tableNumber", required: false },
      { name: "amount", required: true },
      { name: "itemCount", required: true },
    ],
    priority: "High",
    triggerEvent: "order_placed",
    autoSend: true,
    isActive: true,
  },

  // Leave Application
  {
    name: "Leave Application",
    code: "LEAVE_APPLICATION",
    description: "Notification for leave applications",
    businessType: "both",
    category: "HR",
    channels: {
      email: {
        enabled: true,
        subject: "📝 Leave Application - {{employeeName}}",
        body: "New leave application received.\n\nEmployee: {{employeeName}}\nLeave Type: {{leaveType}}\nFrom: {{startDate}}\nTo: {{endDate}}\nDays: {{days}}\nReason: {{reason}}\n\nPlease review and approve/reject.",
      },
      inApp: {
        enabled: true,
        title: "Leave Application - {{employeeName}}",
        message: "{{leaveType}} from {{startDate}} to {{endDate}}",
      },
    },
    variables: [
      { name: "employeeName", required: true },
      { name: "leaveType", required: true },
      { name: "startDate", required: true },
      { name: "endDate", required: true },
      { name: "days", required: true },
      { name: "reason", required: true },
    ],
    priority: "Normal",
    triggerEvent: "leave_applied",
    autoSend: true,
    isActive: true,
  },

  // Approval Required
  {
    name: "Approval Required",
    code: "APPROVAL_REQUIRED",
    description: "Generic approval notification",
    businessType: "both",
    category: "Approval",
    channels: {
      email: {
        enabled: true,
        subject: "✅ Approval Required - {{type}} #{{reference}}",
        body: "Hello,\n\nA {{type}} requires your approval.\n\nReference: #{{reference}}\nRequested By: {{requestedBy}}\nAmount: ₹{{amount}}\nDate: {{requestDate}}\n\nPlease review and take action.\n\nBest Regards,\nSystem",
      },
      sms: {
        enabled: true,
        message: "APPROVAL: {{type}} #{{reference}} - ₹{{amount}} - {{requestedBy}}",
      },
      inApp: {
        enabled: true,
        title: "Approval Required - {{type}}",
        message: "{{type}} #{{reference}} by {{requestedBy}}",
      },
    },
    variables: [
      { name: "type", required: true },
      { name: "reference", required: true },
      { name: "requestedBy", required: true },
      { name: "amount", required: false },
      { name: "requestDate", required: true },
    ],
    priority: "High",
    triggerEvent: "custom",
    autoSend: false,
    isActive: true,
  },

  // Project Milestone - Construction
  {
    name: "Project Milestone Completed",
    code: "PROJECT_MILESTONE",
    description: "Notification when construction project milestone is completed",
    businessType: "construction",
    category: "System",
    channels: {
      email: {
        enabled: true,
        subject: "🏗️ Milestone Completed - {{projectName}}",
        body: "Milestone completed!\n\nProject: {{projectName}}\nMilestone: {{milestoneName}}\nCompletion: {{completionPercentage}}%\nCompleted By: {{completedBy}}\nDate: {{completionDate}}\n\nCongratulations!",
      },
      inApp: {
        enabled: true,
        title: "Milestone Completed",
        message: "{{projectName}} - {{milestoneName}} completed",
      },
    },
    variables: [
      { name: "projectName", required: true },
      { name: "milestoneName", required: true },
      { name: "completionPercentage", required: true },
      { name: "completedBy", required: true },
      { name: "completionDate", required: true },
    ],
    priority: "Normal",
    triggerEvent: "project_milestone_completed",
    autoSend: true,
    isActive: true,
  },

  // Salary Processed
  {
    name: "Salary Processed",
    code: "SALARY_PROCESSED",
    description: "Notification when salary is processed",
    businessType: "both",
    category: "HR",
    channels: {
      email: {
        enabled: true,
        subject: "💰 Salary Processed - {{month}} {{year}}",
        body: "Dear {{employeeName}},\n\nYour salary for {{month}} {{year}} has been processed.\n\nGross Salary: ₹{{grossSalary}}\nDeductions: ₹{{deductions}}\nNet Salary: ₹{{netSalary}}\n\nPayment will be credited shortly.\n\nBest Regards,\nHR Department",
      },
      sms: {
        enabled: true,
        message: "Salary processed for {{month}} {{year}} - ₹{{netSalary}} will be credited soon.",
      },
      inApp: {
        enabled: true,
        title: "Salary Processed",
        message: "{{month}} {{year}} salary: ₹{{netSalary}}",
      },
    },
    variables: [
      { name: "employeeName", required: true },
      { name: "month", required: true },
      { name: "year", required: true },
      { name: "grossSalary", required: true },
      { name: "deductions", required: true },
      { name: "netSalary", required: true },
    ],
    priority: "Normal",
    triggerEvent: "salary_processed",
    autoSend: true,
    isActive: true,
  },
];

const initializeTemplates = async () => {
  try {
    console.log("\n🚀 Starting Notification Templates Initialization...\n");

    const templates = getDefaultTemplates();
    let createdCount = 0;
    let skippedCount = 0;

    for (const templateData of templates) {
      try {
        const template = new NotificationTemplate(templateData);
        await template.save();
        console.log(`✅ Created: ${templateData.name} (${templateData.code})`);
        createdCount++;
      } catch (err) {
        if (err.code === 11000) {
          console.log(`⏭️  Skipped: ${templateData.name} (already exists)`);
          skippedCount++;
        } else {
          console.error(`❌ Error creating ${templateData.name}:`, err.message);
        }
      }
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("🎉 INITIALIZATION COMPLETE!");
    console.log("═══════════════════════════════════════════════════");
    console.log(`✅ Templates Created: ${createdCount}`);
    console.log(`⏭️  Templates Skipped: ${skippedCount}`);
    console.log(`📊 Total Templates: ${createdCount + skippedCount}`);
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📝 Next Steps:");
    console.log("1. Configure email service in .env (EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD)");
    console.log("2. Configure SMS service (optional - Twilio credentials)");
    console.log("3. Configure WhatsApp service (optional - Twilio credentials)");
    console.log("4. Test notification services via API");
    console.log("5. Start using notifications in your application!\n");

  } catch (error) {
    console.error("❌ Initialization Error:", error);
  }
};

// Run initialization
connectDB()
  .then(initializeTemplates)
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });


