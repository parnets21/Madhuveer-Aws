const mongoose = require("mongoose");
const Indent = require("../../model/indent");
const Quotation = require("../models/Quotation");
const PurchaseOrder = require("../../model/purchaseOrder");
const GRN = require("../models/GRN");
const Inventory = require("../models/Inventory");
const Vendor = require("../../model/Vendor");

/**
 * Direct Purchase - Creates complete procurement trail automatically
 * Flow: Auto-Indent → Auto-Quotation → Auto-PO → Auto-GRN → Inventory Update
 */
exports.createDirectPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      materialName,
      category,
      unit,
      quantity,
      rate,
      vendorId,
      siteId,
      invoiceNumber,
      invoiceDate,
      remarks,
      warehouse,
      reorderLevel,
    } = req.body;

    // Validation
    if (!materialName || !category || !unit || !quantity || !rate || !vendorId || !siteId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: materialName, category, unit, quantity, rate, vendorId, siteId",
      });
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // ========== STEP 1: Create Auto-Indent ==========
    const indentCount = await Indent.countDocuments();
    const indentNumber = `IND-DP-${String(indentCount + 1).padStart(6, "0")}`;

    const indent = await Indent.create(
      [
        {
          indentNumber,
          siteId,
          materialName,
          quantity,
          unit,
          priority: "High",
          expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          remarks: remarks || "Direct Purchase - Auto-generated",
          status: "Approved",
          approvedBy: req.user?._id || null,
          approvedDate: new Date(),
          isDirectPurchase: true, // Flag to identify direct purchases
        },
      ],
      { session }
    );

    console.log("✅ Step 1: Auto-Indent created:", indent[0].indentNumber);

    // ========== STEP 2: Create Auto-Quotation ==========
    const quotationCount = await Quotation.countDocuments();
    const quotationNumber = `QUO-DP-${String(quotationCount + 1).padStart(6, "0")}`;

    const quotation = await Quotation.create(
      [
        {
          quotationNumber,
          purchaseRequestId: indent[0]._id, // Using indent as purchase request
          siteId,
          vendorId,
          materialName,
          quantity,
          unit,
          ratePerUnit: rate,
          totalAmount: quantity * rate,
          gstPercentage: 18,
          gstAmount: (quantity * rate * 18) / 100,
          grandTotal: quantity * rate + (quantity * rate * 18) / 100,
          deliveryTime: "7 days",
          paymentTerms: "As per agreement",
          validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
          remarks: "Direct Purchase - Auto-generated",
          status: "Selected",
          submittedDate: new Date(),
          isDirectPurchase: true,
        },
      ],
      { session }
    );

    console.log("✅ Step 2: Auto-Quotation created:", quotation[0].quotationNumber);

    // ========== STEP 3: Create Auto-PO ==========
    const poCount = await PurchaseOrder.countDocuments();
    const poNumber = `PO-DP-${String(poCount + 1).padStart(6, "0")}`;

    const purchaseOrder = await PurchaseOrder.create(
      [
        {
          poNumber,
          purchaseRequestId: indent[0]._id,
          quotationId: quotation[0]._id,
          vendorId,
          siteId,
          materialName,
          quantity,
          unit,
          ratePerUnit: rate,
          totalAmount: quantity * rate,
          gstPercentage: 18,
          gstAmount: (quantity * rate * 18) / 100,
          grandTotal: quantity * rate + (quantity * rate * 18) / 100,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryAddress: warehouse || "Central Warehouse",
          paymentTerms: "As per agreement",
          remarks: "Direct Purchase - Auto-generated",
          status: "Approved",
          approvedBy: req.user?._id || null,
          approvalDate: new Date(),
          isDirectPurchase: true,
        },
      ],
      { session }
    );

    console.log("✅ Step 3: Auto-PO created:", purchaseOrder[0].poNumber);

    // ========== STEP 4: Create Auto-GRN ==========
    const grnCount = await GRN.countDocuments();
    const grnNumber = `GRN-DP-${String(grnCount + 1).padStart(6, "0")}`;

    const grn = await GRN.create(
      [
        {
          grnNumber,
          poId: purchaseOrder[0]._id,
          siteId,
          vendorId,
          materialName,
          orderedQuantity: quantity,
          receivedQuantity: quantity,
          acceptedQuantity: quantity,
          rejectedQuantity: 0,
          unit,
          receivedDate: new Date(),
          qualityCheck: {
            status: "Passed",
            checkDate: new Date(),
            remarks: "Direct Purchase - Auto-approved",
          },
          invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
          status: "Accepted",
          warehouse: warehouse || "Central Warehouse",
          stockUpdated: true,
          receivedBy: req.user?._id || null,
          remarks: "Direct Purchase - Auto-generated",
          isDirectPurchase: true,
        },
      ],
      { session }
    );

    console.log("✅ Step 4: Auto-GRN created:", grn[0].grnNumber);

    // ========== STEP 5: Update/Create Inventory ==========
    // Check if material already exists in inventory
    let inventoryItem = await Inventory.findOne({
      materialName: { $regex: new RegExp(`^${materialName}$`, "i") },
    });

    if (inventoryItem) {
      // Update existing material
      const newStock = inventoryItem.currentStock + quantity;
      const newTotalValue = inventoryItem.totalValue + quantity * rate;
      const newAverageRate = newTotalValue / newStock;

      inventoryItem.currentStock = newStock;
      inventoryItem.totalValue = newTotalValue;
      inventoryItem.averageRate = newAverageRate;
      inventoryItem.lastUpdated = new Date();

      await inventoryItem.save({ session });
      console.log("✅ Step 5: Inventory updated:", inventoryItem.materialName);
    } else {
      // Create new material in inventory
      const materialCodePrefix = category.substring(0, 3).toUpperCase();
      const materialCount = await Inventory.countDocuments({ category });
      const materialCode = `${materialCodePrefix}-${String(materialCount + 1).padStart(4, "0")}`;

      inventoryItem = await Inventory.create(
        [
          {
            materialName,
            materialCode,
            category,
            unit,
            currentStock: quantity,
            reorderLevel: reorderLevel || 10,
            warehouse: warehouse || "Central Warehouse",
            averageRate: rate,
            totalValue: quantity * rate,
          },
        ],
        { session }
      );
      console.log("✅ Step 5: New inventory item created:", inventoryItem[0].materialName);
    }

    // Commit transaction
    await session.commitTransaction();

    // Populate response data
    await indent[0].populate("siteId", "siteName location");
    await quotation[0].populate("vendorId", "vendorName contactPerson");
    await purchaseOrder[0].populate("vendorId", "vendorName");
    await grn[0].populate("vendorId", "vendorName");

    res.status(201).json({
      success: true,
      message: "Direct purchase completed successfully with complete documentation",
      data: {
        indent: {
          _id: indent[0]._id,
          indentNumber: indent[0].indentNumber,
          status: indent[0].status,
        },
        quotation: {
          _id: quotation[0]._id,
          quotationNumber: quotation[0].quotationNumber,
          vendor: quotation[0].vendorId,
          totalAmount: quotation[0].totalAmount,
        },
        purchaseOrder: {
          _id: purchaseOrder[0]._id,
          poNumber: purchaseOrder[0].poNumber,
          totalAmount: purchaseOrder[0].totalAmount,
        },
        grn: {
          _id: grn[0]._id,
          grnNumber: grn[0].grnNumber,
          receivedQuantity: quantity,
        },
        inventory: {
          materialName: inventoryItem.materialName || inventoryItem[0].materialName,
          currentStock: inventoryItem.currentStock || inventoryItem[0].currentStock,
          averageRate: inventoryItem.averageRate || inventoryItem[0].averageRate,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error in direct purchase:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete direct purchase",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get all direct purchases
 */
exports.getDirectPurchases = async (req, res) => {
  try {
    const directPurchases = await Indent.find({ isDirectPurchase: true })
      .populate("siteId", "siteName location")
      .populate("approvedBy", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: directPurchases.length,
      data: directPurchases,
    });
  } catch (error) {
    console.error("Error fetching direct purchases:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch direct purchases",
      error: error.message,
    });
  }
};

/**
 * Get direct purchase details with all linked documents
 */
exports.getDirectPurchaseDetails = async (req, res) => {
  try {
    const { indentId } = req.params;

    const indent = await Indent.findById(indentId).populate("siteId", "siteName location");

    if (!indent || !indent.isDirectPurchase) {
      return res.status(404).json({
        success: false,
        message: "Direct purchase not found",
      });
    }

    // Find linked documents
    const quotation = await Quotation.findOne({ indentId }).populate("vendorId", "vendorName contactPerson");
    const purchaseOrder = await PurchaseOrder.findOne({ quotationId: quotation?._id }).populate("vendorId", "vendorName");
    const grn = await GRN.findOne({ poId: purchaseOrder?._id }).populate("vendorId", "vendorName");

    res.status(200).json({
      success: true,
      data: {
        indent,
        quotation,
        purchaseOrder,
        grn,
      },
    });
  } catch (error) {
    console.error("Error fetching direct purchase details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch direct purchase details",
      error: error.message,
    });
  }
};
