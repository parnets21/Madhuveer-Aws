const Labour = require('../models/LabourModel');

// Register new labour
exports.registerLabour = async (req, res) => {
  try {
    const { name, phone, aadharNumber, address, trade, skillLevel, dailyWage, siteId, siteName, remarks } = req.body;
    
    // Validate required fields
    if (!name || !phone || !trade || !dailyWage || !siteId || !siteName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }
    
    // Get photo path if uploaded
    const photoUrl = req.file ? `/uploads/labour/${req.file.filename}` : null;
    
    // Check if phone already exists for this supervisor
    const existingLabour = await Labour.findOne({ 
      phone, 
      supervisorId: req.user.employeeId,
      status: { $ne: 'left' }
    });
    
    if (existingLabour) {
      return res.status(400).json({
        success: false,
        message: 'Labour with this phone number already exists',
      });
    }
    
    // Generate labour ID
    const labourId = await Labour.generateLabourId();
    
    // Create labour
    const labour = await Labour.create({
      labourId,
      name,
      phone,
      photo: photoUrl,
      aadharNumber,
      address,
      trade,
      skillLevel: skillLevel || 'Unskilled',
      dailyWage,
      siteId,
      siteName,
      supervisorId: req.user.employeeId || req.userDoc.employeeId,
      supervisorName: req.userDoc.employeeName || req.user.name || 'Site Supervisor',
      remarks,
    });
    
    res.status(201).json({
      success: true,
      message: 'Labour registered successfully',
      data: labour,
    });
    
  } catch (error) {
    console.error('Register labour error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register labour',
      error: error.message,
    });
  }
};

// Get all labourers for supervisor
exports.getLabourList = async (req, res) => {
  try {
    const { status, trade, siteId, search } = req.query;
    
    // Build query
    const query = { supervisorId: req.user.employeeId };
    
    if (status) query.status = status;
    if (trade) query.trade = trade;
    if (siteId) query.siteId = siteId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { labourId: { $regex: search, $options: 'i' } },
      ];
    }
    
    const labourers = await Labour.find(query).sort({ createdAt: -1 });
    
    // Get statistics
    const stats = {
      total: labourers.length,
      active: labourers.filter(l => l.status === 'active').length,
      inactive: labourers.filter(l => l.status === 'inactive').length,
      left: labourers.filter(l => l.status === 'left').length,
    };
    
    res.json({
      success: true,
      data: labourers,
      stats,
    });
    
  } catch (error) {
    console.error('Get labour list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labour list',
      error: error.message,
    });
  }
};

// Get single labour details
exports.getLabourById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const labour = await Labour.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: 'Labour not found',
      });
    }
    
    res.json({
      success: true,
      data: labour,
    });
    
  } catch (error) {
    console.error('Get labour error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labour details',
      error: error.message,
    });
  }
};

// Update labour details
exports.updateLabour = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get photo path if uploaded
    if (req.file) {
      updates.photo = `/uploads/labour/${req.file.filename}`;
    }
    
    // Don't allow updating certain fields
    delete updates.labourId;
    delete updates.supervisorId;
    delete updates.supervisorName;
    delete updates.totalDaysWorked;
    delete updates.totalPaymentReceived;
    delete updates.pendingPayment;
    delete updates.advanceGiven;
    
    const labour = await Labour.findOneAndUpdate(
      { _id: id, supervisorId: req.user.employeeId },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: 'Labour not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Labour updated successfully',
      data: labour,
    });
    
  } catch (error) {
    console.error('Update labour error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update labour',
      error: error.message,
    });
  }
};

// Delete labour (soft delete - mark as left)
exports.deleteLabour = async (req, res) => {
  try {
    const { id } = req.params;
    
    const labour = await Labour.findOneAndUpdate(
      { _id: id, supervisorId: req.user.employeeId },
      { 
        status: 'left',
        leavingDate: new Date(),
      },
      { new: true }
    );
    
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: 'Labour not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Labour marked as left',
      data: labour,
    });
    
  } catch (error) {
    console.error('Delete labour error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete labour',
      error: error.message,
    });
  }
};

// Get labour statistics
exports.getLabourStats = async (req, res) => {
  try {
    const supervisorId = req.user.employeeId;
    
    const labourers = await Labour.find({ supervisorId });
    
    // Calculate statistics
    const stats = {
      total: labourers.length,
      active: labourers.filter(l => l.status === 'active').length,
      inactive: labourers.filter(l => l.status === 'inactive').length,
      left: labourers.filter(l => l.status === 'left').length,
      
      // By trade
      byTrade: {},
      
      // Financial
      totalPendingPayment: 0,
      totalAdvanceGiven: 0,
      totalPaymentMade: 0,
      
      // Average wage
      averageDailyWage: 0,
    };
    
    // Calculate trade-wise distribution
    labourers.forEach(labour => {
      if (!stats.byTrade[labour.trade]) {
        stats.byTrade[labour.trade] = 0;
      }
      stats.byTrade[labour.trade]++;
      
      // Financial stats
      stats.totalPendingPayment += labour.pendingPayment || 0;
      stats.totalAdvanceGiven += labour.advanceGiven || 0;
      stats.totalPaymentMade += labour.totalPaymentReceived || 0;
    });
    
    // Calculate average wage
    const activeLabourers = labourers.filter(l => l.status === 'active');
    if (activeLabourers.length > 0) {
      const totalWage = activeLabourers.reduce((sum, l) => sum + l.dailyWage, 0);
      stats.averageDailyWage = Math.round(totalWage / activeLabourers.length);
    }
    
    res.json({
      success: true,
      data: stats,
    });
    
  } catch (error) {
    console.error('Get labour stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labour statistics',
      error: error.message,
    });
  }
};

// Record payment for labour
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentType, paymentMethod, remarks } = req.body;
    
    // Validate
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid amount',
      });
    }
    
    const labour = await Labour.findOne({
      _id: id,
      supervisorId: req.user.employeeId,
    });
    
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: 'Labour not found',
      });
    }
    
    // Update payment fields
    labour.totalPaymentReceived = (labour.totalPaymentReceived || 0) + amount;
    
    // If it's an advance, add to advance given
    if (paymentType === 'advance') {
      labour.advanceGiven = (labour.advanceGiven || 0) + amount;
    }
    
    // Calculate pending payment (total earned - total received)
    const totalEarned = (labour.totalDaysWorked || 0) * labour.dailyWage;
    labour.pendingPayment = totalEarned - labour.totalPaymentReceived;
    
    // Add to payment history (if you have a payment history array)
    if (!labour.paymentHistory) {
      labour.paymentHistory = [];
    }
    labour.paymentHistory.push({
      amount,
      paymentType: paymentType || 'salary',
      paymentMethod: paymentMethod || 'cash',
      remarks: remarks || '',
      date: new Date(),
      recordedBy: req.userDoc.employeeName || 'Supervisor',
    });
    
    await labour.save();
    
    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: labour,
    });
    
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message,
    });
  }
};

// Get all labourers (for admin)
exports.getAllLabour = async (req, res) => {
  try {
    const { status, trade, siteId, supervisorId, page = 1, limit = 50 } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (trade) query.trade = trade;
    if (siteId) query.siteId = siteId;
    if (supervisorId) query.supervisorId = supervisorId;
    
    const skip = (page - 1) * limit;
    
    const labourers = await Labour.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Labour.countDocuments(query);
    
    res.json({
      success: true,
      data: labourers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Get all labour error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labour data',
      error: error.message,
    });
  }
};
