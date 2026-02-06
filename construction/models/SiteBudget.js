const mongoose = require("mongoose");

const siteBudgetSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    budgetPeriod: {
      type: String,
      enum: ["Monthly", "Quarterly", "Yearly"],
      default: "Monthly",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    pettyCashBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    majorExpenseBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    spentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBudget: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: false, // Made optional for now
    },
  },
  {
    timestamps: true,
  }
);

// Calculate remaining budget before saving
siteBudgetSchema.pre("save", function (next) {
  this.remainingBudget = this.totalBudget - this.spentAmount;
  next();
});

// Indexes
siteBudgetSchema.index({ siteId: 1, isActive: 1 });
siteBudgetSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.models.SiteBudget || mongoose.model("SiteBudget", siteBudgetSchema);
