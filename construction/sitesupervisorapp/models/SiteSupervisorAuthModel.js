const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const siteSupervisorAuthSchema = new mongoose.Schema({
  // Employee Reference
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  employeeName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Login Credentials
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Role & Access
  mobileAppRole: {
    type: String,
    required: true,
    enum: ['Site Supervisor', 'Project Manager', 'Employee', 'Admin'],
    default: 'Site Supervisor'
  },
  designation: {
    type: String,
    default: 'Site Supervisor'
  },
  department: {
    type: String,
    default: 'Site Management'
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Assigned Sites
  assignedSites: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site'
    },
    siteName: String,
    siteCode: String
  }],
  
  // Login Tracking
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Device Info (optional)
  deviceInfo: {
    deviceId: String,
    deviceName: String,
    platform: String,
    appVersion: String
  },
  
  // FCM Token for push notifications
  fcmToken: {
    type: String
  },
  
  // Timestamps
  registeredAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for account lock status
siteSupervisorAuthSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
siteSupervisorAuthSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
siteSupervisorAuthSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to increment login attempts
siteSupervisorAuthSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise increment
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
siteSupervisorAuthSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Indexes
siteSupervisorAuthSchema.index({ phone: 1 });
siteSupervisorAuthSchema.index({ employeeId: 1 });
siteSupervisorAuthSchema.index({ status: 1 });

// Check if model already exists to prevent OverwriteModelError
const SiteSupervisorAuth = mongoose.models.SiteSupervisorAuth || mongoose.model('SiteSupervisorAuth', siteSupervisorAuthSchema);

module.exports = SiteSupervisorAuth;
