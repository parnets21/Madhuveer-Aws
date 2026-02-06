const Role = require("../models/Role");

// Get all roles
exports.getRoles = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = type ? { type, status: "active" } : { status: "active" };
    
    const roles = await Role.find(filter).sort({ isDefault: -1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (err) {
    console.error("Get roles error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    res.status(200).json({ success: true, data: role });
  } catch (err) {
    console.error("Get role error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Create role
exports.createRole = async (req, res) => {
  try {
    const { name, value, description, type } = req.body;
    
    // Validation
    if (!name || !value || !type) {
      return res.status(400).json({ 
        message: "Name, value, and type are required" 
      });
    }

    // Check if value already exists
    const existing = await Role.findOne({ value: value.toLowerCase(), type });
    if (existing) {
      return res.status(409).json({ 
        message: "Role with this value already exists" 
      });
    }

    const newRole = new Role({
      name,
      value: value.toLowerCase(),
      description,
      type,
      isDefault: false,
      status: "active",
    });
    
    await newRole.save();
    
    res.status(201).json({ 
      success: true,
      message: "Role created successfully", 
      data: newRole 
    });
  } catch (err) {
    console.error("Create role error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { name, value, description, status } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent updating default roles' value
    if (role.isDefault && value && value !== role.value) {
      return res.status(400).json({ 
        message: "Cannot change value of default roles" 
      });
    }

    // Check if new value already exists
    if (value && value !== role.value) {
      const existing = await Role.findOne({ 
        value: value.toLowerCase(), 
        type: role.type,
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(409).json({ 
          message: "Role with this value already exists" 
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (value) updateData.value = value.toLowerCase();
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;
    
    const updated = await Role.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({ 
      success: true,
      message: "Role updated successfully", 
      data: updated 
    });
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent deleting default roles
    if (role.isDefault) {
      return res.status(400).json({ 
        message: "Cannot delete default roles" 
      });
    }

    // Check if role is being used by any users
    const SubAdmin = require("../../model/SubAdmin");
    const usersWithRole = await SubAdmin.countDocuments({ role: role.value });
    
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} user(s) are assigned this role.` 
      });
    }

    await Role.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      success: true,
      message: "Role deleted successfully" 
    });
  } catch (err) {
    console.error("Delete role error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
