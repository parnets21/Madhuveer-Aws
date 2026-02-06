const SiteProgress = require('../models/SiteProgressModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/site-progress';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'progress-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Add site progress
const addSiteProgress = async (req, res) => {
  try {
    const { date, title, description, workType, status, siteId: requestSiteId, siteCode } = req.body;
    
    // Get supervisor ID from userDoc (set by auth middleware)
    const supervisorId = req.userDoc?._id;
    
    // Use siteId from request body if provided, otherwise fall back to middleware
    let siteId = requestSiteId || req.user.siteId;
    
    // If siteCode is provided instead of siteId, look up the site
    if (!siteId && siteCode) {
      const Site = require('../../../model/Site');
      const site = await Site.findOne({ siteCode }).select('_id');
      if (site) {
        siteId = site._id;
      }
    }

    // Validation
    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'Supervisor ID not found. Please login again.'
      });
    }

    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: 'No site specified. Please select a site.'
      });
    }
    
    // Verify the supervisor is assigned to this site
    // Check if the user has this site in their assigned sites
    const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');
    const supervisor = await SiteSupervisorAuth.findById(supervisorId);
    
    if (supervisor && supervisor.assignedSites && supervisor.assignedSites.length > 0) {
      const isAssigned = supervisor.assignedSites.some(
        assignedSite => assignedSite.siteId && assignedSite.siteId.toString() === siteId.toString()
      );
      
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to add progress for this site.',
          data: {
            requestedSiteId: siteId,
            assignedSites: supervisor.assignedSites.map(s => s.siteId)
          }
        });
      }
    }

    // Get site and supervisor names
    const Site = require('../../../model/Site');
    const site = await Site.findById(siteId).select('siteName');
    const siteName = site?.siteName || 'Unknown Site';
    const supervisorName = supervisor?.employeeName || req.user?.employeeName || 'Unknown Supervisor';

    // Get uploaded image paths
    const images = req.files ? req.files.map(file => file.path) : [];

    const progress = new SiteProgress({
      date: date || Date.now(),
      title,
      description,
      workType,
      images,
      siteId,
      siteName,
      supervisorId,
      supervisorName,
      status: status || 'submitted'
    });

    await progress.save();

    res.status(201).json({
      success: true,
      message: 'Site progress added successfully',
      data: progress
    });
  } catch (error) {
    console.error('Add site progress error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add site progress'
    });
  }
};

// Get progress list for site supervisor
const getProgressList = async (req, res) => {
  try {
    const supervisorId = req.userDoc?._id;
    const { startDate, endDate, workType, page = 1, limit = 20 } = req.query;

    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'Supervisor ID not found. Please login again.'
      });
    }

    const query = { supervisorId };

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Work type filter
    if (workType) {
      query.workType = workType;
    }

    const skip = (page - 1) * limit;

    const progressList = await SiteProgress.find(query)
      .populate('siteId', 'siteName location')
      .populate('supervisorId', 'employeeName employeeId phone email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SiteProgress.countDocuments(query);

    // Convert image paths to URLs
    const baseUrl = process.env.BASE_URL || 'https://hotelviratbackend-1spr.onrender.com';
    const progressWithUrls = progressList.map(progress => {
      const progressObj = progress.toObject();
      progressObj.images = progressObj.images.map(imagePath => {
        // Convert file path to URL
        return `${baseUrl}/${imagePath.replace(/\\/g, '/')}`;
      });
      return progressObj;
    });

    res.status(200).json({
      success: true,
      data: progressWithUrls,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get progress list error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch progress list'
    });
  }
};

// Get single progress by ID
const getProgressById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('getProgressById called with ID:', id);
    console.log('User from token:', req.user);
    console.log('UserDoc:', req.userDoc);

    const progress = await SiteProgress.findById(id)
      .populate('siteId', 'siteName location')
      .populate('supervisorId', 'employeeName employeeId phone email');

    console.log('Progress found:', !!progress);
    if (progress) {
      console.log('Progress details:', {
        id: progress._id,
        title: progress.title,
        supervisorId: progress.supervisorId?._id
      });
    }

    if (!progress) {
      console.log('Returning 404 - progress not found');
      return res.status(404).json({
        success: false,
        message: 'Progress not found'
      });
    }

    // Convert image paths to URLs
    const baseUrl = process.env.BASE_URL || 'https://hotelviratbackend-1spr.onrender.com';
    const progressObj = progress.toObject();
    progressObj.images = progressObj.images.map(imagePath => {
      return `${baseUrl}/${imagePath.replace(/\\/g, '/')}`;
    });

    res.status(200).json({
      success: true,
      data: progressObj
    });
  } catch (error) {
    console.error('Get progress by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch progress'
    });
  }
};

// Update progress
const updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.user.id;
    const { date, title, description, workType, status } = req.body;

    const progress = await SiteProgress.findOne({
      _id: id,
      supervisorId
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress not found'
      });
    }

    // Update fields
    if (date) progress.date = date;
    if (title) progress.title = title;
    if (description) progress.description = description;
    if (workType) progress.workType = workType;
    if (status) progress.status = status;

    // Handle new images if uploaded
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path);
      progress.images = [...progress.images, ...newImages];
    }

    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: progress
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update progress'
    });
  }
};

// Delete progress
const deleteProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.user.id;

    const progress = await SiteProgress.findOne({
      _id: id,
      supervisorId
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress not found'
      });
    }

    // Delete associated images
    progress.images.forEach(imagePath => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    await SiteProgress.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: 'Progress deleted successfully'
    });
  } catch (error) {
    console.error('Delete progress error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete progress'
    });
  }
};

// Get progress statistics
const getProgressStats = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { month, year } = req.query;

    const query = { supervisorId };

    // Month/Year filter
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const totalProgress = await SiteProgress.countDocuments(query);
    
    const progressByWorkType = await SiteProgress.aggregate([
      { $match: query },
      { $group: { _id: '$workType', count: { $sum: 1 } } }
    ]);

    const totalImages = await SiteProgress.aggregate([
      { $match: query },
      { $project: { imageCount: { $size: '$images' } } },
      { $group: { _id: null, total: { $sum: '$imageCount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProgress,
        progressByWorkType,
        totalImages: totalImages[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get progress stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statistics'
    });
  }
};

// Admin: Get all progress across sites
const getAdminProgressList = async (req, res) => {
  try {
    const { siteId, workType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};

    if (siteId) query.siteId = siteId;
    if (workType) query.workType = workType;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const progressList = await SiteProgress.find(query)
      .populate('siteId', 'siteName location')
      .populate('supervisorId', 'employeeName employeeId phone email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SiteProgress.countDocuments(query);

    // Convert image paths to URLs
    const baseUrl = process.env.BASE_URL || 'https://hotelviratbackend-1spr.onrender.com';
    const progressWithUrls = progressList.map(progress => {
      const progressObj = progress.toObject();
      progressObj.images = progressObj.images.map(imagePath => {
        // Convert file path to URL
        return `${baseUrl}/${imagePath.replace(/\\/g, '/')}`;
      });
      return progressObj;
    });

    res.status(200).json({
      success: true,
      data: progressWithUrls,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get admin progress list error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch progress list'
    });
  }
};

// Admin: Add remarks to progress
const addAdminRemarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;

    const progress = await SiteProgress.findById(id);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress not found'
      });
    }

    progress.adminRemarks = adminRemarks;
    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Remarks added successfully',
      data: progress
    });
  } catch (error) {
    console.error('Add admin remarks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add remarks'
    });
  }
};

// Admin: Get progress statistics
const getAdminProgressStats = async (req, res) => {
  try {
    const { siteId, month, year } = req.query;

    const query = {};
    if (siteId) query.siteId = siteId;

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const totalProgress = await SiteProgress.countDocuments(query);
    
    const progressBySite = await SiteProgress.aggregate([
      { $match: query },
      { $group: { _id: '$siteId', count: { $sum: 1 } } },
      { $lookup: { from: 'sites', localField: '_id', foreignField: '_id', as: 'site' } },
      { $unwind: '$site' },
      { $project: { siteName: '$site.siteName', count: 1 } }
    ]);

    const progressByWorkType = await SiteProgress.aggregate([
      { $match: query },
      { $group: { _id: '$workType', count: { $sum: 1 } } }
    ]);

    const totalImages = await SiteProgress.aggregate([
      { $match: query },
      { $project: { imageCount: { $size: '$images' } } },
      { $group: { _id: null, total: { $sum: '$imageCount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProgress,
        progressBySite,
        progressByWorkType,
        totalImages: totalImages[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get admin progress stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statistics'
    });
  }
};

module.exports = {
  upload,
  addSiteProgress,
  getProgressList,
  getProgressById,
  updateProgress,
  deleteProgress,
  getProgressStats,
  getAdminProgressList,
  addAdminRemarks,
  getAdminProgressStats
};
