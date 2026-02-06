const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  // Transaction ID (auto-generated)
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Transaction Type
  type: {
    type: String,
    required: true,
    enum: ['inward', 'outward'],
  },
  
  // Stock Reference
  stockId: {
    type: String,
    required: true,
  },
  itemName: {
    type: String,
    required: true,
  },
  
  // Quantity
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unit: {
    type: String,
    required: true,
  },
  
  // Pricing (for inward)
  unitPrice: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    default: 0,
  },
  
  // Transaction Details
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  
  // For Inward
  supplier: {
    type: String,
    default: null,
  },
  billNumber: {
    type: String,
    default: null,
  },
  
  // For Outward
  issuedTo: {
    type: String,
    default: null,
  },
  purpose: {
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
  
  // Additional Info
  remarks: {
    type: String,
    default: null,
  },
  
  // Balance after transaction
  balanceAfter: {
    type: Number,
    default: 0,
  },
  
}, {
  timestamps: true,
});

// Indexes
stockTransactionSchema.index({ supervisorId: 1, type: 1 });
stockTransactionSchema.index({ stockId: 1, date: -1 });
stockTransactionSchema.index({ transactionId: 1 });
stockTransactionSchema.index({ date: -1 });

// Generate Transaction ID
stockTransactionSchema.statics.generateTransactionId = async function(type) {
  const count = await this.countDocuments({ type });
  const prefix = type === 'inward' ? 'IN' : 'OUT';
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

// Get transactions by stock
stockTransactionSchema.statics.getByStock = function(stockId, limit = 10) {
  return this.find({ stockId })
    .sort({ date: -1 })
    .limit(limit);
};

// Get transactions by date range
stockTransactionSchema.statics.getByDateRange = function(supervisorId, startDate, endDate, type = null) {
  const query = {
    supervisorId,
    date: { $gte: startDate, $lte: endDate },
  };
  if (type) query.type = type;
  
  return this.find(query).sort({ date: -1 });
};

// Check if model already exists to prevent OverwriteModelError
const StockTransaction = mongoose.models.StockTransaction || mongoose.model('StockTransaction', stockTransactionSchema);

module.exports = StockTransaction;
