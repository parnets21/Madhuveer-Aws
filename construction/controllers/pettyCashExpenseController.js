const PettyCashExpense = require("../models/PettyCashExpense");
const SiteBudget = require("../models/SiteBudget");
const mongoose = require("mongoose");

// Generate expense number
const generateExpenseNumber = async () => {
  const prefix = "PCE";
  const year = new Date().getFullYear();
  const count = await PettyCashExpense.countDocuments();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

// Create petty cash expense
exports.createPettyCashExpense = async (req, res) => {
  try {
    const { siteId, category, amount, description, receiptImages, date, submittedBy } = req.body;

    if (!siteId || !category || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const expenseNumber = await generateExpenseNumber();

    const expense = new PettyCashExpense({
      expenseNumber,
      siteId,
      submittedBy: submittedBy || req.user?._id,
      category,
      amount,
      description,
      receiptImages: receiptImages || [],
      date: date || Date.now(),
      status: "Pending",
    });

    await expense.save();

    res.status(201).json({
      success: true,
      message: "Petty cash expense created successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error creating petty cash expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
};

// Get all petty cash expenses
exports.getAllPettyCashExpenses = async (req, res) => {
  try {
    const { siteId, status, submittedBy, startDate, endDate } = req.query;

    let query = {};

    if (siteId) query.siteId = siteId;
    if (status) query.status = status;
    if (submittedBy) query.submittedBy = submittedBy;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const expenses = await PettyCashExpense.find(query)
      .populate("siteId", "siteName siteCode")
      .populate("submittedBy", "name employeeId")
      .populate("approvedBy", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
      error: error.message,
    });
  }
};

// Get single expense
exports.getPettyCashExpenseById = async (req, res) => {
  try {
    const expense = await PettyCashExpense.findById(req.params.id)
      .populate("siteId", "siteName siteCode location")
      .populate("submittedBy", "name employeeId email")
      .populate("approvedBy", "name employeeId");

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
      error: error.message,
    });
  }
};

// Update expense
exports.updatePettyCashExpense = async (req, res) => {
  try {
    const { category, amount, description, receiptImages, date } = req.body;

    const expense = await PettyCashExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot update approved or rejected expense",
      });
    }

    if (category) expense.category = category;
    if (amount) expense.amount = amount;
    if (description) expense.description = description;
    if (receiptImages) expense.receiptImages = receiptImages;
    if (date) expense.date = date;

    await expense.save();

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
};

// Delete expense
exports.deletePettyCashExpense = async (req, res) => {
  try {
    const expense = await PettyCashExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete approved or rejected expense",
      });
    }

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete expense",
      error: error.message,
    });
  }
};

// Approve expense
exports.approvePettyCashExpense = async (req, res) => {
  try {
    const { remarks, approvedBy } = req.body;

    const expense = await PettyCashExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Expense is already processed",
      });
    }

    expense.status = "Approved";
    expense.approvedBy = approvedBy || req.user?._id;
    expense.approvalDate = Date.now();
    if (remarks) expense.remarks = remarks;

    await expense.save();

    // Update site budget
    const budget = await SiteBudget.findOne({
      siteId: expense.siteId,
      isActive: true,
    });

    if (budget) {
      budget.spentAmount += expense.amount;
      await budget.save();
    }

    res.status(200).json({
      success: true,
      message: "Expense approved successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error approving expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve expense",
      error: error.message,
    });
  }
};

// Reject expense
exports.rejectPettyCashExpense = async (req, res) => {
  try {
    const { rejectionReason, approvedBy } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const expense = await PettyCashExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Expense is already processed",
      });
    }

    expense.status = "Rejected";
    expense.approvedBy = approvedBy || req.user?._id;
    expense.approvalDate = Date.now();
    expense.rejectionReason = rejectionReason;

    await expense.save();

    res.status(200).json({
      success: true,
      message: "Expense rejected successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error rejecting expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject expense",
      error: error.message,
    });
  }
};

// Get expense summary
exports.getExpenseSummary = async (req, res) => {
  try {
    const { siteId, startDate, endDate } = req.query;

    let matchQuery = {};
    if (siteId) matchQuery.siteId = mongoose.Types.ObjectId(siteId);
    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const summary = await PettyCashExpense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryWise = await PettyCashExpense.aggregate([
      { $match: { ...matchQuery, status: "Approved" } },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        categoryWise,
      },
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch summary",
      error: error.message,
    });
  }
};
