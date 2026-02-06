const MajorExpense = require("../../model/MajorExpense");
const SiteBudget = require("../models/SiteBudget");
const mongoose = require("mongoose");

// Generate expense number
const generateExpenseNumber = async () => {
  const prefix = "MAJ";
  const year = new Date().getFullYear();
  const count = await MajorExpense.countDocuments();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

// Create major expense
exports.createMajorExpense = async (req, res) => {
  try {
    const {
      siteId,
      type,
      amount,
      description,
      vendor,
      billNumber,
      billDate,
      paymentMethod,
      receiptImages,
      createdBy,
    } = req.body;

    if (!siteId || !type || !amount || !description || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const expenseNumber = await generateExpenseNumber();

    const expense = new MajorExpense({
      expenseNumber,
      siteId,
      type,
      amount,
      description,
      vendor,
      billNumber,
      billDate,
      paymentMethod,
      receiptImages: receiptImages || [],
      createdBy: createdBy || req.user?._id,
      status: "Pending",
      paymentStatus: "Pending",
    });

    await expense.save();

    res.status(201).json({
      success: true,
      message: "Major expense created successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error creating major expense:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
};

// Get all major expenses
exports.getAllMajorExpenses = async (req, res) => {
  try {
    const { siteId, status, type, startDate, endDate } = req.query;

    let query = {};

    if (siteId) query.siteId = siteId;
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const expenses = await MajorExpense.find(query)
      .populate("siteId", "siteName siteCode")
      .populate("createdBy", "name employeeId")
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
exports.getMajorExpenseById = async (req, res) => {
  try {
    const expense = await MajorExpense.findById(req.params.id)
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId email")
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
exports.updateMajorExpense = async (req, res) => {
  try {
    const expense = await MajorExpense.findById(req.params.id);

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

    const allowedUpdates = [
      "type",
      "amount",
      "description",
      "vendor",
      "billNumber",
      "billDate",
      "paymentMethod",
      "receiptImages",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    });

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
exports.deleteMajorExpense = async (req, res) => {
  try {
    const expense = await MajorExpense.findById(req.params.id);

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
exports.approveMajorExpense = async (req, res) => {
  try {
    const { approvedBy } = req.body;

    const expense = await MajorExpense.findById(req.params.id);

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
exports.rejectMajorExpense = async (req, res) => {
  try {
    const { rejectionReason, approvedBy } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const expense = await MajorExpense.findById(req.params.id);

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

// Record payment
exports.recordPayment = async (req, res) => {
  try {
    const { paidAmount, paymentDate, bankDetails } = req.body;

    const expense = await MajorExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Expense must be approved before recording payment",
      });
    }

    expense.paidAmount = (expense.paidAmount || 0) + paidAmount;
    expense.paymentDate = paymentDate || Date.now();

    if (expense.paidAmount >= expense.amount) {
      expense.paymentStatus = "Paid";
      expense.status = "Paid";
    } else {
      expense.paymentStatus = "Partially Paid";
    }

    if (bankDetails) {
      expense.bankDetails = bankDetails;
    }

    await expense.save();

    res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record payment",
      error: error.message,
    });
  }
};

// Get expense summary
exports.getMajorExpenseSummary = async (req, res) => {
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

    const summary = await MajorExpense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const typeWise = await MajorExpense.aggregate([
      { $match: { ...matchQuery, status: { $in: ["Approved", "Paid"] } } },
      {
        $group: {
          _id: "$type",
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
        typeWise,
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
