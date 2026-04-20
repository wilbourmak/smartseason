const express = require('express');
const pool = require('../database/connection');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all field agents (admin only)
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.created_at,
                   COUNT(f.id) as assigned_fields_count
            FROM users u
            LEFT JOIN fields f ON u.id = f.assigned_agent_id
            WHERE u.role = 'field_agent'
            GROUP BY u.id, u.name, u.email, u.created_at
            ORDER BY u.name
        `);
        
        res.json({ agents: result.rows });
    } catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({ error: 'Failed to retrieve agents' });
    }
});

// Get single agent with their fields
router.get('/:id', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get agent info
        const agentResult = await pool.query(
            'SELECT id, name, email, created_at FROM users WHERE id = ? AND role = ?',
            [id, 'field_agent']
        );
        
        if (agentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        // Get assigned fields
        const fieldsResult = await pool.query(
            'SELECT * FROM fields WHERE assigned_agent_id = ? ORDER BY created_at DESC',
            [id]
        );
        
        res.json({
            agent: agentResult.rows[0],
            fields: fieldsResult.rows
        });
    } catch (error) {
        console.error('Get agent error:', error);
        res.status(500).json({ error: 'Failed to retrieve agent' });
    }
});

module.exports = router;
