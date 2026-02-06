const express = require('express');
const router = express.Router();
const {
  registerSupervisor,
  login,
  getProfile,
  changePassword,
  updateFCMToken,
  getRegisteredSupervisors,
  deleteSupervisor,
  updateSupervisorPassword,
  getAssignedSites
} = require('../controllers/SiteSupervisorAuthController');
const { protect } = require('../middleware/authMiddleware');

// Public routes (no authentication required)
router.post('/register', registerSupervisor);
router.post('/login', login);
router.get('/registered', getRegisteredSupervisors);
router.delete('/registered/:id', deleteSupervisor);
router.put('/registered/:id/password', updateSupervisorPassword);

// Protected routes (authentication required)
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);
router.put('/fcm-token', protect, updateFCMToken);
router.get('/assigned-sites', protect, getAssignedSites);

module.exports = router;
