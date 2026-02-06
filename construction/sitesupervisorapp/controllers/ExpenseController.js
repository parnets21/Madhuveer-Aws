const Expense = require('../models/ExpenseModel');
const Budget = require('../models/BudgetModel');

// Add new expense
exports.addExpense = async (req, res) => {
  const session = await Expense.startSession();
  session.startTransaction();
  
  try {
    const { category, amount, description, date, paymentMode, billNumber, receipt, remarks } = req.body;
    
    if (!category || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
        data: { category, amount, description }
      });
    }
    
    // Handle uploaded images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => `/uploads/expenses/${file.filename}`);
    }
    
    // Check budget availability (budget contains supervisor and site info)
    const budget = await Budget.getCurrentBudget(req.user.employeeId);
    
    if (!budget) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No budget allocated for current month. Please contact admin.',
      });
    }
    
    if (!budget.hasAvailableBudget(amount)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient budget. Available: ₹${budget.remainingAmount}`,
      });
    }
    
    // Generate expense ID
    const lastExpense = await Expense.findOne().sort({ expenseId: -1 });
    let expenseId = 'EXP-0001';
    if (lastExpense && lastExpense.expenseId) {
      const lastNumber = parseInt(lastExpense.expenseId.split('-')[1]);
      expenseId = `EXP-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    
    console.log('=== CREATING EXPENSE (WITH TRANSACTION) ===');
    console.log('Expense ID:', expenseId);
    console.log('Category:', category);
    console.log('Amount:', amount);
    console.log('Supervisor:', budget.supervisorName, budget.supervisorId);
    
    // Create expense within transaction
    const expense = await Expense.create([{
      expenseId,
      category,
      amount,
      description,
      date: date || new Date(),
      paymentMode: paymentMode || 'Cash',
      billNumber,
      receipt,
      siteId: budget.siteId,
      siteName: budget.siteName,
      supervisorId: budget.supervisorId,
      supervisorName: budget.supervisorName,
      remarks,
      images: imageUrls,
    }], { session });
    
    console.log('✅ Expense created:', expense[0]._id);
    
    // Update budget used amount within transaction
    budget.usedAmount += amount;
    budget.updateRemainingAmount();
    await budget.save({ session });
    
    console.log('✅ Budget updated. Used:', budget.usedAmount, 'Remaining:', budget.remainingAmount);
    
    // Commit transaction
    await session.commitTransaction();
    console.log('✅ Transaction committed successfully');
    
    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: expense[0],
      budget: {
        remaining: budget.remainingAmount,
        allocated: budget.allocatedAmount,
      },
    });
    
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    console.error('Add expense error:', error);
    console.error('❌ Transaction rolled back');
    
    res.status(500).json({
      success: false,
      message: 'Failed to add expense',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get expense list
exports.getExpenseList = async (req, res) => {
  try {
    const { category, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const query = { supervisorId: req.user.employeeId };
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const skip = (page - 1) * limit;
    
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Expense.countDocuments(query);
    
    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get expense list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense list',
      error: error.message,
    });
  }
};

// Get single expense
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await Expense.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }
    
    res.json({
      success: true,
      data: expense,
    });
    
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message,
    });
  }
};

// Update expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if expense exists and is editable
    const expense = await Expense.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }
    
    // Prevent editing approved/rejected expenses
    if (expense.status !== 'pending') {
      return res.status(403).json({
        success: false,
        message: `Cannot edit ${expense.status} expense`,
      });
    }
    
    delete updates.expenseId;
    delete updates.supervisorId;
    delete updates.supervisorName;
    delete updates.status;
    
    // If amount is being updated, check budget
    if (updates.amount && updates.amount !== expense.amount) {
      const budget = await Budget.getCurrentBudget(req.user.employeeId);
      const amountDiff = updates.amount - expense.amount;
      
      if (amountDiff > 0 && !budget.hasAvailableBudget(amountDiff)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient budget. Available: ₹${budget.remainingAmount}`,
        });
      }
      
      // Update budget
      budget.usedAmount += amountDiff;
      budget.updateRemainingAmount();
      await budget.save();
    }
    
    Object.assign(expense, updates);
    await expense.save();
    
    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense,
    });
    
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message,
    });
  }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await Expense.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }
    
    // Prevent deleting approved/rejected expenses
    if (expense.status !== 'pending') {
      return res.status(403).json({
        success: false,
        message: `Cannot delete ${expense.status} expense`,
      });
    }
    
    // Refund budget
    const budget = await Budget.getCurrentBudget(req.user.employeeId);
    if (budget) {
      budget.usedAmount -= expense.amount;
      budget.updateRemainingAmount();
      await budget.save();
    }
    
    await expense.deleteOne();
    
    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
    
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message,
    });
  }
};

// Get expense statistics
exports.getExpenseStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const stats = await Expense.getMonthlyStats(
      req.user.employeeId,
      targetYear,
      targetMonth
    );
    
    res.json({
      success: true,
      data: stats,
    });
    
  } catch (error) {
    console.error('Get expense stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics',
      error: error.message,
    });
  }
};

// Get all expenses (for admin)
exports.getAllExpenses = async (req, res) => {
  try {
    const { category, status, siteId, supervisorId, supervisorName, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (siteId) query.siteId = siteId;
    if (supervisorId) query.supervisorId = supervisorId;
    if (supervisorName) query.supervisorName = supervisorName;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const skip = (page - 1) * limit;
    
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Expense.countDocuments(query);
    
    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get all expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message,
    });
  }
};


// Get admin expense statistics
exports.getAdminExpenseStats = async (req, res) => {
  try {
    const { month, year, siteId } = req.query;
    
    const query = {};
    if (siteId) query.siteId = siteId;
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    // Get total statistics
    const totalExpenses = await Expense.countDocuments(query);
    const totalAmount = await Expense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    
    // Get statistics by status
    const pendingQuery = { ...query, status: 'pending' };
    const approvedQuery = { ...query, status: 'approved' };
    const rejectedQuery = { ...query, status: 'rejected' };
    
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Expense.countDocuments(pendingQuery),
      Expense.countDocuments(approvedQuery),
      Expense.countDocuments(rejectedQuery),
    ]);
    
    const [pendingAmount, approvedAmount, rejectedAmount] = await Promise.all([
      Expense.aggregate([
        { $match: pendingQuery },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: approvedQuery },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: rejectedQuery },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    
    res.json({
      success: true,
      data: {
        totalCount: totalExpenses,
        totalAmount: totalAmount[0]?.total || 0,
        pendingCount,
        pendingAmount: pendingAmount[0]?.total || 0,
        approvedCount,
        approvedAmount: approvedAmount[0]?.total || 0,
        rejectedCount,
        rejectedAmount: rejectedAmount[0]?.total || 0,
      },
    });
    
  } catch (error) {
    console.error('Get admin expense stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics',
      error: error.message,
    });
  }
};

// Update expense status (admin approve/reject)
exports.updateExpenseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminRemarks } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected',
      });
    }
    
    const expense = await Expense.findById(id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }
    
    expense.status = status;
    if (adminRemarks) {
      expense.adminRemarks = adminRemarks;
    }
    expense.updatedAt = Date.now();
    
    await expense.save();
    
    res.json({
      success: true,
      message: `Expense ${status} successfully`,
      data: expense,
    });
    
  } catch (error) {
    console.error('Update expense status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense status',
      error: error.message,
    });
  }
};
