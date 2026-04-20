const express = require('express');
const db = require('../database/connection');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all field agents (admin only)
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
    try {
        // Get all field agents
        const agentsResult = await db.query(
            'SELECT id, name, email, created_at FROM users WHERE role = ? ORDER BY name',
            ['field_agent']
        );
        
        // Get field counts for each agent
        const fieldsResult = await db.query(
            'SELECT assigned_agent_id, COUNT(*) as count FROM fields WHERE assigned_agent_id IS NOT NULL GROUP BY assigned_agent_id'
        );
        
        const agentFieldCounts = {};
        fieldsResult.rows.forEach(row => {
            agentFieldCounts[row.assigned_agent_id] = row.count;
        });
        
        const agents = agentsResult.rows.map(agent => ({
            ...agent,
            assigned_fields_count: agentFieldCounts[agent.id] || 0
        }));
        
        res.json({ agents });
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
        const agentResult = await db.query(
            'SELECT id, name, email, created_at FROM users WHERE id = ? AND role = ?',
            [id, 'field_agent']
        );
        
        if (agentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const agent = agentResult.rows[0];
        
        // Get assigned fields
        const fieldsResult = await db.query(
            'SELECT * FROM fields WHERE assigned_agent_id = ? ORDER BY created_at DESC',
            [id]
        );
        
        res.json({ agent, fields: fieldsResult.rows });
    } catch (error) {
        console.error('Get agent error:', error);
        res.status(500).json({ error: 'Failed to retrieve agent' });
    }
});

module.exports = router;
