const Attendance = require('../models/AttendanceModel');
const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');

// @desc    Mark attendance (Check In)
// @route   POST /api/v1/site-supervisor-app/attendance/check-in
// @access  Private
exports.checkIn = async (req, res) => {
  try {
    const user = req.userDoc;
    let { location, siteId, siteName, notes } = req.body;

    // Parse location if it's a string
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch (e) {
        console.error('Failed to parse location:', e);
      }
    }

    // Check if already checked in today
    const hasCheckedIn = await Attendance.hasCheckedInToday(user.employeeId);
    
    if (hasCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today'
      });
    }

    // Handle selfie upload
    let selfieUrl = null;
    if (req.file) {
      // If using multer, the file path will be in req.file
      selfieUrl = `/uploads/attendance/${req.file.filename}`;
    }

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId: user.employeeId,
      employeeName: user.employeeName,
      date: new Date(),
      checkInTime: new Date(),
      checkInLocation: location,
      selfieUrl,
      siteId: siteId || user.siteId || 'SITE-001',
      siteName: siteName || user.siteName || 'Site A',
      notes,
      status: 'present'
    });

    res.status(201).json({
      success: true,
      message: 'Checked in successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in',
      error: error.message
    });
  }
};

// @desc    Check Out
// @route   PUT /api/v1/site-supervisor-app/attendance/check-out
// @access  Private
exports.checkOut = async (req, res) => {
  try {
    const employeeId = req.userDoc.employeeId;
    const { location, notes } = req.body;

    // Get today's attendance
    const attendance = await Attendance.getTodayAttendance(employeeId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }

    // Update attendance with check out info
    attendance.checkOutTime = new Date();
    attendance.checkOutLocation = location;
    if (notes) attendance.remarks = notes;
    
    await attendance.save(); // This will trigger pre-save hook to calculate hours

    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check out',
      error: error.message
    });
  }
};

// @desc    Get today's attendance status
// @route   GET /api/v1/site-supervisor-app/attendance/today
// @access  Private
exports.getTodayStatus = async (req, res) => {
  try {
    const employeeId = req.userDoc.employeeId;
    
    const attendance = await Attendance.getTodayAttendance(employeeId);
    
    res.status(200).json({
      success: true,
      data: attendance || null
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today status',
      error: error.message
    });
  }
};

// @desc    Get attendance history
// @route   GET /api/v1/site-supervisor-app/attendance/history
// @access  Private
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate, month, year, limit = 30, page = 1 } = req.query;

    const query = { employeeId: req.userDoc.employeeId };

    // Month/Year filter (for current month view)
    if (month && year) {
      const targetMonth = parseInt(month) - 1;
      const targetYear = parseInt(year);
      const monthStart = new Date(targetYear, targetMonth, 1);
      const monthEnd = new Date(targetYear, targetMonth + 1, 0);
      query.date = { $gte: monthStart, $lte: monthEnd };
    }
    // Date range filter
    else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Attendance.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance history',
      error: error.message
    });
  }
};

// @desc    Get attendance statistics
// @route   GET /api/v1/site-supervisor-app/attendance/stats
// @access  Private
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const attendance = await Attendance.find({
      employeeId: req.userDoc.employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const stats = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      halfDay: attendance.filter(a => a.status === 'half-day').length,
      leave: attendance.filter(a => a.status === 'leave').length,
      late: attendance.filter(a => a.status === 'late').length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      averageHours: attendance.length > 0 
        ? (attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0) / attendance.length).toFixed(2)
        : 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance statistics',
      error: error.message
    });
  }
};

// @desc    Get all attendance records (Admin)
// @route   GET /api/v1/site-supervisor-app/attendance/all
// @access  Public (for web admin)
exports.getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, employeeName, status, limit = 50, page = 1 } = req.query;

    const query = {};

    if (employeeId) query.employeeId = employeeId;
    if (employeeName) query.employeeName = employeeName;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Attendance.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message
    });
  }
};
