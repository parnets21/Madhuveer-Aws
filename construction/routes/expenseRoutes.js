const express = require("express");
const router = express.Router();
const pettyCashController = require("../controllers/pettyCashExpenseController");
const majorExpenseController = require("../controllers/majorExpenseController");
const budgetController = require("../controllers/budgetController");

// Petty Cash Expense Routes
router.post("/petty-cash", pettyCashController.createPettyCashExpense);
router.get("/petty-cash", pettyCashController.getAllPettyCashExpenses);
router.get("/petty-cash/summary", pettyCashController.getExpenseSummary);
router.get("/petty-cash/:id", pettyCashController.getPettyCashExpenseById);
router.put("/petty-cash/:id", pettyCashController.updatePettyCashExpense);
router.delete("/petty-cash/:id", pettyCashController.deletePettyCashExpense);
router.post("/petty-cash/:id/approve", pettyCashController.approvePettyCashExpense);
router.post("/petty-cash/:id/reject", pettyCashController.rejectPettyCashExpense);

// Major Expense Routes
router.post("/major", majorExpenseController.createMajorExpense);
router.get("/major", majorExpenseController.getAllMajorExpenses);
router.get("/major/summary", majorExpenseController.getMajorExpenseSummary);
router.get("/major/:id", majorExpenseController.getMajorExpenseById);
router.put("/major/:id", majorExpenseController.updateMajorExpense);
router.delete("/major/:id", majorExpenseController.deleteMajorExpense);
router.post("/major/:id/approve", majorExpenseController.approveMajorExpense);
router.post("/major/:id/reject", majorExpenseController.rejectMajorExpense);
router.post("/major/:id/payment", majorExpenseController.recordPayment);

// Budget Routes
router.post("/budget", budgetController.createOrUpdateBudget);
router.get("/budget", budgetController.getAllBudgets);
router.get("/budget/summary", budgetController.getAllSitesBudgetSummary);
router.get("/budget/site/:siteId", budgetController.getBudgetBySite);
router.get("/budget/:id", budgetController.getBudgetById);
router.put("/budget/:id", budgetController.updateBudget);
router.post("/budget/:id/deactivate", budgetController.deactivateBudget);

module.exports = router;
