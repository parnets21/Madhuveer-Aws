const express = require("express");
const router = express.Router();
const grnController = require("../controllers/grnController");
const multer = require("multer");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/grn-verification/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "grn-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// GET all GRNs
router.get("/", grnController.getAllGRNs);

// POST create GRN
router.post("/", grnController.createGRN);

// POST verify GRN (Site Supervisor)
router.post("/verify", upload.array("photos", 5), grnController.verifyGRN);

// GET single GRN by _id
router.get("/:id", grnController.getGRNById);

// PUT update GRN
router.put("/:id", grnController.updateGRN);

// PUT update stock from GRN
router.put("/:id/update-stock", grnController.updateStockFromGRN);

// DELETE GRN by _id
router.delete("/:id", grnController.deleteGRN);

module.exports = router;
