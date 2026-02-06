const mongoose = require('mongoose');

const siteProgressSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  workType: {
    type: String,
    required: true,
    // Removed enum to allow custom work types when "Other" is selected
  },
  images: [{
    type: String  // Store image URLs/paths
  }],
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  siteName: {
    type: String,
    required: false  // Optional for backward compatibility
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SiteSupervisorAuth',
    required: true
  },
  supervisorName: {
    type: String,
    required: false  // Optional for backward compatibility
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'submitted'
  },
  adminRemarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
siteProgressSchema.index({ siteId: 1, date: -1 });
siteProgressSchema.index({ supervisorId: 1, date: -1 });

// Check if model already exists to prevent OverwriteModelError
const SiteProgress = mongoose.models.SiteProgress || mongoose.model('SiteProgress', siteProgressSchema);

module.exports = SiteProgress;
