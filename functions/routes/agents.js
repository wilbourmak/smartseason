const express = require('express');
const db = require('../database/connection');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all field agents (admin only)
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const agentsSnapshot = await db.firestore.collection('users')
            .where('role', '==', 'field_agent')
            .orderBy('name')
            .get();
        
        // Get field counts for each agent
        const allFieldsSnapshot = await db.firestore.collection('fields').get();
        const agentFieldCounts = {};
        
        allFieldsSnapshot.docs.forEach(doc => {
            const agentId = doc.data().assigned_agent_id;
            if (agentId) {
                agentFieldCounts[agentId] = (agentFieldCounts[agentId] || 0) + 1;
            }
        });
        
        const agents = agentsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                email: data.email,
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at,
                assigned_fields_count: agentFieldCounts[doc.id] || 0
            };
        });
        
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
        const agentDoc = await db.firestore.collection('users').doc(id).get();
        
        if (!agentDoc.exists) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const agentData = agentDoc.data();
        
        if (agentData.role !== 'field_agent') {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const agent = {
            id: agentDoc.id,
            name: agentData.name,
            email: agentData.email,
            created_at: agentData.created_at?.toDate?.().toISOString() || agentData.created_at
        };
        
        // Get assigned fields
        const fieldsSnapshot = await db.firestore.collection('fields')
            .where('assigned_agent_id', '==', id)
            .orderBy('created_at', 'desc')
            .get();
        
        const fields = fieldsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                planting_date: data.planting_date || data.plantingDate,
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at,
                updated_at: data.updated_at?.toDate?.().toISOString() || data.updated_at
            };
        });
        
        res.json({ agent, fields });
    } catch (error) {
        console.error('Get agent error:', error);
        res.status(500).json({ error: 'Failed to retrieve agent' });
    }
});

module.exports = router;
