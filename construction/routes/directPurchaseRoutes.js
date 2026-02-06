const express = require("express");
const router = express.Router();
const directPurchaseController = require("../controllers/directPurchaseController");

// Create direct purchase (auto-generates Indent, Quotation, PO, GRN)
router.post("/", directPurchaseController.createDirectPurchase);

// Get all direct purchases
router.get("/", directPurchaseController.getDirectPurchases);

// Get direct purchase details with all linked documents
router.get("/:indentId", directPurchaseController.getDirectPurchaseDetails);

module.exports = router;
