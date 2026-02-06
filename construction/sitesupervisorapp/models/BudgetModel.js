const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  // Budget ID
  budgetId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Supervisor Details
  supervisorId: {
    type: String,
    required: true,
  },
  supervisorName: {
    type: String,
    required: true,
  },
  
  // Site Details
  siteId: {
    type: String,
    required: true,
  },
  siteName: {
    type: String,
    required: true,
  },
  
  // Budget Details
  allocatedAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  usedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  remainingAmount: {
    type: Number,
    default: 0,
    // Removed min: 0 to allow tracking overspending scenarios
  },
  
  // Period
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'expired', 'exhausted'],
    default: 'active',
  },
  
  // Allocation Details
  allocatedBy: {
    type: String,
    required: true,
  },
  allocatedAt: {
    type: Date,
    default: Date.now,
  },
  remarks: {
    type: String,
    default: null,
  },
  
}, {
  timestamps: true,
});

// Indexes
budgetSchema.index({ supervisorId: 1, month: 1, year: 1 });
budgetSchema.index({ siteId: 1, month: 1, year: 1 });
budgetSchema.index({ budgetId: 1 });

// Generate Budget ID
budgetSchema.statics.generateBudgetId = async function() {
  const count = await this.countDocuments();
  return `BDG-${String(count + 1).padStart(4, '0')}`;
};

// Update remaining amount
budgetSchema.methods.updateRemainingAmount = function() {
  this.remainingAmount = this.allocatedAmount - this.usedAmount;
  if (this.remainingAmount <= 0) {
    this.status = 'exhausted';
  }
};

// Check if budget is available
budgetSchema.methods.hasAvailableBudget = function(amount) {
  return this.remainingAmount >= amount && this.status === 'active';
};

// Get current month budget for supervisor
budgetSchema.statics.getCurrentBudget = async function(supervisorId) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  return this.findOne({
    supervisorId,
    month,
    year,
    status: 'active',
  });
};

const Budget = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);

module.exports = Budget;
