const SubAdmin = require("../model/SubAdmin"); // Using SubAdmin model for login
const Admin = require("../model/adminModel"); // Main Admin model
const AuthUser = require("../model/User"); // New AuthUser model for restaurant users (exports as "AuthUser")
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

// LOGIN
exports.loginUser = async (req, res) => {
  try {
    const { email, password, type } = req.body; // Added type to request body for filtering

    // Log the incoming request for debugging
    console.log("Login attempt:", { email, type, hasPassword: !!password });

    // Validate input
    if (!email || !password || !type) {
      console.log("Missing fields:", { email: !!email, password: !!password, type: !!type });
      return res
        .status(400)
        .json({ message: "All fields (email, password, type) are required" });
    }

    // First, check if it's the main admin
    const admin = await Admin.findOne({ email });
    console.log("Admin lookup for email:", email, "Found:", !!admin);
    
    if (admin) {
      console.log("Admin found, comparing password...");
      
      // Check if admin has a designated type, if so, validate it matches
      if (admin.type && admin.type !== type) {
        console.log("Admin type mismatch. Expected:", admin.type, "Got:", type);
        return res.status(401).json({ 
          message: `Admin account found but incorrect CRM type selected. Expected type: ${admin.type}` 
        });
      }
      
      // Compare passwords for admin using the model's method
      const isMatch = await admin.comparePassword(password);
      console.log("Password match:", isMatch);
      
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid Admin Password" });
      }

      // Generate JWT token for admin with full access
      const token = jwt.sign(
        { userId: admin._id, email: admin.email, type: admin.type || type, isMainAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Return admin with all permissions set to true
      const allPermissions = {
        dashboard: true,
        salesManagement: true,
        purchaseManagement: true,
        inventoryManagement: true,
        menu: true,
        tableManagement: true,
        customerManagement: true,
        hrManagement: true,
        employee: true,
        hr: true,
        attendanceLeave: true,
        payroll: true,
        finance: true,
        reports: true,
        security: true,
        alerts: true,
        kitchenDisplay: true,
        POS: true,
        RestaurantDashboard: true,
        RestaurantSetup: true,
        MenuManagement: true,
        StockManagement: true,
        PurchaseManagement: true,
        OrderBilling: true,
        CustomerManagement: true,
        ReservationsManagement: true,
        KitchenManagement: true,
        HRManagement: true,
        ExpenseManagement: true,
        RestaurantAnalytics: true,
        SubAdmin: true,
        UserManagement: true,
        SiteManagement: true,
        allAccess: true,
      };

      return res.status(200).json({
        message: "Login successful",
        token,
        user: {
          _id: admin._id,
          username: "Main Admin",
          email: admin.email,
          type: admin.type || type,
          role: "Main Admin",
          permissions: allPermissions,
        },
      });
    }

    // If not admin, check AuthUser model first (new system)
    console.log("Checking AuthUser model for email:", email, "crmType:", type);
    let user = await AuthUser.findOne({ 
      email: email.toLowerCase().trim(),
      crmType: type.toLowerCase().trim()
    });
    
    let isNewUserModel = false;
    if (user) {
      console.log("User found in AuthUser model");
      isNewUserModel = true;
    } else {
      // If not found in AuthUser model, check SubAdmin (old system)
      console.log("Checking SubAdmin for email:", email, "type:", type);
      user = await SubAdmin.findOne({ 
        email: email.toLowerCase().trim(),
        type: type.toLowerCase().trim()
      });
      console.log("SubAdmin lookup result:", user ? "User found" : "User not found");
    }
    
    if (!user) {
      // Check if user exists with different type in either model
      const userWithEmailInAuthUserModel = await AuthUser.findOne({ email: email.toLowerCase().trim() });
      const userWithEmailInSubAdmin = await SubAdmin.findOne({ email: email.toLowerCase().trim() });
      
      if (userWithEmailInAuthUserModel) {
        console.log("User exists in AuthUser model but with different type:", userWithEmailInAuthUserModel.crmType);
        return res
          .status(401)
          .json({ 
            message: `User found but incorrect CRM type selected. Expected type: ${userWithEmailInAuthUserModel.crmType}` 
          });
      }
      
      if (userWithEmailInSubAdmin) {
        console.log("User exists in SubAdmin but with different type:", userWithEmailInSubAdmin.type);
        return res
          .status(401)
          .json({ 
            message: `User found but incorrect CRM type selected. Expected type: ${userWithEmailInSubAdmin.type}` 
          });
      }
      
      return res
        .status(401)
        .json({ message: "User not found or incorrect CRM type selected" });
    }

    // Compare passwords
    const isMatch = await bcryptjs.compare(password, user.password);
    console.log("Password match:", isMatch);
    
    if (!isMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(401).json({ message: "Invalid Password" });
    }

    // Check if user is active (only for SubAdmin model)
    if (!isNewUserModel && user.status === "inactive") {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact administrator." });
    }

    // Update last login (only for SubAdmin model)
    if (!isNewUserModel && user.lastLogin !== undefined) {
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT token
    const userType = isNewUserModel ? user.crmType : user.type;
    const token = jwt.sign(
      { userId: user._id, email: user.email, type: userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare permissions
    let permissions;
    if (isNewUserModel) {
      // For new User model, convert allowedModules array to permissions object
      permissions = {};
      if (user.allowedModules && Array.isArray(user.allowedModules)) {
        user.allowedModules.forEach(module => {
          permissions[module] = true;
        });
      }
    } else {
      // For SubAdmin model, use existing permissions object
      permissions = user.permissions;
    }

    // Success
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        username: user.username || user.name,
        name: user.name || user.username,
        email: user.email,
        type: userType,
        role: user.role,
        permissions: permissions,
        allowedModules: isNewUserModel ? user.allowedModules : undefined,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
