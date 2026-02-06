const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const labourController = require('../controllers/LabourController');
const { protect } = require('../middleware/authMiddleware');

// Configure multer for labour photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/labour/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'labour-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  }
});

// Protected routes (require authentication)
router.post('/register', protect, upload.single('photo'), labourController.registerLabour);
router.get('/list', protect, labourController.getLabourList);
router.get('/stats', protect, labourController.getLabourStats);
router.get('/:id', protect, labourController.getLabourById);
router.put('/:id', protect, upload.single('photo'), labourController.updateLabour);
router.delete('/:id', protect, labourController.deleteLabour);
router.post('/:id/payment', protect, labourController.recordPayment);

// Admin route (public for now - add admin middleware later)
router.get('/admin/all', labourController.getAllLabour);

module.exports = router;
