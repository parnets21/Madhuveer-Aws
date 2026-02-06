const FixedAsset = require("../models/FixedAsset");
const path = require("path");
const fs = require("fs");

// Generate asset code
const generateAssetCode = async (type) => {
  const prefix = type.substring(0, 3).toUpperCase();
  const count = await FixedAsset.countDocuments();
  return `FA-${prefix}-${String(count + 1).padStart(4, "0")}`;
};

// Add new fixed asset
exports.addFixedAsset = async (req, res) => {
  try {
    const {
      siteId,
      name,
      type,
      quantity,
      value,
      dateOfPurchase,
      depreciationPercentage,
      invoiceNumber,
      vendor,
      description,
    } = req.body;

    // Validation
    if (!siteId || !name || !type || !quantity || !value || !dateOfPurchase || !depreciationPercentage) {
      return res.status(400).json({
        success: false,
        message: "Please provide siteId, name, type, quantity, value, dateOfPurchase, and depreciationPercentage",
      });
    }

    // Generate asset code
    const assetCode = await generateAssetCode(type);

    // Handle invoice file upload
    let invoiceUrl = null;
    if (req.file) {
      invoiceUrl = `/uploads/fixed-assets/${req.file.filename}`;
    }

    // Create fixed asset
    const fixedAsset = new FixedAsset({
      siteId,
      assetCode,
      name,
      type,
      quantity: parseInt(quantity),
      value: parseFloat(value),
      dateOfPurchase: new Date(dateOfPurchase),
      invoiceUrl,
      invoiceNumber,
      depreciationPercentage: parseFloat(depreciationPercentage),
      vendor,
      description,
      createdBy: req.user?._id,
    });

    await fixedAsset.save();

    res.status(201).json({
      success: true,
      message: "Fixed asset added successfully",
      data: fixedAsset,
    });
  } catch (error) {
    console.error("Error adding fixed asset:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add fixed asset",
      error: error.message,
    });
  }
};

// Get all fixed assets
exports.getAllFixedAssets = async (req, res) => {
  try {
    const { siteId, type, status, search } = req.query;

    let query = {};

    if (siteId) {
      query.siteId = siteId;
    }

    if (type) {
      query.type = { $regex: type, $options: "i" };
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { assetCode: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
      ];
    }

    const fixedAssets = await FixedAsset.find(query)
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId")
      .sort({ createdAt: -1 });

    // Calculate current depreciation for each asset
    const assetsWithDepreciation = fixedAssets.map((asset) => {
      const depreciation = asset.calculateDepreciation();
      return {
        ...asset.toObject(),
        depreciation,
      };
    });

    res.status(200).json({
      success: true,
      count: assetsWithDepreciation.length,
      data: assetsWithDepreciation,
    });
  } catch (error) {
    console.error("Error fetching fixed assets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fixed assets",
      error: error.message,
    });
  }
};

// Get fixed asset by ID
exports.getFixedAssetById = async (req, res) => {
  try {
    const fixedAsset = await FixedAsset.findById(req.params.id)
      .populate("siteId", "siteName siteCode location")
      .populate("createdBy", "name employeeId");

    if (!fixedAsset) {
      return res.status(404).json({
        success: false,
        message: "Fixed asset not found",
      });
    }

    const depreciation = fixedAsset.calculateDepreciation();

    res.status(200).json({
      success: true,
      data: {
        ...fixedAsset.toObject(),
        depreciation,
      },
    });
  } catch (error) {
    console.error("Error fetching fixed asset:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fixed asset",
      error: error.message,
    });
  }
};

// Update fixed asset
exports.updateFixedAsset = async (req, res) => {
  try {
    const {
      name,
      type,
      quantity,
      value,
      dateOfPurchase,
      depreciationPercentage,
      invoiceNumber,
      vendor,
      description,
      status,
    } = req.body;

    const fixedAsset = await FixedAsset.findById(req.params.id);

    if (!fixedAsset) {
      return res.status(404).json({
        success: false,
        message: "Fixed asset not found",
      });
    }

    // Update fields
    if (name) fixedAsset.name = name;
    if (type) fixedAsset.type = type;
    if (quantity) fixedAsset.quantity = parseInt(quantity);
    if (value) fixedAsset.value = parseFloat(value);
    if (dateOfPurchase) fixedAsset.dateOfPurchase = new Date(dateOfPurchase);
    if (depreciationPercentage) fixedAsset.depreciationPercentage = parseFloat(depreciationPercentage);
    if (invoiceNumber) fixedAsset.invoiceNumber = invoiceNumber;
    if (vendor) fixedAsset.vendor = vendor;
    if (description !== undefined) fixedAsset.description = description;
    if (status) fixedAsset.status = status;

    // Handle invoice file upload
    if (req.file) {
      // Delete old invoice file if exists
      if (fixedAsset.invoiceUrl) {
        const oldFilePath = path.join(__dirname, "..", "..", fixedAsset.invoiceUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      fixedAsset.invoiceUrl = `/uploads/fixed-assets/${req.file.filename}`;
    }

    await fixedAsset.save();

    res.status(200).json({
      success: true,
      message: "Fixed asset updated successfully",
      data: fixedAsset,
    });
  } catch (error) {
    console.error("Error updating fixed asset:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update fixed asset",
      error: error.message,
    });
  }
};

// Delete fixed asset
exports.deleteFixedAsset = async (req, res) => {
  try {
    const fixedAsset = await FixedAsset.findById(req.params.id);

    if (!fixedAsset) {
      return res.status(404).json({
        success: false,
        message: "Fixed asset not found",
      });
    }

    // Delete invoice file if exists
    if (fixedAsset.invoiceUrl) {
      const filePath = path.join(__dirname, "..", "..", fixedAsset.invoiceUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await FixedAsset.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Fixed asset deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting fixed asset:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete fixed asset",
      error: error.message,
    });
  }
};

// Get fixed assets summary by site
exports.getFixedAssetsSummary = async (req, res) => {
  try {
    const { siteId } = req.query;

    let matchQuery = {};
    if (siteId) {
      const mongoose = require("mongoose");
      matchQuery.siteId = new mongoose.Types.ObjectId(siteId);
    }

    const summary = await FixedAsset.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: "$totalValue" },
          totalCurrentValue: { $sum: "$currentValue" },
          totalDepreciation: { $sum: "$accumulatedDepreciation" },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    const totals = await FixedAsset.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalPurchaseValue: { $sum: "$totalValue" },
          totalCurrentValue: { $sum: "$currentValue" },
          totalDepreciation: { $sum: "$accumulatedDepreciation" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byType: summary,
        totals: totals[0] || {
          totalAssets: 0,
          totalQuantity: 0,
          totalPurchaseValue: 0,
          totalCurrentValue: 0,
          totalDepreciation: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching fixed assets summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fixed assets summary",
      error: error.message,
    });
  }
};

// Get depreciation report
exports.getDepreciationReport = async (req, res) => {
  try {
    const { siteId, year } = req.query;

    let query = { status: "Active" };
    if (siteId) {
      query.siteId = siteId;
    }

    const fixedAssets = await FixedAsset.find(query)
      .populate("siteId", "siteName siteCode")
      .sort({ type: 1, name: 1 });

    const report = fixedAssets.map((asset) => {
      const depreciation = asset.calculateDepreciation();
      return {
        assetCode: asset.assetCode,
        name: asset.name,
        type: asset.type,
        site: asset.siteId?.siteName || "N/A",
        dateOfPurchase: asset.dateOfPurchase,
        quantity: asset.quantity,
        purchaseValue: asset.totalValue,
        depreciationRate: asset.depreciationPercentage,
        annualDepreciation: depreciation.annualDepreciation,
        accumulatedDepreciation: depreciation.accumulatedDepreciation,
        currentValue: depreciation.currentValue,
        yearsOwned: depreciation.yearsOwned,
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });
  } catch (error) {
    console.error("Error fetching depreciation report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch depreciation report",
      error: error.message,
    });
  }
};
