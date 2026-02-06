const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    materialName: {
      type: String,
      required: true,
      unique: true,
    },
    materialCode: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    category: {
      type: String,
      required: true,
      enum: ["Cement", "Steel", "Sand", "Aggregate", "Bricks", "Tiles", "Paint", "Electrical", "Plumbing", "Other"],
    },
    unit: {
      type: String,
      required: true,
      enum: ["Bags", "Tons", "Cubic Meter", "Pieces", "Kg", "Liters", "Meters", "Square Feet", "Other"],
    },
    currentStock: {
      type: Number,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      required: true,
      default: 10,
    },
    warehouse: {
      type: String,
      default: "Central Warehouse",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    averageRate: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to check if stock is below reorder level
inventorySchema.methods.isLowStock = function () {
  return this.currentStock <= this.reorderLevel;
};

module.exports = mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema);
