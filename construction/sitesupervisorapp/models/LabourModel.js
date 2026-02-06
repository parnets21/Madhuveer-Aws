const mongoose = require('mongoose');

const labourSchema = new mongoose.Schema({
  // Labour ID (auto-generated)
  labourId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
  },
  photo: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  aadharNumber: {
    type: String,
    trim: true,
    default: null,
  },
  address: {
    type: String,
    trim: true,
    default: null,
  },
  
  // Work Details
  trade: {
    type: String,
    required: true,
    // Removed enum to allow custom trades when "Other" is selected
  },
  skillLevel: {
    type: String,
    enum: ['Unskilled', 'Semi-Skilled', 'Skilled', 'Highly Skilled'],
    default: 'Unskilled',
  },
  dailyWage: {
    type: Number,
    required: true,
    min: 0,
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
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'left'],
    default: 'active',
  },
  joiningDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  leavingDate: {
    type: Date,
    default: null,
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
  
  // Statistics (updated periodically)
  totalDaysWorked: {
    type: Number,
    default: 0,
  },
  totalPaymentReceived: {
    type: Number,
    default: 0,
  },
  pendingPayment: {
    type: Number,
    default: 0,
  },
  advanceGiven: {
    type: Number,
    default: 0,
  },
  
  // Additional Info
  remarks: {
    type: String,
    default: null,
  },
  
}, {
  timestamps: true,
});

// Indexes for better query performance
labourSchema.index({ supervisorId: 1, status: 1 });
labourSchema.index({ siteId: 1, status: 1 });
labourSchema.index({ labourId: 1 });
labourSchema.index({ phone: 1 });

// Generate Labour ID
labourSchema.statics.generateLabourId = async function() {
  const count = await this.countDocuments();
  return `LAB-${String(count + 1).padStart(4, '0')}`;
};

// Get active labourers for a supervisor
labourSchema.statics.getActiveBySupervisor = function(supervisorId) {
  return this.find({ 
    supervisorId, 
    status: 'active' 
  }).sort({ name: 1 });
};

// Get labourers by site
labourSchema.statics.getBySite = function(siteId, status = null) {
  const query = { siteId };
  if (status) query.status = status;
  return this.find(query).sort({ name: 1 });
};

// Update statistics
labourSchema.methods.updateStats = async function(stats) {
  if (stats.daysWorked !== undefined) {
    this.totalDaysWorked += stats.daysWorked;
  }
  if (stats.payment !== undefined) {
    this.totalPaymentReceived += stats.payment;
  }
  if (stats.pending !== undefined) {
    this.pendingPayment = stats.pending;
  }
  if (stats.advance !== undefined) {
    this.advanceGiven += stats.advance;
  }
  return this.save();
};

// Check if model already exists to prevent OverwriteModelError
const Labour = mongoose.models.Labour || mongoose.model('Labour', labourSchema);

module.exports = Labour;
