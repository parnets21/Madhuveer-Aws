const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseRequest = require("../models/PurchaseRequest");
const Quotation = require("../models/Quotation");

// Generate PO number
const generatePONumber = async () => {
  const prefix = "PO";
  const count = await PurchaseOrder.countDocuments();
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
};

// Create Purchase Order from approved quotation
exports.createPurchaseOrder = async (req, res) => {
  try {
    console.log("📥 Received PO creation request");
    console.log("Request body keys:", Object.keys(req.body));
    
    const {
      purchaseRequestId,
      quotationId,
      vendorId,
      siteId,
      deliveryAddress,
      termsAndConditions,
      remarks,
      createdBy,
      // Restaurant-style fields
      branch,
      supplierId,
      storeLocation,
      storeLocationId,
      storeType,
      items,
      orderDate,
      deliveryDate,
      subtotal,
      tax,
      taxRate,
      total,
      paymentTerms,
      status,
      notes,
    } = req.body;

    // Check if this is a restaurant-style purchase order
    const hasRestaurantFields = (branch && (branch.id || branch._id)) || supplierId || (items && Array.isArray(items) && items.length > 0);
    const hasQuotationId = quotationId && quotationId !== '' && quotationId !== null && quotationId !== undefined;
    const hasVendorSiteDelivery = vendorId && vendorId !== '' && vendorId !== null && vendorId !== undefined &&
                                  siteId && siteId !== '' && siteId !== null && siteId !== undefined &&
                                  deliveryAddress && deliveryAddress !== '' && deliveryAddress !== null && deliveryAddress !== undefined;
    const hasConstructionFields = hasQuotationId || hasVendorSiteDelivery;
    const isRestaurantPO = hasRestaurantFields && !hasConstructionFields;
    
    console.log("🔍 Checking PO type:");
    console.log("  branch:", branch ? JSON.stringify(branch).substring(0, 200) : "missing");
    console.log("  supplierId:", supplierId);
    console.log("  items:", items ? `${Array.isArray(items) ? items.length : 'not array'} items` : "missing");
    console.log("  quotationId:", quotationId);
    console.log("  vendorId:", vendorId);
    console.log("  siteId:", siteId);
    console.log("  hasRestaurantFields:", hasRestaurantFields);
    console.log("  hasConstructionFields:", hasConstructionFields);
    console.log("  isRestaurantPO:", isRestaurantPO);

    if (isRestaurantPO) {
      console.log("✅ Detected Restaurant-style PO");
      // Restaurant-style validation
      if (!supplierId) {
        return res.status(400).json({
          success: false,
          message: "Please provide supplierId",
        });
      }
      if (!branch || (!branch.id && !branch._id)) {
        return res.status(400).json({
          success: false,
          message: "Please provide branch with id",
        });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide items array",
        });
      }

      // Validate and extract branch ID
      const branchId = branch?.id || branch?._id || (typeof branch === 'string' ? branch : null);
      if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid Branch ID: ${branchId}`,
        });
      }

      if (!mongoose.Types.ObjectId.isValid(supplierId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Supplier ID",
        });
      }

      // Generate PO number
      const poNumber = await generatePONumber();

      // Calculate totals from items if not provided
      let finalSubtotal = subtotal || 0;
      let finalTax = tax || 0;
      let finalTotal = total || 0;

      if (!subtotal && items && items.length > 0) {
        finalSubtotal = items.reduce((sum, item) => sum + (item.amount || item.quantity * (item.rate || item.unitPrice || 0)), 0);
      }
      if (!tax && taxRate && finalSubtotal) {
        finalTax = (finalSubtotal * taxRate) / 100;
      }
      if (!total) {
        finalTotal = finalSubtotal + finalTax;
      }

      // Check if approval is required
      const approvalThreshold = 100000;
      const requiresApproval = finalTotal > approvalThreshold;
      // Use valid enum values: "Draft", "Pending Approval", "Approved", "Rejected", "Sent to Vendor", "Acknowledged", "In Transit", "Partially Received", "Completed", "Cancelled"
      const initialStatus = status === "Pending" ? "Draft" : (status || (requiresApproval ? "Pending Approval" : "Draft"));

      // Create dummy PurchaseRequest and Quotation for restaurant POs
      let dummyPRId, dummyQuotationId;
      
      try {
        console.log("🔧 Creating/finding dummy PR and Quotation records...");
        
        // First, create or find a dummy Indent (required by PurchaseRequest schema)
        const Indent = require("../../model/Indent");
        let dummyIndent = await Indent.findOne({ indentNumber: 'RESTAURANT-DUMMY-INDENT' });
        if (!dummyIndent) {
          dummyIndent = new Indent({
            indentNumber: 'RESTAURANT-DUMMY-INDENT',
            siteId: branchId,
            materialName: 'Restaurant Purchase Order',
            quantity: 1,
            unit: 'pcs',
            priority: 'Low',
            expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'Approved',
            remarks: 'Dummy Indent for restaurant purchase orders',
          });
          await dummyIndent.save();
          console.log("✅ Created dummy Indent:", dummyIndent._id);
        }
        
        let existingPR = await PurchaseRequest.findOne({ prNumber: 'RESTAURANT-DUMMY-PR' });
        if (!existingPR) {
          existingPR = new PurchaseRequest({
            prNumber: 'RESTAURANT-DUMMY-PR',
            indentId: dummyIndent._id,
            siteId: branchId,
            materialName: 'Restaurant Purchase Order',
            quantity: 1,
            unit: 'pcs',
            priority: 'Low',
            status: 'PO Created',
            remarks: 'Dummy PR for restaurant purchase orders',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          });
          await existingPR.save();
          console.log("✅ Created dummy PR:", existingPR._id);
        } else {
          console.log("✅ Using existing dummy PR:", existingPR._id);
        }
        dummyPRId = existingPR._id;
        
        // Create Quotation after PR is created (since Quotation needs purchaseRequestId)
        let existingQuotation = await Quotation.findOne({ quotationNumber: 'RESTAURANT-DUMMY-QT' });
        if (!existingQuotation) {
          existingQuotation = new Quotation({
            quotationNumber: 'RESTAURANT-DUMMY-QT',
            purchaseRequestId: dummyPRId, // Link to the dummy PR
            vendorId: supplierId,
            siteId: branchId,
            materialName: 'Restaurant Purchase Order',
            quantity: 1,
            unit: 'pcs',
            ratePerUnit: 0,
            totalAmount: 0,
            gstPercentage: 0,
            gstAmount: 0,
            grandTotal: 0,
            deliveryTime: '0 days',
            paymentTerms: 'Net 30 days',
            validityDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            status: 'Selected',
            remarks: 'Dummy Quotation for restaurant purchase orders',
          });
          await existingQuotation.save();
          console.log("✅ Created dummy Quotation:", existingQuotation._id);
        } else {
          console.log("✅ Using existing dummy Quotation:", existingQuotation._id);
        }
        dummyQuotationId = existingQuotation._id;
      } catch (error) {
        console.error("❌ Error creating dummy records:", error.message);
        return res.status(500).json({
          success: false,
          message: "Failed to create purchase order: " + error.message,
        });
      }

      // Create Purchase Order for restaurant
      const purchaseOrder = new PurchaseOrder({
        poNumber,
        purchaseRequestId: dummyPRId,
        quotationId: dummyQuotationId,
        vendorId: supplierId,
        siteId: branchId,
        materialName: items.map(item => item.name || item.itemName).join(", "),
        quantity: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        unit: "pcs",
        ratePerUnit: finalSubtotal / (items.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1),
        totalAmount: finalSubtotal,
        gstPercentage: taxRate || 5,
        gstAmount: finalTax,
        grandTotal: finalTotal,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
        deliveryAddress: (branch?.address && typeof branch.address === 'string' ? branch.address : (typeof branch.address === 'object' ? JSON.stringify(branch.address) : null)) || storeLocation?.address || (branch?.name || "Restaurant Branch"),
        paymentTerms: paymentTerms || "Net 30 days",
        termsAndConditions: termsAndConditions || "",
        remarks: JSON.stringify({
          restaurantPO: true,
          storeLocationId: storeLocationId,
          storeLocationName: storeLocation?.name || storeType,
          storeType: storeType,
          notes: notes || remarks || "",
          items: items.map(item => ({
            name: item.name,
            materialName: item.materialName || null, // Store material name if provided
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            amount: item.amount
          }))
        }),
        status: initialStatus,
        requiresApproval,
        approvalThreshold,
        poDate: orderDate ? new Date(orderDate) : new Date(),
        createdBy: (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) ? createdBy : null,
      });

      await purchaseOrder.save();

      res.status(201).json({
        success: true,
        message: requiresApproval 
          ? "Purchase Order created and sent for admin approval (high value)"
          : "Purchase Order created successfully",
        data: purchaseOrder,
        requiresApproval,
      });
      return;
    }

    // Construction-style validation (original logic)
    if (!purchaseRequestId || !quotationId || !vendorId || !siteId || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(purchaseRequestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Purchase Request ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Quotation ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Vendor ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Site ID",
      });
    }

    // Get quotation details
    const quotation = await Quotation.findById(quotationId);

    if (!quotation || (quotation.status !== "Selected" && quotation.status !== "Submitted")) {
      return res.status(400).json({
        success: false,
        message: "Quotation must be submitted or selected first",
      });
    }

    // Generate PO number
    const poNumber = await generatePONumber();

    // Calculate delivery date (add delivery time to current date)
    const deliveryDays = parseInt(quotation.deliveryTime.match(/\d+/)?.[0]) || 7;
    const calculatedDeliveryDate = new Date();
    calculatedDeliveryDate.setDate(calculatedDeliveryDate.getDate() + deliveryDays);

    // Check if approval is required (threshold: ₹1,00,000)
    const approvalThreshold = 100000;
    const requiresApproval = quotation.grandTotal > approvalThreshold;
    const initialStatus = requiresApproval ? "Pending Approval" : "Draft";

    // Create Purchase Order
    const purchaseOrder = new PurchaseOrder({
      poNumber,
      purchaseRequestId,
      quotationId,
      vendorId,
      siteId,
      materialName: quotation.materialName,
      quantity: quotation.quantity,
      unit: quotation.unit,
      ratePerUnit: quotation.ratePerUnit,
      totalAmount: quotation.totalAmount,
      gstPercentage: quotation.gstPercentage || 18,
      gstAmount: quotation.gstAmount,
      grandTotal: quotation.grandTotal,
      deliveryDate: calculatedDeliveryDate,
      deliveryAddress,
      paymentTerms: quotation.paymentTerms || "Net 30 days",
      termsAndConditions: termsAndConditions || "Standard terms and conditions apply",
      remarks: remarks || "",
      status: initialStatus,
      requiresApproval,
      approvalThreshold,
      createdBy: (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) ? createdBy : null,
    });

    await purchaseOrder.save();

    // Update purchase request status
    await PurchaseRequest.findByIdAndUpdate(purchaseRequestId, {
      status: "PO Created",
    });

    const message = requiresApproval 
      ? "Purchase Order created and sent for admin approval (high value)"
      : "Purchase Order created successfully";

    res.status(201).json({
      success: true,
      message,
      data: purchaseOrder,
      requiresApproval,
    });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase order",
      error: error.message,
    });
  }
};

// Approve Purchase Order
exports.approvePurchaseOrder = async (req, res) => {
  try {
    const { approvedBy, remarks } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    if (purchaseOrder.status !== "Draft" && purchaseOrder.status !== "Pending Approval") {
      return res.status(400).json({
        success: false,
        message: "Purchase Order is not in draft or pending approval status",
      });
    }

    purchaseOrder.status = "Approved";
    // Only set approvedBy if it's a valid ObjectId
    if (approvedBy && mongoose.Types.ObjectId.isValid(approvedBy)) {
      purchaseOrder.approvedBy = approvedBy;
    }
    purchaseOrder.approvalDate = new Date();
    if (remarks) purchaseOrder.remarks = remarks;

    await purchaseOrder.save();

    res.status(200).json({
      success: true,
      message: "Purchase Order approved successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error approving purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve purchase order",
      error: error.message,
    });
  }
};

// Send PO to Vendor
exports.sendPOToVendor = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate("vendorId")
      .populate("siteId");

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    if (purchaseOrder.status !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Purchase Order must be approved first",
      });
    }

    purchaseOrder.status = "Sent to Vendor";
    purchaseOrder.sentToVendorDate = new Date();

    await purchaseOrder.save();

    // Here you can add email/SMS notification logic to vendor

    res.status(200).json({
      success: true,
      message: "Purchase Order sent to vendor successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error sending PO to vendor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send PO to vendor",
      error: error.message,
    });
  }
};

// Vendor acknowledges PO
exports.acknowledgePO = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    purchaseOrder.status = "Acknowledged";
    purchaseOrder.acknowledgedDate = new Date();

    await purchaseOrder.save();

    res.status(200).json({
      success: true,
      message: "Purchase Order acknowledged successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error acknowledging PO:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge PO",
      error: error.message,
    });
  }
};

// Get all Purchase Orders
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, vendorId, siteId, startDate, endDate } = req.query;

    let query = {};

    if (status) query.status = status;
    if (vendorId) query.vendorId = vendorId;
    if (siteId) query.siteId = siteId;

    if (startDate && endDate) {
      query.poDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get orders with populate - but preserve original IDs for restaurant POs
    // First, get orders to identify restaurant POs and preserve their IDs
    const purchaseOrdersRaw = await PurchaseOrder.find(query)
      .select('vendorId siteId remarks poNumber')
      .lean();
    
    // Create a map of poNumber to original vendorId/siteId for restaurant POs
    const restaurantIdMap = {};
    purchaseOrdersRaw.forEach(order => {
      try {
        const remarksData = JSON.parse(order.remarks || '{}');
        if (remarksData.restaurantPO) {
          restaurantIdMap[order.poNumber] = {
            vendorId: order.vendorId?.toString() || order.vendorId,
            siteId: order.siteId?.toString() || order.siteId
          };
        }
      } catch (e) {
        // Not a restaurant PO
      }
    });
    
    // Now get full orders with populate
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate("purchaseRequestId", "prNumber")
      .populate("quotationId", "quotationNumber")
      .populate("vendorId", "vendorName vendorCode contactPerson phone")
      .populate("siteId", "siteName siteCode")
      .populate("createdBy", "name employeeId")
      .populate("approvedBy", "name employeeId")
      .sort({ poDate: -1 })
      .lean(); // Use lean() to get plain JavaScript objects
    
    // Process restaurant POs - extract store location from remarks and handle vendorId/siteId
    const processedOrders = purchaseOrders.map(order => {
      // Try to parse restaurant-specific data from remarks
      try {
        const remarksData = JSON.parse(order.remarks || '{}');
        if (remarksData.restaurantPO) {
          console.log(`Processing restaurant PO ${order.poNumber}:`, {
            vendorId: order.vendorId,
            siteId: order.siteId,
            vendorIdType: typeof order.vendorId,
            siteIdType: typeof order.siteId
          });
          
          order.storeLocationId = remarksData.storeLocationId;
          order.storeLocation = {
            id: remarksData.storeLocationId,
            name: remarksData.storeLocationName || remarksData.storeType
          };
          order.storeType = remarksData.storeType;
          
          // Extract items array from remarks if available
          if (remarksData.items && Array.isArray(remarksData.items)) {
            order.items = remarksData.items;
          }
          
          // For restaurant POs, vendorId and siteId won't be populated (they're Supplier/Branch IDs)
          // Mongoose populate() will return null if the ID doesn't exist in the referenced collection
          // Use the original IDs from restaurantIdMap
          const originalIds = restaurantIdMap[order.poNumber];
          if (originalIds) {
            // Check if populate failed (vendorId/siteId are null or don't have vendorName/siteName)
            if (!order.vendorId || (typeof order.vendorId === 'object' && !order.vendorId.vendorName)) {
              // Populate failed, use original ID
              order.vendorId = originalIds.vendorId;
              console.log(`✅ Using original vendorId for restaurant PO ${order.poNumber}:`, order.vendorId);
            } else if (typeof order.vendorId === 'object' && order.vendorId.vendorName) {
              // Successfully populated from Vendor model (construction PO)
              console.log(`vendorId populated from Vendor for PO ${order.poNumber}`);
            }
            
            if (!order.siteId || (typeof order.siteId === 'object' && !order.siteId.siteName)) {
              // Populate failed, use original ID
              order.siteId = originalIds.siteId;
              console.log(`✅ Using original siteId for restaurant PO ${order.poNumber}:`, order.siteId);
            } else if (typeof order.siteId === 'object' && order.siteId.siteName) {
              // Successfully populated from Site model (construction PO)
              console.log(`siteId populated from Site for PO ${order.poNumber}`);
            }
          }
        }
      } catch (e) {
        // Not a JSON remarks or not a restaurant PO, continue as normal
      }
      return order;
    });

    res.status(200).json({
      success: true,
      count: processedOrders.length,
      data: processedOrders,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase orders",
      error: error.message,
    });
  }
};

// Get Purchase Order by ID
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate("purchaseRequestId")
      .populate("quotationId")
      .populate("vendorId")
      .populate("siteId")
      .populate("createdBy", "name employeeId email")
      .populate("approvedBy", "name employeeId");

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase order",
      error: error.message,
    });
  }
};

// Update Purchase Order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order updated successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update purchase order",
      error: error.message,
    });
  }
};

// Cancel Purchase Order
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const { remarks } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    if (purchaseOrder.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed purchase order",
      });
    }

    purchaseOrder.status = "Cancelled";
    if (remarks) purchaseOrder.remarks = remarks;

    await purchaseOrder.save();

    res.status(200).json({
      success: true,
      message: "Purchase Order cancelled successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error cancelling purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel purchase order",
      error: error.message,
    });
  }
};

// Delete Purchase Order
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findByIdAndDelete(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete purchase order",
      error: error.message,
    });
  }
};


// Admin: Approve High-Value Purchase Order
exports.adminApprovePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalRemarks } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    if (purchaseOrder.status !== "Pending Approval") {
      return res.status(400).json({
        success: false,
        message: "Purchase order is not pending approval",
      });
    }

    // Update PO status
    purchaseOrder.status = "Approved";
    purchaseOrder.approvedBy = req.user?.id || null;
    purchaseOrder.approvedAt = new Date();
    purchaseOrder.approvalRemarks = approvalRemarks || "";

    await purchaseOrder.save();

    // Populate for response
    await purchaseOrder.populate([
      { path: "vendorId", select: "name email phone" },
      { path: "quotationId", select: "quotationNumber" },
      { path: "approvedBy", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Purchase order approved successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error approving purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve purchase order",
      error: error.message,
    });
  }
};

// Admin: Reject Purchase Order
exports.rejectPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionRemarks } = req.body;

    if (!rejectionRemarks) {
      return res.status(400).json({
        success: false,
        message: "Rejection remarks are required",
      });
    }

    const purchaseOrder = await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    if (purchaseOrder.status !== "Pending Approval") {
      return res.status(400).json({
        success: false,
        message: "Purchase order is not pending approval",
      });
    }

    // Update PO status
    purchaseOrder.status = "Rejected";
    purchaseOrder.rejectedBy = req.user?.id || null;
    purchaseOrder.rejectedAt = new Date();
    purchaseOrder.rejectionRemarks = rejectionRemarks;

    await purchaseOrder.save();

    // Populate for response
    await purchaseOrder.populate([
      { path: "vendorId", select: "name email phone" },
      { path: "quotationId", select: "quotationNumber" },
      { path: "rejectedBy", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Purchase order rejected",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error rejecting purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject purchase order",
      error: error.message,
    });
  }
};

// Get Purchase Orders Pending Approval
exports.getPendingApprovalPOs = async (req, res) => {
  try {
    const pendingPOs = await PurchaseOrder.find({ status: "Pending Approval" })
      .populate("vendorId", "name email phone")
      .populate("quotationId", "quotationNumber")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingPOs.length,
      data: pendingPOs,
    });
  } catch (error) {
    console.error("Error fetching pending approval POs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approval POs",
      error: error.message,
    });
  }
};

// Auto-close PO after payment
exports.closePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { closureRemarks } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    // Check if all invoices are paid
    const VendorInvoice = require("../models/VendorInvoice");
    const unpaidInvoices = await VendorInvoice.find({
      purchaseOrderId: id,
      paymentStatus: { $ne: "Paid" },
    });

    if (unpaidInvoices.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot close PO. There are unpaid invoices.",
        unpaidCount: unpaidInvoices.length,
      });
    }

    // Update PO status
    purchaseOrder.status = "Completed";
    purchaseOrder.completedAt = new Date();
    purchaseOrder.closureRemarks = closureRemarks || "Auto-closed after payment completion";

    await purchaseOrder.save();

    res.status(200).json({
      success: true,
      message: "Purchase order closed successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error closing purchase order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to close purchase order",
      error: error.message,
    });
  }
};
