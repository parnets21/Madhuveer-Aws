// Dashboard Controller for Site Supervisor App
// Provides real-time statistics and summaries

const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');

// @desc    Get dashboard statistics
// @route   GET /api/v1/site-supervisor-app/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await SiteSupervisorAuth.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // TODO: Replace with actual data from respective models
    // For now, returning mock data structure
    const stats = {
      attendance: {
        present: 0,
        absent: 0,
        total: 0,
        percentage: 0
      },
      labour: {
        total: 0,
        active: 0,
        onLeave: 0
      },
      stock: {
        totalItems: 0,
        lowStock: 0,
        outOfStock: 0
      },
      expenses: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        pending: 0
      },
      allowances: {
        pending: 0,
        approved: 0,
        total: 0
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/v1/site-supervisor-app/dashboard/activities
// @access  Private
exports.getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // TODO: Fetch from actual activity log
    const activities = [];

    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message
    });
  }
};

// @desc    Get today's summary
// @route   GET /api/v1/site-supervisor-app/dashboard/today
// @access  Private
exports.getTodaySummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // TODO: Fetch actual data
    const summary = {
      date: today,
      attendance: {
        marked: false,
        time: null
      },
      labourPresent: 0,
      expensesSubmitted: 0,
      stockMovements: 0,
      tasks: {
        completed: 0,
        pending: 0
      }
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get today summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today summary',
      error: error.message
    });
  }
};
