const mongoose = require("mongoose");

const pettyCashExpenseSchema = new mongoose.Schema(
  {
    expenseNumber: {
      type: String,
      unique: true,
      required: true,
    },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: false, // Made optional for now
    },
    category: {
      type: String,
      enum: ["Food", "Transportation", "Tools", "Materials", "Labor", "Miscellaneous", "Other"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    receiptImages: [
      {
        type: String, // Cloudinary URLs
      },
    ],
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    approvalDate: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
pettyCashExpenseSchema.index({ siteId: 1, status: 1 });
pettyCashExpenseSchema.index({ submittedBy: 1 });
pettyCashExpenseSchema.index({ date: -1 });
// expenseNumber index is automatically created by unique: true constraint

module.exports = mongoose.models.PettyCashExpense || mongoose.model("PettyCashExpense", pettyCashExpenseSchema);
