const Budget = require('../models/BudgetModel');
const Expense = require('../models/ExpenseModel');

// Allocate budget to supervisor
exports.allocateBudget = async (req, res) => {
  try {
    const { supervisorId, supervisorName, siteId, siteName, allocatedAmount, month, year, remarks } = req.body;
    
    if (!supervisorId || !allocatedAmount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }
    
    // Check if budget already exists for this period
    const existingBudget = await Budget.findOne({
      supervisorId,
      month,
      year,
    });
    
    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: 'Budget already allocated for this period',
      });
    }
    
    const budgetId = await Budget.generateBudgetId();
    
    const budget = await Budget.create({
      budgetId,
      supervisorId,
      supervisorName,
      siteId,
      siteName,
      allocatedAmount,
      remainingAmount: allocatedAmount,
      month,
      year,
      allocatedBy: req.user?.name || 'Admin',
      remarks,
    });
    
    res.status(201).json({
      success: true,
      message: 'Budget allocated successfully',
      data: budget,
    });
    
  } catch (error) {
    console.error('Allocate budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to allocate budget',
      error: error.message,
    });
  }
};

// Get supervisor's current budget
exports.getCurrentBudget = async (req, res) => {
  try {
    console.log('=== GET CURRENT BUDGET ===');
    console.log('req.user:', JSON.stringify(req.user, null, 2));
    console.log('Looking for employeeId:', req.user.employeeId);
    
    const now = new Date();
    console.log(`Current date: ${now.getMonth() + 1}/${now.getFullYear()}`);
    
    let budget = await Budget.getCurrentBudget(req.user.employeeId);
    console.log('Budget from getCurrentBudget:', budget ? budget.budgetId : 'null');
    
    // If no budget for current month, try to get the latest active budget
    if (!budget) {
      console.log('No budget for current month, checking for latest budget...');
      budget = await Budget.findOne({
        supervisorId: req.user.employeeId,
        status: 'active',
      }).sort({ year: -1, month: -1 });
      
      if (budget) {
        console.log(`✅ Found budget: ${budget.budgetId} for ${budget.month}/${budget.year}`);
      } else {
        console.log('❌ No budget found at all');
        // Check if any budgets exist for this supervisor
        const allBudgets = await Budget.find({ supervisorId: req.user.employeeId });
        console.log(`Total budgets for this supervisor: ${allBudgets.length}`);
        if (allBudgets.length > 0) {
          console.log('Budgets:', allBudgets.map(b => `${b.budgetId} (${b.month}/${b.year}, ${b.status})`));
        }
      }
    }
    
    if (!budget) {
      return res.json({
        success: true,
        data: null,
        message: 'No budget allocated',
      });
    }
    
    console.log('✅ Returning budget:', budget.budgetId);
    res.json({
      success: true,
      data: budget,
    });
    
  } catch (error) {
    console.error('Get current budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error.message,
    });
  }
};

// Get budget history
exports.getBudgetHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const budgets = await Budget.find({ supervisorId: req.user.employeeId })
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Budget.countDocuments({ supervisorId: req.user.employeeId });
    
    res.json({
      success: true,
      data: budgets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get budget history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget history',
      error: error.message,
    });
  }
};

// Get all budgets (admin)
exports.getAllBudgets = async (req, res) => {
  try {
    const { supervisorId, siteId, month, year, status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (supervisorId) query.supervisorId = supervisorId;
    if (siteId) query.siteId = siteId;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const budgets = await Budget.find(query)
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Budget.countDocuments(query);
    
    res.json({
      success: true,
      data: budgets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get all budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets',
      error: error.message,
    });
  }
};

// Update budget
exports.updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { allocatedAmount, remarks, status } = req.body;
    
    const budget = await Budget.findById(id);
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found',
      });
    }
    
    if (allocatedAmount !== undefined) {
      budget.allocatedAmount = allocatedAmount;
      budget.updateRemainingAmount();
    }
    
    if (remarks !== undefined) budget.remarks = remarks;
    if (status !== undefined) budget.status = status;
    
    await budget.save();
    
    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: budget,
    });
    
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget',
      error: error.message,
    });
  }
};

// Get budget statistics (admin)
exports.getBudgetStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();
    
    const budgets = await Budget.find({
      month: targetMonth,
      year: targetYear,
    });
    
    const stats = {
      totalBudgets: budgets.length,
      totalAllocated: budgets.reduce((sum, b) => sum + b.allocatedAmount, 0),
      totalUsed: budgets.reduce((sum, b) => sum + b.usedAmount, 0),
      totalRemaining: budgets.reduce((sum, b) => sum + b.remainingAmount, 0),
      byStatus: {
        active: budgets.filter(b => b.status === 'active').length,
        exhausted: budgets.filter(b => b.status === 'exhausted').length,
        expired: budgets.filter(b => b.status === 'expired').length,
      },
    };
    
    res.json({
      success: true,
      data: stats,
    });
    
  } catch (error) {
    console.error('Get budget stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget statistics',
      error: error.message,
    });
  }
};

// Get list of supervisors for budget allocation
exports.getSupervisorsList = async (req, res) => {
  try {
    const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');
    
    const supervisors = await SiteSupervisorAuth.find({ status: 'active' })
      .select('employeeId employeeName phone email mobileAppRole designation')
      .sort({ employeeName: 1 });
    
    // Transform data to include name field for consistency
    const transformedSupervisors = supervisors.map(sup => ({
      employeeId: sup.employeeId,
      name: sup.employeeName,
      employeeName: sup.employeeName,
      phone: sup.phone,
      email: sup.email,
      role: sup.mobileAppRole,
      designation: sup.designation,
      // Default site info - can be enhanced later
      siteId: 'SITE-001',
      siteName: 'Default Site',
    }));
    
    res.json({
      success: true,
      data: transformedSupervisors,
      count: transformedSupervisors.length,
    });
    
  } catch (error) {
    console.error('Get supervisors list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supervisors list',
      error: error.message,
    });
  }
};

module.exports = exports;
