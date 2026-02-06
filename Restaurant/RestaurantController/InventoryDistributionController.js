const InventoryDistribution = require('../model/InventoryDistribution');
const GoodsReceiptNote = require('../../model/GoodsReceiptNote');

// Create new distribution
exports.createDistribution = async (req, res) => {
  try {
    const { productName, quantityDistributed, branch, storeLocation } = req.body;
    
    // Create distribution record
    const distribution = new InventoryDistribution(req.body);
    await distribution.save();
    
    // Update GRN inventory - reduce available quantity and increase consumed quantity
    console.log(`🔍 Searching for GRNs with product: "${productName}", branch: "${branch}", storeLocation: "${storeLocation}"`);
    
    // Find GRN items that match the product and branch
    const grns = await GoodsReceiptNote.find({
      'items.product': productName,
      branch: branch,
    }).sort({ createdAt: 1 }); // FIFO - oldest first
    
    console.log(`📦 Found ${grns.length} GRNs matching criteria`);
    
    let remainingQtyToDistribute = quantityDistributed;
    
    // Update GRN items (FIFO - First In First Out)
    for (const grn of grns) {
      if (remainingQtyToDistribute <= 0) break;
      
      let grnModified = false;
      
      for (const item of grn.items) {
        console.log(`  Checking item: product="${item.product}", storeType="${item.storeType}", available=${item.availableQuantity}`);
        
        if (item.product === productName && 
            item.storeType === storeLocation && 
            item.availableQuantity > 0 &&
            remainingQtyToDistribute > 0) {
          
          const qtyToDeduct = Math.min(item.availableQuantity, remainingQtyToDistribute);
          
          item.consumedQuantity = (item.consumedQuantity || 0) + qtyToDeduct;
          item.availableQuantity = (item.availableQuantity || 0) - qtyToDeduct;
          
          remainingQtyToDistribute -= qtyToDeduct;
          grnModified = true;
          
          console.log(`✅ Updated GRN ${grn.grnNumber}: Product="${item.product}", Consumed +${qtyToDeduct}, New Available: ${item.availableQuantity}`);
        }
      }
      
      if (grnModified) {
        await grn.save();
        console.log(`💾 Saved GRN ${grn.grnNumber}`);
      }
    }
    
    if (remainingQtyToDistribute > 0) {
      console.warn(`⚠️ Warning: Could not distribute full quantity. Remaining: ${remainingQtyToDistribute}`);
    } else {
      console.log(`✅ Successfully distributed ${quantityDistributed} units`);
    }
    
    res.status(201).json({
      success: true,
      message: 'Distribution created successfully and inventory updated',
      data: distribution,
    });
  } catch (error) {
    console.error('Error creating distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating distribution',
      error: error.message,
    });
  }
};

// Get all distributions
exports.getAllDistributions = async (req, res) => {
  try {
    const distributions = await InventoryDistribution.find()
      .sort({ distributionDate: -1 });
    
    res.status(200).json({
      success: true,
      data: distributions,
    });
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching distributions',
      error: error.message,
    });
  }
};

// Get distributions by product
exports.getDistributionsByProduct = async (req, res) => {
  try {
    const { productName } = req.params;
    const distributions = await InventoryDistribution.find({ productName })
      .sort({ distributionDate: -1 });
    
    res.status(200).json({
      success: true,
      data: distributions,
    });
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching distributions',
      error: error.message,
    });
  }
};

// Delete distribution
exports.deleteDistribution = async (req, res) => {
  try {
    const { id } = req.params;
    await InventoryDistribution.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Distribution deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting distribution',
      error: error.message,
    });
  }
};
