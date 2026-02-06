const express = require('express');
const router = express.Router();
const uomController = require('../controller/resUOMController'); // Assuming the controller file is named uomController.js

// Create a new UOM
router.post('/', uomController.createUOM);

// Get all UOMs
router.get('/', uomController.getAllUOMs);

// Get a single UOM by ID
router.get('/:id', uomController.getUOMById);

// Update a UOM
router.put('/:id', uomController.updateUOM);

// Delete a UOM
router.delete('/:id', uomController.deleteUOM);

module.exports = router;