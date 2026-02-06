const GRN = require("../models/GRN");
const PurchaseOrder = require("../models/PurchaseOrder");
const Inventory = require("../models/Inventory");
const StockTransaction = require("../models/StockTransaction");

// Generate GRN number
const generateGRNNumber = async () => {
  const prefix = "GRN";
  const year = new Date().getFullYear();
  
  // Find the last GRN for this year
  const lastGRN = await GRN.findOne({ 
    grnNumber: new RegExp(`^${prefix}-${year}-`) 
  }).sort({ createdAt: -1 });
  
  let nextNumber = 1;
  if (lastGRN && lastGRN.grnNumber) {
    const lastNumber = parseInt(lastGRN.grnNumber.split("-")[2]) || 0;
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
};

// Create GRN (Goods Received Note)
exports.createGRN = async (req, res) => {
  try {
    const {
      poId,
      receivedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      qualityCheck,
      vehicleNumber,
      driverName,
      driverContact,
      challanNumber,
      challanDate,
      invoiceNumber,
      rejectionReason,
      receivedBy,
      remarks,
    } = req.body;

    // Validation
    if (!poId || !receivedQuantity || !acceptedQuantity || !qualityCheck) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Get PO details
    const purchaseOrder = await PurchaseOrder.findById(poId).populate("vendorId").populate("siteId");

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Generate GRN number
    const grnNumber = await generateGRNNumber();

    // Determine GRN status
    let grnStatus = "Accepted";
    if (acceptedQuantity === 0) {
      grnStatus = "Rejected";
    } else if (acceptedQuantity < receivedQuantity) {
      grnStatus = "Partially Accepted";
    }

    // Create GRN with siteId from PO
    const grn = new GRN({
      grnNumber,
      poId,
      siteId: purchaseOrder.siteId?._id || purchaseOrder.siteId, // Auto-populate from PO
      vendorId: purchaseOrder.vendorId._id,
      materialName: purchaseOrder.materialName,
      orderedQuantity: purchaseOrder.quantity,
      receivedQuantity,
      acceptedQuantity,
      rejectedQuantity: rejectedQuantity || receivedQuantity - acceptedQuantity,
      unit: purchaseOrder.unit,
      qualityCheck,
      vehicleNumber,
      driverName,
      driverContact,
      challanNumber,
      challanDate,
      invoiceNumber,
      rejectionReason,
      status: grnStatus,
      receivedBy,
      remarks,
      stockUpdated: false,
    });

    await grn.save();

    // Update PO status
    if (acceptedQuantity >= purchaseOrder.quantity) {
      purchaseOrder.status = "Completed";
    } else if (acceptedQuantity > 0) {
      purchaseOrder.status = "Partially Received";
    }
    await purchaseOrder.save();

    res.status(201).json({
      success: true,
      message: "GRN created successfully",
      data: grn,
    });
  } catch (error) {
    console.error("Error creating GRN:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create GRN",
      error: error.message,
    });
  }
};

// Update stock from GRN (Stock In)
exports.updateStockFromGRN = async (req, res) => {
  try {
    const { performedBy } = req.body;

    const grn = await GRN.findById(req.params.id).populate("poId");

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    if (grn.stockUpdated) {
      return res.status(400).json({
        success: false,
        message: "Stock already updated for this GRN",
      });
    }

    if (grn.acceptedQuantity === 0) {
      return res.status(400).json({
        success: false,
        message: "No accepted quantity to add to stock",
      });
    }

    // Find or create inventory item
    let inventoryItem = await Inventory.findOne({
      materialName: { $regex: new RegExp(`^${grn.materialName}$`, "i") },
    });

    if (!inventoryItem) {
      // Auto-create inventory item if not exists
      inventoryItem = new Inventory({
        materialName: grn.materialName,
        category: "Other", // Default category
        unit: grn.unit,
        currentStock: 0,
        reorderLevel: 10,
        averageRate: grn.poId.ratePerUnit,
        totalValue: 0,
        warehouse: "Central Warehouse",
      });
      await inventoryItem.save();
      console.log(`Auto-created inventory item for: ${grn.materialName}`);
    }

    // Calculate new average rate
    const currentValue = inventoryItem.currentStock * inventoryItem.averageRate;
    const newValue = grn.acceptedQuantity * grn.poId.ratePerUnit;
    const totalStock = inventoryItem.currentStock + grn.acceptedQuantity;
    const newAverageRate = totalStock > 0 ? (currentValue + newValue) / totalStock : grn.poId.ratePerUnit;

    // Update inventory (Stock In)
    inventoryItem.currentStock += grn.acceptedQuantity;
    inventoryItem.averageRate = newAverageRate;
    inventoryItem.totalValue = inventoryItem.currentStock * inventoryItem.averageRate;
    inventoryItem.lastUpdated = new Date();
    await inventoryItem.save();

    // Create stock transaction
    const transactionNumber = `ST-IN-${new Date().getFullYear()}-${String(
      (await StockTransaction.countDocuments({ transactionType: "Stock In" })) + 1
    ).padStart(4, "0")}`;

    const stockTransaction = new StockTransaction({
      transactionNumber,
      transactionType: "Stock In",
      materialId: inventoryItem._id,
      quantity: grn.acceptedQuantity,
      unit: grn.unit,
      grnId: grn._id,
      rate: grn.poId.ratePerUnit,
      performedBy,
      remarks: `Stock In from GRN ${grn.grnNumber}`,
      balanceAfterTransaction: inventoryItem.currentStock,
    });

    await stockTransaction.save();

    // Update GRN
    grn.stockUpdated = true;
    grn.stockTransactionId = stockTransaction._id;
    await grn.save();

    res.status(200).json({
      success: true,
      message: "Stock updated successfully from GRN",
      data: {
        grn,
        stockTransaction,
        updatedStock: inventoryItem.currentStock,
      },
    });
  } catch (error) {
    console.error("Error updating stock from GRN:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update stock from GRN",
      error: error.message,
    });
  }
};

// Get all GRNs
exports.getAllGRNs = async (req, res) => {
  try {
    const { poId, vendorId, status, startDate, endDate, siteId, verificationStatus } = req.query;

    let query = {};

    if (poId) query.poId = poId;
    if (vendorId) query.vendorId = vendorId;
    if (status) query.status = status;
    
    // Support filtering by siteId (comma-separated for multiple sites)
    if (siteId) {
      const siteIds = siteId.split(',');
      query.siteId = { $in: siteIds };
    }
    
    // Support filtering by verification status
    if (verificationStatus === 'pending') {
      query.verificationStatus = { $in: [null, 'pending'] };
    } else if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }

    if (startDate && endDate) {
      query.receivedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const grns = await GRN.find(query)
      .populate("poId", "poNumber materialName")
      .populate("siteId", "siteName siteCode")
      .populate("vendorId", "vendorName vendorCode")
      .populate("receivedBy", "name employeeId")
      .populate("qualityCheck.checkedBy", "name employeeId")
      .populate("verifiedById", "employeeName employeeId")
      .populate("stockTransactionId")
      .sort({ receivedDate: -1 });

    res.status(200).json({
      success: true,
      count: grns.length,
      data: grns,
    });
  } catch (error) {
    console.error("Error fetching GRNs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch GRNs",
      error: error.message,
    });
  }
};

// Get GRN by ID
exports.getGRNById = async (req, res) => {
  try {
    const grn = await GRN.findById(req.params.id)
      .populate("poId")
      .populate("vendorId")
      .populate("receivedBy", "name employeeId email")
      .populate("qualityCheck.checkedBy", "name employeeId")
      .populate("stockTransactionId");

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    res.status(200).json({
      success: true,
      data: grn,
    });
  } catch (error) {
    console.error("Error fetching GRN:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch GRN",
      error: error.message,
    });
  }
};

// Update GRN
exports.updateGRN = async (req, res) => {
  try {
    const grn = await GRN.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "GRN updated successfully",
      data: grn,
    });
  } catch (error) {
    console.error("Error updating GRN:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update GRN",
      error: error.message,
    });
  }
};

// Delete GRN
exports.deleteGRN = async (req, res) => {
  try {
    const PurchaseOrder = require("../models/PurchaseOrder");
    const Inventory = require("../models/Inventory");
    const StockTransaction = require("../models/StockTransaction");
    
    const grn = await GRN.findById(req.params.id).populate("poId");

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    // If stock was updated, reverse it before deleting
    if (grn.stockUpdated && grn.acceptedQuantity > 0) {
      console.log(`⚠️ Reversing stock for GRN ${grn.grnNumber} before deletion`);
      
      // Find inventory item
      const inventoryItem = await Inventory.findOne({
        materialName: { $regex: new RegExp(`^${grn.materialName}$`, "i") },
      });

      if (inventoryItem) {
        // Reduce stock by accepted quantity
        inventoryItem.currentStock -= grn.acceptedQuantity;
        
        // Ensure stock doesn't go negative
        if (inventoryItem.currentStock < 0) {
          inventoryItem.currentStock = 0;
        }
        
        // Recalculate total value
        inventoryItem.totalValue = inventoryItem.currentStock * inventoryItem.averageRate;
        
        await inventoryItem.save();
        console.log(`✅ Stock reversed: ${grn.materialName} - Reduced by ${grn.acceptedQuantity}`);
      }

      // Delete associated stock transaction if exists
      if (grn.stockTransactionId) {
        await StockTransaction.findByIdAndDelete(grn.stockTransactionId);
        console.log(`✅ Stock transaction deleted`);
      }
    }

    // Delete the GRN
    await grn.deleteOne();

    res.status(200).json({
      success: true,
      message: grn.stockUpdated 
        ? "GRN deleted successfully (stock reversed)" 
        : "GRN deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting GRN:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete GRN",
      error: error.message,
    });
  }
};

// Verify GRN (Site Supervisor)
exports.verifyGRN = async (req, res) => {
  try {
    const { grnId, receivedQuantity, condition, remarks, verifiedBy, verifiedById } = req.body;
    
    const grn = await GRN.findById(grnId);
    
    if (!grn) {
      return res.status(404).json({
        success: false,
        message: 'GRN not found',
      });
    }
    
    // Handle photo uploads
    const photos = req.files ? req.files.map(file => file.path) : [];
    
    // Update GRN with verification
    grn.verificationStatus = 'verified';
    grn.verifiedQuantity = parseFloat(receivedQuantity);
    grn.materialCondition = condition;
    grn.verificationRemarks = remarks;
    grn.verifiedBy = verifiedBy;
    grn.verifiedById = verifiedById;
    grn.verificationDate = new Date();
    grn.verificationPhotos = photos;
    
    await grn.save();
    
    res.json({
      success: true,
      message: 'GRN verified successfully',
      data: grn,
    });
  } catch (error) {
    console.error('Error verifying GRN:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
