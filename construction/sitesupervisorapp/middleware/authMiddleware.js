const jwt = require('jsonwebtoken');
const SiteSupervisorAuth = require('../models/SiteSupervisorAuthModel');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login to access this resource.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

      // Get user from token
      const user = await SiteSupervisorAuth.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Token is invalid.'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.status}. Please contact administrator.`
        });
      }

      // Fetch assigned site for this supervisor
      const Site = require('../../../model/Site');
      const Employee = require('../../../model/Employee');
      
      const employee = await Employee.findOne({ employeeId: user.employeeId });
      let assignedSite = null;
      
      if (employee) {
        // Find the first active site where this employee is assigned as supervisor
        assignedSite = await Site.findOne({ 
          supervisors: employee._id,
          isActive: true 
        }).select('_id siteCode siteName');
      }

      // Attach user to request with site info
      req.user = {
        ...decoded,
        siteId: assignedSite?._id,
        siteCode: assignedSite?.siteCode,
        siteName: assignedSite?.siteName
      };
      req.userDoc = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired. Please login again.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Check if user has specific role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this resource`
      });
    }
    next();
  };
};
