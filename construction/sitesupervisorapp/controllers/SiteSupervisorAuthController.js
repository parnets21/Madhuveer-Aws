const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      employeeId: user.employeeId,
      phone: user.phone,
      role: user.mobileAppRole
    },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '30d' } // Token valid for 30 days
  );
};

// @desc    Register new site supervisor for mobile app
// @route   POST /api/v1/site-supervisor-app/register
// @access  Public (called from web admin)
exports.registerSupervisor = async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      phone,
      email,
      password,
      mobileAppRole,
      designation,
      department
    } = req.body;

    // Validation
    if (!employeeId || !employeeName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: employeeId, employeeName, phone, password'
      });
    }

    // Validate phone number format
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Check if already registered
    const existingUser = await SiteSupervisorAuth.findOne({
      $or: [{ phone }, { employeeId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.phone === phone 
          ? 'Phone number already registered' 
          : 'Employee already registered for mobile app'
      });
    }

    // Create new supervisor auth
    const supervisor = await SiteSupervisorAuth.create({
      employeeId,
      employeeName,
      phone,
      email,
      password, // Will be hashed by pre-save hook
      mobileAppRole: mobileAppRole || 'Site Supervisor',
      designation: designation || 'Site Supervisor',
      department: department || 'Site Management',
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Site supervisor registered successfully for mobile app',
      data: {
        employeeId: supervisor.employeeId,
        employeeName: supervisor.employeeName,
        phone: supervisor.phone,
        email: supervisor.email,
        mobileAppRole: supervisor.mobileAppRole,
        registeredAt: supervisor.registeredAt
      }
    });
  } catch (error) {
    console.error('Register supervisor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register supervisor',
      error: error.message
    });
  }
};

// @desc    Login with phone and password
// @route   POST /api/v1/site-supervisor-app/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { phone, password, deviceInfo } = req.body;

    // Validation
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number and password'
      });
    }

    // Validate phone format
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Find user by phone
    const user = await SiteSupervisorAuth.findOne({ phone });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    // Check if user has Site Supervisor role
    if (user.mobileAppRole !== 'Site Supervisor') {
      return res.status(403).json({
        success: false,
        message: `This app is only for Site Supervisors. Your role is "${user.mobileAppRole}". Please use the appropriate app for your role.`
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login and device info
    user.lastLogin = new Date();
    if (deviceInfo) {
      user.deviceInfo = deviceInfo;
    }
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Fetch assigned sites for this supervisor
    const Site = require('../../../model/Site');
    const Employee = require('../../../model/Employee');
    
    // Find the employee record by employeeId
    const employee = await Employee.findOne({ employeeId: user.employeeId });
    
    let assignedSites = [];
    if (employee) {
      // Find sites where this employee is assigned as supervisor
      // Exclude completed and cancelled sites from mobile app
      assignedSites = await Site.find({ 
        supervisors: employee._id,
        isActive: true,
        status: { $nin: ['Completed', 'Cancelled'] } // Don't show completed or cancelled sites
      })
      .select('siteCode siteName location status timeline budget')
      .lean();
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          employeeId: user.employeeId,
          employeeName: user.employeeName,
          phone: user.phone,
          email: user.email,
          mobileAppRole: user.mobileAppRole,
          designation: user.designation,
          department: user.department,
          lastLogin: user.lastLogin,
          assignedSites: assignedSites // Include assigned sites
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// @desc    Get user profile
// @route   GET /api/v1/site-supervisor-app/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await SiteSupervisorAuth.findById(req.user.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// @desc    Update password
// @route   PUT /api/v1/site-supervisor-app/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await SiteSupervisorAuth.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// @desc    Update FCM token for push notifications
// @route   PUT /api/v1/site-supervisor-app/fcm-token
// @access  Private
exports.updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    const user = await SiteSupervisorAuth.findByIdAndUpdate(
      req.user.userId,
      { fcmToken },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
      error: error.message
    });
  }
};

// @desc    Get all registered supervisors (for admin)
// @route   GET /api/v1/site-supervisor-app/registered
// @access  Public (called from web admin)
exports.getRegisteredSupervisors = async (req, res) => {
  try {
    const supervisors = await SiteSupervisorAuth.find()
      .select('-password')
      .sort({ registeredAt: -1 });

    res.status(200).json({
      success: true,
      count: supervisors.length,
      data: supervisors
    });
  } catch (error) {
    console.error('Get registered supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registered supervisors',
      error: error.message
    });
  }
};

// @desc    Delete supervisor registration
// @route   DELETE /api/v1/site-supervisor-app/registered/:id
// @access  Public (called from web admin)
exports.deleteSupervisor = async (req, res) => {
  try {
    const supervisor = await SiteSupervisorAuth.findByIdAndDelete(req.params.id);

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: 'Supervisor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supervisor registration deleted successfully'
    });
  } catch (error) {
    console.error('Delete supervisor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supervisor',
      error: error.message
    });
  }
};

// @desc    Get assigned sites for logged-in supervisor
// @route   GET /api/v1/sitesupervisor/assigned-sites
// @access  Protected
exports.getAssignedSites = async (req, res) => {
  try {
    const Site = require('../../../model/Site');
    const Employee = require('../../../model/Employee');
    
    // Find the employee record by employeeId
    const employee = await Employee.findOne({ employeeId: req.user.employeeId });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    // Find sites where this employee is assigned as supervisor
    // Exclude completed and cancelled sites from mobile app
    const assignedSites = await Site.find({ 
      supervisors: employee._id,
      isActive: true,
      status: { $nin: ['Completed', 'Cancelled'] } // Don't show completed or cancelled sites
    })
    .populate('projectManager', 'name employeeId email phone')
    .select('siteCode siteName location status timeline budget workersRequired workers description clientDetails')
    .lean();

    res.status(200).json({
      success: true,
      data: assignedSites
    });
  } catch (error) {
    console.error('Get assigned sites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned sites',
      error: error.message
    });
  }
};

// @desc    Update supervisor password (from web admin)
// @route   PUT /api/v1/site-supervisor-app/registered/:id/password
// @access  Public (called from web admin)
exports.updateSupervisorPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const supervisor = await SiteSupervisorAuth.findById(req.params.id);

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: 'Supervisor not found'
      });
    }

    supervisor.password = password; // Will be hashed by pre-save hook
    await supervisor.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update supervisor password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
      error: error.message
    });
  }
};
