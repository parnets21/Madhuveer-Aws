const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // Employee/Supervisor Info
  employeeId: {
    type: String,
    required: true,
    ref: 'SiteSupervisorAuth'
  },
  employeeName: {
    type: String,
    required: true
  },
  
  // Date & Time
  date: {
    type: Date,
    required: true,
    index: true
  },
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: {
    type: Date
  },
  
  // Location
  checkInLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Selfie
  selfieUrl: {
    type: String
  },
  
  // Site Info
  siteId: {
    type: String
  },
  siteName: {
    type: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'leave', 'late'],
    default: 'present'
  },
  
  // Work Hours
  totalHours: {
    type: Number,
    default: 0
  },
  
  // Notes
  notes: {
    type: String
  },
  remarks: {
    type: String
  },
  
  // Approval
  isApproved: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  
  // Metadata
  createdAt: {
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

// Indexes for better query performance
attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1 });

// Calculate total hours before saving
attendanceSchema.pre('save', function(next) {
  if (this.checkInTime && this.checkOutTime) {
    const diffMs = this.checkOutTime - this.checkInTime;
    this.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
  }
  next();
});

// Method to check if already checked in today
attendanceSchema.statics.hasCheckedInToday = async function(employeeId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const attendance = await this.findOne({
    employeeId,
    date: { $gte: today, $lt: tomorrow }
  });
  
  return !!attendance;
};

// Method to get today's attendance
attendanceSchema.statics.getTodayAttendance = async function(employeeId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await this.findOne({
    employeeId,
    date: { $gte: today, $lt: tomorrow }
  });
};

// Check if model already exists to prevent OverwriteModelError
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
