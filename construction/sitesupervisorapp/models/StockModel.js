const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  // Stock Item ID (auto-generated)
  stockId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Item Information
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Material', 'Equipment', 'Tool', 'Safety', 'Other'],
  },
  unit: {
    type: String,
    required: true,
    enum: ['Kg', 'Ton', 'Bag', 'Piece', 'Box', 'Meter', 'Liter', 'Other'],
  },
  
  // Quantity
  currentQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  minQuantity: {
    type: Number,
    default: 10,
    min: 0,
  },
  maxQuantity: {
    type: Number,
    default: 1000,
  },
  
  // Pricing
  unitPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalValue: {
    type: Number,
    default: 0,
  },
  
  // Site Assignment
  siteId: {
    type: String,
    required: true,
  },
  siteName: {
    type: String,
    required: true,
  },
  
  // Supervisor
  supervisorId: {
    type: String,
    required: true,
  },
  supervisorName: {
    type: String,
    required: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['in-stock', 'low-stock', 'out-of-stock'],
    default: 'in-stock',
  },
  
  // Additional Info
  description: {
    type: String,
    default: null,
  },
  location: {
    type: String,
    default: null,
  },
  
}, {
  timestamps: true,
});

// Indexes for better query performance
stockSchema.index({ supervisorId: 1, status: 1 });
stockSchema.index({ siteId: 1, category: 1 });
stockSchema.index({ stockId: 1 });
stockSchema.index({ itemName: 1 });

// Generate Stock ID
stockSchema.statics.generateStockId = async function() {
  const count = await this.countDocuments();
  return `STK-${String(count + 1).padStart(4, '0')}`;
};

// Update stock status based on quantity
stockSchema.methods.updateStatus = function() {
  if (this.currentQuantity === 0) {
    this.status = 'out-of-stock';
  } else if (this.currentQuantity <= this.minQuantity) {
    this.status = 'low-stock';
  } else {
    this.status = 'in-stock';
  }
  return this;
};

// Update total value
stockSchema.methods.updateTotalValue = function() {
  this.totalValue = this.currentQuantity * this.unitPrice;
  return this;
};

// Add quantity (inward)
stockSchema.methods.addQuantity = function(quantity) {
  this.currentQuantity += quantity;
  this.updateStatus();
  this.updateTotalValue();
  return this.save();
};

// Remove quantity (outward)
stockSchema.methods.removeQuantity = function(quantity) {
  if (this.currentQuantity < quantity) {
    throw new Error('Insufficient stock quantity');
  }
  this.currentQuantity -= quantity;
  this.updateStatus();
  this.updateTotalValue();
  return this.save();
};

// Get low stock items
stockSchema.statics.getLowStockItems = function(supervisorId) {
  return this.find({ 
    supervisorId, 
    status: { $in: ['low-stock', 'out-of-stock'] }
  }).sort({ currentQuantity: 1 });
};

// Get items by category
stockSchema.statics.getByCategory = function(supervisorId, category) {
  return this.find({ supervisorId, category }).sort({ itemName: 1 });
};

// Check if model already exists to prevent OverwriteModelError
const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

module.exports = Stock;
