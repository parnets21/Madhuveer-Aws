const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/SiteProgressController');
const { protect } = require('../middleware/authMiddleware');

// Admin Routes (must come before /:id routes)
router.get('/admin/list', getAdminProgressList);
router.get('/admin/stats', getAdminProgressStats);
router.put('/admin/:id', addAdminRemarks);

// Site Supervisor Routes
router.post('/add', protect, upload.array('images', 10), addSiteProgress);
router.get('/list', protect, getProgressList);
router.get('/stats', protect, getProgressStats);
router.get('/:id', protect, getProgressById);
router.put('/:id', protect, upload.array('images', 10), updateProgress);
router.delete('/:id', protect, deleteProgress);

module.exports = router;
