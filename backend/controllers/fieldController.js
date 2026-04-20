const db = require('../database/connection');

// Field stages lifecycle
const STAGES = ['planted', 'growing', 'ready', 'harvested'];

// Compute field status based on data
const computeFieldStatus = (field) => {
    // Completed: harvested stage
    if (field.current_stage === 'harvested') {
        return 'completed';
    }
    
    // Calculate days since planting
    const plantingDate = new Date(field.planting_date);
    const today = new Date();
    const daysSincePlanting = Math.floor((today - plantingDate) / (1000 * 60 * 60 * 24));
    
    // At Risk logic:
    if (field.current_stage === 'planted' && daysSincePlanting > 14) {
        return 'at_risk';
    }
    if (field.current_stage === 'growing' && daysSincePlanting > 120) {
        return 'at_risk';
    }
    if (field.current_stage === 'ready' && daysSincePlanting > 150) {
        return 'at_risk';
    }
    
    // Default: Active
    return 'active';
};

// Get all fields (admin) or assigned fields (field agent)
const getFields = async (req, res) => {
    try {
        let sql;
        let params = [];
        
        if (req.user.role === 'admin') {
            // Admin sees all fields
            sql = `SELECT f.*, u.name as agent_name 
                   FROM fields f 
                   LEFT JOIN users u ON f.assigned_agent_id = u.id 
                   ORDER BY f.created_at DESC`;
        } else {
            // Field agent sees only assigned fields
            sql = `SELECT f.*, u.name as agent_name 
                   FROM fields f 
                   LEFT JOIN users u ON f.assigned_agent_id = u.id 
                   WHERE f.assigned_agent_id = ? 
                   ORDER BY f.created_at DESC`;
            params = [req.user.id];
        }
        
        const result = await db.query(sql, params);
        
        // Add computed status to each field
        const fields = result.rows.map(field => ({
            ...field,
            status: computeFieldStatus(field)
        }));
        
        res.json({ fields });
    } catch (error) {
        console.error('Get fields error:', error);
        res.status(500).json({ error: 'Failed to fetch fields' });
    }
};

// Get single field
const getField = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get field with agent info
        const fieldResult = await db.query(
            `SELECT f.*, u.name as agent_name, u.email as agent_email
             FROM fields f
             LEFT JOIN users u ON f.assigned_agent_id = u.id
             WHERE f.id = ?`,
            [id]
        );
        
        if (fieldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const field = fieldResult.rows[0];
        
        // Check permissions
        if (req.user.role !== 'admin' && field.assigned_agent_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get field updates
        const updatesResult = await db.query(
            `SELECT fu.*, u.name as agent_name
             FROM field_updates fu
             JOIN users u ON fu.agent_id = u.id
             WHERE fu.field_id = ?
             ORDER BY fu.created_at DESC`,
            [id]
        );
        
        const fieldData = {
            ...field,
            status: computeFieldStatus(field),
            updates: updatesResult.rows
        };
        
        res.json({ field: fieldData });
    } catch (error) {
        console.error('Get field error:', error);
        res.status(500).json({ error: 'Failed to fetch field' });
    }
};

// Create field
const createField = async (req, res) => {
    try {
        const { name, crop_type, planting_date, assigned_agent_id } = req.body;
        
        // Validation
        if (!name || !crop_type || !planting_date) {
            return res.status(400).json({ error: 'Name, crop type, and planting date are required' });
        }
        
        // Check if agent exists if assigned
        if (assigned_agent_id) {
            const agentResult = await db.query(
                'SELECT id FROM users WHERE id = ? AND role = ?',
                [assigned_agent_id, 'field_agent']
            );
            
            if (agentResult.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
        }
        
        // Create field
        const result = await db.query(
            `INSERT INTO fields (name, crop_type, planting_date, current_stage, assigned_agent_id)
             VALUES (?, ?, ?, 'planted', ?)`,
            [name, crop_type, planting_date, assigned_agent_id || null]
        );
        
        const newFieldId = result.rows[0].id;
        
        // Get agent name for response
        let agentName = null;
        if (assigned_agent_id) {
            const agentResult = await db.query(
                'SELECT name FROM users WHERE id = ?',
                [assigned_agent_id]
            );
            agentName = agentResult.rows[0]?.name || null;
        }
        
        res.status(201).json({
            message: 'Field created successfully',
            field: {
                id: newFieldId,
                name,
                crop_type,
                planting_date,
                current_stage: 'planted',
                assigned_agent_id: assigned_agent_id || null,
                agent_name: agentName
            }
        });
    } catch (error) {
        console.error('Create field error:', error);
        res.status(500).json({ error: 'Failed to create field' });
    }
};

// Update field
const updateField = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, crop_type, planting_date, assigned_agent_id } = req.body;
        
        // Check if field exists
        const fieldResult = await db.query(
            'SELECT * FROM fields WHERE id = ?',
            [id]
        );
        
        if (fieldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const currentData = fieldResult.rows[0];
        
        // Check if agent exists if assigned
        if (assigned_agent_id) {
            const agentResult = await db.query(
                'SELECT id FROM users WHERE id = ? AND role = ?',
                [assigned_agent_id, 'field_agent']
            );
            
            if (agentResult.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
        }
        
        // Build update query
        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (crop_type !== undefined) {
            updates.push('crop_type = ?');
            params.push(crop_type);
        }
        if (planting_date !== undefined) {
            updates.push('planting_date = ?');
            params.push(planting_date);
        }
        if (assigned_agent_id !== undefined) {
            updates.push('assigned_agent_id = ?');
            params.push(assigned_agent_id);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        params.push(id);
        
        await db.query(
            `UPDATE fields SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        // Get updated field with agent info
        const updatedResult = await db.query(
            `SELECT f.*, u.name as agent_name
             FROM fields f
             LEFT JOIN users u ON f.assigned_agent_id = u.id
             WHERE f.id = ?`,
            [id]
        );
        
        const updatedField = {
            ...updatedResult.rows[0],
            status: computeFieldStatus(updatedResult.rows[0])
        };
        
        res.json({
            message: 'Field updated successfully',
            field: updatedField
        });
    } catch (error) {
        console.error('Update field error:', error);
        res.status(500).json({ error: 'Failed to update field' });
    }
};

// Delete field
const deleteField = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if field exists
        const fieldResult = await db.query(
            'SELECT id FROM fields WHERE id = ?',
            [id]
        );
        
        if (fieldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        // Delete related updates first (cascade)
        await db.query('DELETE FROM field_updates WHERE field_id = ?', [id]);
        
        // Delete field
        await db.query('DELETE FROM fields WHERE id = ?', [id]);
        
        res.json({ message: 'Field deleted successfully' });
    } catch (error) {
        console.error('Delete field error:', error);
        res.status(500).json({ error: 'Failed to delete field' });
    }
};

// Add field update
const addFieldUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, notes } = req.body;
        
        // Validation
        if (!stage) {
            return res.status(400).json({ error: 'Stage is required' });
        }
        
        if (!STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }
        
        // Check if field exists and belongs to agent
        const fieldResult = await db.query(
            'SELECT * FROM fields WHERE id = ?',
            [id]
        );
        
        if (fieldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const field = fieldResult.rows[0];
        
        if (req.user.role !== 'admin' && field.assigned_agent_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Add field update
        const updateResult = await db.query(
            `INSERT INTO field_updates (field_id, agent_id, stage, notes)
             VALUES (?, ?, ?, ?)`,
            [id, req.user.id, stage, notes || null]
        );
        
        // Update field current stage
        await db.query(
            'UPDATE fields SET current_stage = ? WHERE id = ?',
            [stage, id]
        );
        
        res.status(201).json({
            message: 'Field update added successfully',
            update: {
                id: updateResult.rows[0].id,
                field_id: id,
                agent_id: req.user.id,
                stage,
                notes: notes || null
            }
        });
    } catch (error) {
        console.error('Add field update error:', error);
        res.status(500).json({ error: 'Failed to add field update' });
    }
};

// Get dashboard data
const getDashboard = async (req, res) => {
    try {
        // Get fields
        let fieldsSql;
        let fieldsParams = [];
        
        if (req.user.role === 'admin') {
            fieldsSql = 'SELECT * FROM fields';
        } else {
            fieldsSql = 'SELECT * FROM fields WHERE assigned_agent_id = ?';
            fieldsParams = [req.user.id];
        }
        
        const fieldsResult = await db.query(fieldsSql, fieldsParams);
        const fields = fieldsResult.rows;
        
        // Calculate stats
        let activeCount = 0, atRiskCount = 0, completedCount = 0;
        
        fields.forEach(field => {
            const status = computeFieldStatus(field);
            if (status === 'active') activeCount++;
            else if (status === 'at_risk') atRiskCount++;
            else if (status === 'completed') completedCount++;
        });
        
        const stats = {
            totalFields: fields.length,
            statusCounts: {
                active: activeCount,
                at_risk: atRiskCount,
                completed: completedCount
            }
        };
        
        // Get stage breakdown
        const stageStats = {
            planted: fields.filter(f => f.current_stage === 'planted').length,
            growing: fields.filter(f => f.current_stage === 'growing').length,
            ready: fields.filter(f => f.current_stage === 'ready').length,
            harvested: fields.filter(f => f.current_stage === 'harvested').length
        };
        
        // Get recent updates
        let updatesSql;
        let updatesParams = [];
        
        if (req.user.role === 'admin') {
            updatesSql = `SELECT fu.*, f.name as field_name, u.name as agent_name
                          FROM field_updates fu
                          JOIN fields f ON fu.field_id = f.id
                          JOIN users u ON fu.agent_id = u.id
                          ORDER BY fu.created_at DESC
                          LIMIT 10`;
        } else {
            updatesSql = `SELECT fu.*, f.name as field_name, u.name as agent_name
                          FROM field_updates fu
                          JOIN fields f ON fu.field_id = f.id
                          JOIN users u ON fu.agent_id = u.id
                          WHERE fu.agent_id = ?
                          ORDER BY fu.created_at DESC
                          LIMIT 10`;
            updatesParams = [req.user.id];
        }
        
        const updatesResult = await db.query(updatesSql, updatesParams);
        
        // Get agent list for admin
        let agents = [];
        if (req.user.role === 'admin') {
            const agentsResult = await db.query(
                `SELECT id, name, email FROM users WHERE role = ? ORDER BY name`,
                ['field_agent']
            );
            agents = agentsResult.rows;
        }
        
        res.json({
            summary: stats,
            stageStats,
            recentUpdates: updatesResult.rows,
            agents
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
};

module.exports = {
    getFields,
    getField,
    createField,
    updateField,
    deleteField,
    addFieldUpdate,
    getDashboard
};
