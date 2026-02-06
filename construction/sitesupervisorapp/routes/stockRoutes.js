const express = require('express');
const router = express.Router();
const stockController = require('../controllers/StockController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.post('/add', protect, stockController.addStockItem);
router.get('/list', protect, stockController.getStockList);
router.get('/stats', protect, stockController.getStockStats);
router.get('/transactions', protect, stockController.getTransactions);
router.get('/:id', protect, stockController.getStockById);
router.put('/:id', protect, stockController.updateStockItem);
router.delete('/:id', protect, stockController.deleteStockItem);

// Stock movements
router.post('/inward', protect, stockController.stockInward);
router.post('/outward', protect, stockController.stockOutward);

// Admin route (public for now - add admin middleware later)
router.get('/admin/all', stockController.getAllStock);

module.exports = router;
