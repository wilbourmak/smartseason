const express = require('express');
const {
    getFields,
    getField,
    createField,
    updateField,
    deleteField,
    addFieldUpdate,
    getDashboard
} = require('../controllers/fieldController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Dashboard
router.get('/dashboard', getDashboard);

// Field routes
router.get('/', getFields);
router.get('/:id', getField);
router.post('/', authorizeAdmin, createField);
router.put('/:id', authorizeAdmin, updateField);
router.delete('/:id', authorizeAdmin, deleteField);

// Field updates (available to both admin and field agents)
router.post('/:id/updates', addFieldUpdate);

module.exports = router;
