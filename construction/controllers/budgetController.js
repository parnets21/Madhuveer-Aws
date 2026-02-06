const SiteBudget = require("../models/SiteBudget");
const PettyCashExpense = require("../models/PettyCashExpense");
const MajorExpense = require("../../model/MajorExpense");
const mongoose = require("mongoose");

// Create or update site budget
exports.createOrUpdateBudget = async (req, res) => {
  try {
    const {
      siteId,
      budgetPeriod,
      startDate,
      endDate,
      totalBudget,
      pettyCashBudget,
      majorExpenseBudget,
      createdBy,
    } = req.body;

    if (!siteId || !startDate || !endDate || !totalBudget) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if budget already exists for this site and period
    const existingBudget = await SiteBudget.findOne({
      siteId,
      startDate: { $lte: new Date(endDate) },
      endDate: { $gte: new Date(startDate) },
      isActive: true,
    });

    if (existingBudget) {
      // Update existing budget
      existingBudget.budgetPeriod = budgetPeriod || existingBudget.budgetPeriod;
      existingBudget.startDate = startDate;
      existingBudget.endDate = endDate;
      existingBudget.totalBudget = totalBudget;
      existingBudget.pettyCashBudget = pettyCashBudget || 0;
      existingBudget.majorExpenseBudget = majorExpenseBudget || 0;

      await existingBudget.save();

      return res.status(200).json({
        success: true,
        message: "Budget updated successfully",
        data: existingBudget,
      });
    }

    // Create new budget
    const budget = new SiteBudget({
      siteId,
      budgetPeriod: budgetPeriod || "Monthly",
      startDate,
      endDate,
      totalBudget,
      pettyCashBudget: pettyCashBudget || 0,
      majorExpenseBudget: majorExpenseBudget || 0,
      createdBy: createdBy || req.user?._id,
    });

    await budget.save();

    res.status(201).json({
      success: true,
      message: "Budget created successfully",
      data: budget,
    });
  } catch (error) {
    console.error("Error creating/updating budget:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update budget",
      error: error.message,
    });
  }
};

// Get all budgets
exports.getAllBudgets = async (req, res) => {
  try {
    const { siteId, isActive } = req.query;

    let query = {};
    if (siteId) query.siteId = siteId;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const budgets = await SiteBudget.find(query)
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: budgets.length,
      data: budgets,
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budgets",
      error: error.message,
    });
  }
};

// Get budget for specific site
exports.getBudgetBySite = async (req, res) => {
  try {
    const { siteId } = req.params;

    const budget = await SiteBudget.findOne({
      siteId,
      isActive: true,
    })
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId");

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "No active budget found for this site",
      });
    }

    // Calculate actual spent amount
    const pettyCashSpent = await PettyCashExpense.aggregate([
      {
        $match: {
          siteId: mongoose.Types.ObjectId(siteId),
          status: "Approved",
          date: {
            $gte: budget.startDate,
            $lte: budget.endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const majorExpenseSpent = await MajorExpense.aggregate([
      {
        $match: {
          siteId: mongoose.Types.ObjectId(siteId),
          status: { $in: ["Approved", "Paid"] },
          date: {
            $gte: budget.startDate,
            $lte: budget.endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalSpent =
      (pettyCashSpent[0]?.total || 0) + (majorExpenseSpent[0]?.total || 0);

    // Update budget with actual spent amount
    budget.spentAmount = totalSpent;
    await budget.save();

    res.status(200).json({
      success: true,
      data: {
        ...budget.toObject(),
        pettyCashSpent: pettyCashSpent[0]?.total || 0,
        majorExpenseSpent: majorExpenseSpent[0]?.total || 0,
        utilizationPercentage: ((totalSpent / budget.totalBudget) * 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budget",
      error: error.message,
    });
  }
};

// Get single budget
exports.getBudgetById = async (req, res) => {
  try {
    const budget = await SiteBudget.findById(req.params.id)
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId");

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budget",
      error: error.message,
    });
  }
};

// Update budget
exports.updateBudget = async (req, res) => {
  try {
    const budget = await SiteBudget.findById(req.params.id);

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    const allowedUpdates = [
      "budgetPeriod",
      "startDate",
      "endDate",
      "totalBudget",
      "pettyCashBudget",
      "majorExpenseBudget",
      "isActive",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        budget[field] = req.body[field];
      }
    });

    await budget.save();

    res.status(200).json({
      success: true,
      message: "Budget updated successfully",
      data: budget,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update budget",
      error: error.message,
    });
  }
};

// Deactivate budget
exports.deactivateBudget = async (req, res) => {
  try {
    const budget = await SiteBudget.findById(req.params.id);

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    budget.isActive = false;
    await budget.save();

    res.status(200).json({
      success: true,
      message: "Budget deactivated successfully",
      data: budget,
    });
  } catch (error) {
    console.error("Error deactivating budget:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate budget",
      error: error.message,
    });
  }
};

// Get budget summary for all sites
exports.getAllSitesBudgetSummary = async (req, res) => {
  try {
    const budgets = await SiteBudget.find({ isActive: true }).populate(
      "siteId",
      "siteName siteCode"
    );

    const summary = await Promise.all(
      budgets.map(async (budget) => {
        const pettyCashSpent = await PettyCashExpense.aggregate([
          {
            $match: {
              siteId: budget.siteId._id,
              status: "Approved",
              date: {
                $gte: budget.startDate,
                $lte: budget.endDate,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]);

        const majorExpenseSpent = await MajorExpense.aggregate([
          {
            $match: {
              siteId: budget.siteId._id,
              status: { $in: ["Approved", "Paid"] },
              date: {
                $gte: budget.startDate,
                $lte: budget.endDate,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]);

        const totalSpent =
          (pettyCashSpent[0]?.total || 0) + (majorExpenseSpent[0]?.total || 0);

        return {
          siteId: budget.siteId._id,
          siteName: budget.siteId.siteName,
          siteCode: budget.siteId.siteCode,
          totalBudget: budget.totalBudget,
          spentAmount: totalSpent,
          remainingBudget: budget.totalBudget - totalSpent,
          utilizationPercentage: ((totalSpent / budget.totalBudget) * 100).toFixed(2),
          budgetPeriod: budget.budgetPeriod,
          startDate: budget.startDate,
          endDate: budget.endDate,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: summary.length,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching budget summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch budget summary",
      error: error.message,
    });
  }
};
