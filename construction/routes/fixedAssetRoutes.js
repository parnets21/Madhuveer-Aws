const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fixedAssetController = require("../controllers/fixedAssetController");

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, "..", "..", "uploads", "fixed-assets");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for invoice uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `invoice-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images and PDFs
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, gif) and PDF files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware to handle Multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: "File upload error",
      error: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Fixed Asset CRUD operations
router.post("/", upload.single("invoice"), handleMulterError, fixedAssetController.addFixedAsset);
router.get("/", fixedAssetController.getAllFixedAssets);
router.get("/summary", fixedAssetController.getFixedAssetsSummary);
router.get("/depreciation-report", fixedAssetController.getDepreciationReport);
router.get("/:id", fixedAssetController.getFixedAssetById);
router.put("/:id", upload.single("invoice"), handleMulterError, fixedAssetController.updateFixedAsset);
router.delete("/:id", fixedAssetController.deleteFixedAsset);

module.exports = router;
