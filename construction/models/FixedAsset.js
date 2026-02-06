const mongoose = require("mongoose");

const fixedAssetSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    assetCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      // User can enter manually: Vehicle, Machine, Equipment, Tools, Furniture, etc.
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    dateOfPurchase: {
      type: Date,
      required: true,
    },
    invoiceUrl: {
      type: String,
      default: null,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    depreciationPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 10,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    accumulatedDepreciation: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Sold", "Disposed", "Under Maintenance"],
      default: "Active",
    },
    vendor: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to calculate total value and current value
fixedAssetSchema.pre("save", function (next) {
  // Calculate total value
  this.totalValue = this.quantity * this.value;

  // Calculate depreciation based on years since purchase
  const purchaseDate = new Date(this.dateOfPurchase);
  const now = new Date();
  const yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

  // Calculate accumulated depreciation (straight-line method)
  const annualDepreciation = (this.totalValue * this.depreciationPercentage) / 100;
  this.accumulatedDepreciation = Math.min(
    annualDepreciation * yearsOwned,
    this.totalValue
  );

  // Calculate current value (book value)
  this.currentValue = Math.max(this.totalValue - this.accumulatedDepreciation, 0);

  next();
});

// Method to calculate current depreciation
fixedAssetSchema.methods.calculateDepreciation = function () {
  const purchaseDate = new Date(this.dateOfPurchase);
  const now = new Date();
  const yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

  const annualDepreciation = (this.totalValue * this.depreciationPercentage) / 100;
  const accumulatedDepreciation = Math.min(
    annualDepreciation * yearsOwned,
    this.totalValue
  );
  const currentValue = Math.max(this.totalValue - accumulatedDepreciation, 0);

  return {
    totalValue: this.totalValue,
    annualDepreciation,
    accumulatedDepreciation,
    currentValue,
    yearsOwned: Math.floor(yearsOwned),
  };
};

module.exports = mongoose.models.FixedAsset || mongoose.model("FixedAsset", fixedAssetSchema);
