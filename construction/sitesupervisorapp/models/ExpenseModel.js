const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Expense ID (auto-generated)
  expenseId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Expense Details
  category: {
    type: String,
    required: true,
    trim: true,
    // Removed enum to allow custom categories
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  
  // Payment Details
  paymentMode: {
    type: String,
    required: true,
    enum: ['Cash', 'Bank', 'UPI', 'Cheque', 'Other'],
    default: 'Cash',
  },
  billNumber: {
    type: String,
    trim: true,
    default: null,
  },
  receipt: {
    type: String,
    default: null,
  },
  
  // Site & Supervisor
  siteId: {
    type: String,
    required: true,
  },
  siteName: {
    type: String,
    required: true,
  },
  supervisorId: {
    type: String,
    required: true,
  },
  supervisorName: {
    type: String,
    required: true,
  },
  
  // Status & Approval
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedBy: {
    type: String,
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  remarks: {
    type: String,
    default: null,
  },
  adminRemarks: {
    type: String,
    default: null,
  },
  
  // Images (optional)
  images: {
    type: [String],
    default: [],
  },
  
}, {
  timestamps: true,
});

// Indexes for better query performance
expenseSchema.index({ supervisorId: 1, date: -1 });
expenseSchema.index({ siteId: 1, date: -1 });
expenseSchema.index({ expenseId: 1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ status: 1 });

// Generate Expense ID
expenseSchema.statics.generateExpenseId = async function() {
  const count = await this.countDocuments();
  return `EXP-${String(count + 1).padStart(4, '0')}`;
};

// Get expenses by date range
expenseSchema.statics.getByDateRange = function(supervisorId, startDate, endDate) {
  return this.find({
    supervisorId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: -1 });
};

// Get expenses by category
expenseSchema.statics.getByCategory = function(supervisorId, category) {
  return this.find({ supervisorId, category }).sort({ date: -1 });
};

// Get monthly statistics
expenseSchema.statics.getMonthlyStats = async function(supervisorId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const expenses = await this.find({
    supervisorId,
    date: { $gte: startDate, $lte: endDate },
  });
  
  const stats = {
    totalExpenses: expenses.length,
    totalAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    byCategory: {},
    byStatus: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
  };
  
  expenses.forEach(expense => {
    // By category
    if (!stats.byCategory[expense.category]) {
      stats.byCategory[expense.category] = {
        count: 0,
        amount: 0,
      };
    }
    stats.byCategory[expense.category].count++;
    stats.byCategory[expense.category].amount += expense.amount;
    
    // By status
    stats.byStatus[expense.status]++;
  });
  
  return stats;
};

// Use a unique model name to avoid conflicts with Restaurant ExpenseModel
const modelName = 'ConstructionExpense';

// Check if model already exists to prevent OverwriteModelError
let Expense;
try {
  Expense = mongoose.model(modelName);
} catch (error) {
  Expense = mongoose.model(modelName, expenseSchema);
}

module.exports = Expense;
