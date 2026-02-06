const express = require("express")
const router = express.Router()
const quotationController = require("../controller/quotationController")

router.get("/", quotationController.getAllQuotations)
router.post("/", quotationController.createQuotation)
router.get("/:id", quotationController.getQuotation)
router.put("/:id", quotationController.updateQuotation)
router.delete("/:id", quotationController.deleteQuotation)

module.exports = router
