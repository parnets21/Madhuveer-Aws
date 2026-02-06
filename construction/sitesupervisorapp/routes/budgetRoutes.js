const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/BudgetController');
const { protect } = require('../middleware/authMiddleware');

// Supervisor routes (protected)
router.get('/current', protect, budgetController.getCurrentBudget);
router.get('/history', protect, budgetController.getBudgetHistory);

// Admin routes
router.post('/allocate', budgetController.allocateBudget);
router.get('/admin/list', budgetController.getAllBudgets);
router.get('/admin/stats', budgetController.getBudgetStats);
router.get('/admin/supervisors', budgetController.getSupervisorsList);
router.put('/admin/:id', budgetController.updateBudget);

module.exports = router;
