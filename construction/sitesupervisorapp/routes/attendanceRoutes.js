const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  checkIn,
  checkOut,
  getTodayStatus,
  getHistory,
  getStats,
  getAllAttendance
} = require('../controllers/AttendanceController');
const { protect } = require('../middleware/authMiddleware');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../../uploads/attendance');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for selfie upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'selfie-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Public routes (for web admin)
router.get('/all', getAllAttendance);

// Protected routes (require authentication)
// Selfie is now optional - upload.single('selfie') will handle it if provided
router.post('/check-in', protect, upload.single('selfie'), checkIn);
router.put('/check-out', protect, checkOut);
router.get('/today', protect, getTodayStatus);
router.get('/history', protect, getHistory);
router.get('/stats', protect, getStats);

module.exports = router;
