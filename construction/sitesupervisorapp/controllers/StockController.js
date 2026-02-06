const Stock = require('../models/StockModel');
const StockTransaction = require('../models/StockTransactionModel');

// Add new stock item
exports.addStockItem = async (req, res) => {
  try {
    const { itemName, category, unit, currentQuantity, minQuantity, maxQuantity, unitPrice, description, location } = req.body;
    
    // Validate required fields
    if (!itemName || !category || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }
    
    // Generate stock ID
    const stockId = await Stock.generateStockId();
    
    // Create stock item
    const stock = new Stock({
      stockId,
      itemName,
      category,
      unit,
      currentQuantity: currentQuantity || 0,
      minQuantity: minQuantity || 10,
      maxQuantity: maxQuantity || 1000,
      unitPrice: unitPrice || 0,
      siteId: req.user.siteId || 'SITE-001',
      siteName: req.user.siteName || 'Site A',
      supervisorId: req.user.employeeId,
      supervisorName: req.user.name,
      description,
      location,
    });
    
    stock.updateStatus();
    stock.updateTotalValue();
    await stock.save();
    
    res.status(201).json({
      success: true,
      message: 'Stock item added successfully',
      data: stock,
    });
    
  } catch (error) {
    console.error('Add stock item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add stock item',
      error: error.message,
    });
  }
};

// Get stock list
exports.getStockList = async (req, res) => {
  try {
    const { category, status, search } = req.query;
    
    // Build query
    const query = { supervisorId: req.user.employeeId };
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { stockId: { $regex: search, $options: 'i' } },
      ];
    }
    
    const stockItems = await Stock.find(query).sort({ itemName: 1 });
    
    // Calculate statistics
    const stats = {
      total: stockItems.length,
      inStock: stockItems.filter(s => s.status === 'in-stock').length,
      lowStock: stockItems.filter(s => s.status === 'low-stock').length,
      outOfStock: stockItems.filter(s => s.status === 'out-of-stock').length,
      totalValue: stockItems.reduce((sum, s) => sum + s.totalValue, 0),
    };
    
    res.json({
      success: true,
      data: stockItems,
      stats,
    });
    
  } catch (error) {
    console.error('Get stock list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock list',
      error: error.message,
    });
  }
};

// Get single stock item
exports.getStockById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const stock = await Stock.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found',
      });
    }
    
    // Get recent transactions
    const transactions = await StockTransaction.getByStock(stock.stockId, 10);
    
    res.json({
      success: true,
      data: {
        stock,
        transactions,
      },
    });
    
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock details',
      error: error.message,
    });
  }
};

// Update stock item
exports.updateStockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow updating certain fields
    delete updates.stockId;
    delete updates.supervisorId;
    delete updates.supervisorName;
    delete updates.currentQuantity; // Use inward/outward for quantity changes
    
    const stock = await Stock.findOneAndUpdate(
      { _id: id, supervisorId: req.user.employeeId },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found',
      });
    }
    
    stock.updateStatus();
    stock.updateTotalValue();
    await stock.save();
    
    res.json({
      success: true,
      message: 'Stock item updated successfully',
      data: stock,
    });
    
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock item',
      error: error.message,
    });
  }
};

// Delete stock item
exports.deleteStockItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const stock = await Stock.findOneAndDelete({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Stock item deleted successfully',
    });
    
  } catch (error) {
    console.error('Delete stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stock item',
      error: error.message,
    });
  }
};

// Stock inward (receive stock)
exports.stockInward = async (req, res) => {
  try {
    const { stockId, quantity, unitPrice, supplier, billNumber, date, remarks } = req.body;
    
    if (!stockId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid stock ID and quantity',
      });
    }
    
    // Find stock item
    const stock = await Stock.findOne({
      _id: stockId,
      supervisorId: req.user.employeeId,
    });
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found',
      });
    }
    
    // Update unit price if provided
    if (unitPrice) {
      stock.unitPrice = unitPrice;
    }
    
    // Add quantity
    await stock.addQuantity(quantity);
    
    // Create transaction record
    const transactionId = await StockTransaction.generateTransactionId('inward');
    const transaction = await StockTransaction.create({
      transactionId,
      type: 'inward',
      stockId: stock.stockId,
      itemName: stock.itemName,
      quantity,
      unit: stock.unit,
      unitPrice: stock.unitPrice,
      totalAmount: quantity * stock.unitPrice,
      date: date || new Date(),
      supplier,
      billNumber,
      siteId: stock.siteId,
      siteName: stock.siteName,
      supervisorId: req.user.employeeId,
      supervisorName: req.user.name,
      remarks,
      balanceAfter: stock.currentQuantity,
    });
    
    res.json({
      success: true,
      message: 'Stock inward recorded successfully',
      data: {
        stock,
        transaction,
      },
    });
    
  } catch (error) {
    console.error('Stock inward error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record stock inward',
      error: error.message,
    });
  }
};

// Stock outward (issue stock)
exports.stockOutward = async (req, res) => {
  try {
    const { stockId, quantity, issuedTo, purpose, date, remarks } = req.body;
    
    if (!stockId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid stock ID and quantity',
      });
    }
    
    // Find stock item
    const stock = await Stock.findOne({
      _id: stockId,
      supervisorId: req.user.employeeId,
    });
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found',
      });
    }
    
    // Check if sufficient quantity available
    if (stock.currentQuantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stock.currentQuantity} ${stock.unit}`,
      });
    }
    
    // Remove quantity
    await stock.removeQuantity(quantity);
    
    // Create transaction record
    const transactionId = await StockTransaction.generateTransactionId('outward');
    const transaction = await StockTransaction.create({
      transactionId,
      type: 'outward',
      stockId: stock.stockId,
      itemName: stock.itemName,
      quantity,
      unit: stock.unit,
      unitPrice: stock.unitPrice,
      totalAmount: quantity * stock.unitPrice,
      date: date || new Date(),
      issuedTo,
      purpose,
      siteId: stock.siteId,
      siteName: stock.siteName,
      supervisorId: req.user.employeeId,
      supervisorName: req.user.name,
      remarks,
      balanceAfter: stock.currentQuantity,
    });
    
    res.json({
      success: true,
      message: 'Stock outward recorded successfully',
      data: {
        stock,
        transaction,
      },
    });
    
  } catch (error) {
    console.error('Stock outward error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record stock outward',
      error: error.message,
    });
  }
};

// Get stock transactions
exports.getTransactions = async (req, res) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const query = { supervisorId: req.user.employeeId };
    if (type) query.type = type;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const skip = (page - 1) * limit;
    
    const transactions = await StockTransaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await StockTransaction.countDocuments(query);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message,
    });
  }
};

// Get stock statistics
exports.getStockStats = async (req, res) => {
  try {
    const supervisorId = req.user.employeeId;
    
    const stockItems = await Stock.find({ supervisorId });
    
    // Calculate statistics
    const stats = {
      totalItems: stockItems.length,
      inStock: stockItems.filter(s => s.status === 'in-stock').length,
      lowStock: stockItems.filter(s => s.status === 'low-stock').length,
      outOfStock: stockItems.filter(s => s.status === 'out-of-stock').length,
      totalValue: stockItems.reduce((sum, s) => sum + s.totalValue, 0),
      
      // By category
      byCategory: {},
    };
    
    // Calculate category-wise distribution
    stockItems.forEach(stock => {
      if (!stats.byCategory[stock.category]) {
        stats.byCategory[stock.category] = {
          count: 0,
          value: 0,
        };
      }
      stats.byCategory[stock.category].count++;
      stats.byCategory[stock.category].value += stock.totalValue;
    });
    
    // Get recent transactions
    const recentTransactions = await StockTransaction.find({ supervisorId })
      .sort({ date: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: {
        stats,
        recentTransactions,
      },
    });
    
  } catch (error) {
    console.error('Get stock stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock statistics',
      error: error.message,
    });
  }
};

// Get all stock (for admin)
exports.getAllStock = async (req, res) => {
  try {
    const { category, status, siteId, supervisorId, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (siteId) query.siteId = siteId;
    if (supervisorId) query.supervisorId = supervisorId;
    
    const skip = (page - 1) * limit;
    
    const stockItems = await Stock.find(query)
      .sort({ itemName: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Stock.countDocuments(query);
    
    res.json({
      success: true,
      data: stockItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get all stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock data',
      error: error.message,
    });
  }
};
