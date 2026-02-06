const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivities,
  getTodaySummary
} = require('../controllers/DashboardController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Dashboard routes
router.get('/stats', getDashboardStats);
router.get('/activities', getRecentActivities);
router.get('/today', getTodaySummary);

module.exports = router;
