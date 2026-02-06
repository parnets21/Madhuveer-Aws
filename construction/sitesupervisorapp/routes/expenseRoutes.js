const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const expenseController = require('../controllers/ExpenseController');
const { protect } = require('../middleware/authMiddleware');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../../uploads/expenses');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'expense-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
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

// Protected routes (require authentication)
router.post('/add', protect, upload.array('images', 5), expenseController.addExpense);
router.get('/list', protect, expenseController.getExpenseList);
router.get('/stats', protect, expenseController.getExpenseStats);
router.get('/:id', protect, expenseController.getExpenseById);
router.put('/:id', protect, expenseController.updateExpense);
router.delete('/:id', protect, expenseController.deleteExpense);

// Admin routes
router.get('/admin/list', expenseController.getAllExpenses);
router.get('/admin/stats', expenseController.getAdminExpenseStats);
router.put('/admin/:id', expenseController.updateExpenseStatus);

module.exports = router;
