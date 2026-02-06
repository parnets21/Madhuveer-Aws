const express = require("express");
const router = express.Router();
const vendorInvoiceController = require("../controllers/vendorInvoiceController");

// GET all vendor invoices
router.get("/", vendorInvoiceController.getAllInvoices);

// POST create a new vendor invoice
router.post("/", vendorInvoiceController.createVendorInvoice);

// GET a single vendor invoice by ID
router.get("/:id", vendorInvoiceController.getInvoiceById);

// PUT update a vendor invoice
router.put("/:id", vendorInvoiceController.updateInvoice);

// DELETE a vendor invoice
router.delete("/:id", vendorInvoiceController.deleteInvoice);

// PUT record payment
router.put("/:id/record-payment", vendorInvoiceController.recordPayment);

// PUT verify invoice
router.put("/:id/verify", vendorInvoiceController.verifyInvoice);

// GET pending payments
router.get("/pending/payments", vendorInvoiceController.getPendingPayments);

// GET overdue payments
router.get("/overdue/payments", vendorInvoiceController.getOverduePayments);

module.exports = router;





