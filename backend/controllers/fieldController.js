const pool = require('../database/connection');

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
    // 1. Planted stage > 14 days (should have sprouted)
    // 2. Growing stage > 90 days (typical growing period exceeded)
    // 3. Ready stage > 30 days (should have been harvested)
    // 4. Any field with no updates in 21 days
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
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            // Admin sees all fields with agent info
            query = `
                SELECT f.*, u.name as assigned_agent_name, u.email as assigned_agent_email
                FROM fields f
                LEFT JOIN users u ON f.assigned_agent_id = u.id
                ORDER BY f.created_at DESC
            `;
        } else {
            // Field agent sees only assigned fields
            query = `
                SELECT f.*, u.name as assigned_agent_name
                FROM fields f
                LEFT JOIN users u ON f.assigned_agent_id = u.id
                WHERE f.assigned_agent_id = ?
                ORDER BY f.created_at DESC
            `;
            params = [req.user.id];
        }
        
        const result = await pool.query(query, params);
        
        // Compute status for each field
        const fieldsWithStatus = result.rows.map(field => ({
            ...field,
            status: computeFieldStatus(field)
        }));
        
        res.json({ fields: fieldsWithStatus });
    } catch (error) {
        console.error('Get fields error:', error);
        res.status(500).json({ error: 'Failed to retrieve fields' });
    }
};

// Get single field by ID
const getField = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check permissions
        let query;
        let params = [id];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT f.*, u.name as assigned_agent_name, u.email as assigned_agent_email
                FROM fields f
                LEFT JOIN users u ON f.assigned_agent_id = u.id
                WHERE f.id = ?
            `;
        } else {
            query = `
                SELECT f.*, u.name as assigned_agent_name
                FROM fields f
                LEFT JOIN users u ON f.assigned_agent_id = u.id
                WHERE f.id = ? AND f.assigned_agent_id = ?
            `;
            params.push(req.user.id);
        }
        
        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const field = result.rows[0];
        field.status = computeFieldStatus(field);
        
        // Get field updates history
        const updatesResult = await pool.query(`
            SELECT fu.*, u.name as agent_name
            FROM field_updates fu
            JOIN users u ON fu.agent_id = u.id
            WHERE fu.field_id = ?
            ORDER BY fu.created_at DESC
        `, [id]);
        
        res.json({
            field: {
                ...field,
                updates: updatesResult.rows
            }
        });
    } catch (error) {
        console.error('Get field error:', error);
        res.status(500).json({ error: 'Failed to retrieve field' });
    }
};

// Create new field (admin only)
const createField = async (req, res) => {
    try {
        const { name, crop_type, planting_date, assigned_agent_id } = req.body;
        
        // Validation
        if (!name || !crop_type || !planting_date) {
            return res.status(400).json({ error: 'Name, crop type, and planting date are required' });
        }
        
        // Check if agent exists if assigned
        if (assigned_agent_id) {
            const agentCheck = await pool.query(
                'SELECT id, role FROM users WHERE id = ?',
                [assigned_agent_id]
            );
            
            if (agentCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
            
            if (agentCheck.rows[0].role !== 'field_agent') {
                return res.status(400).json({ error: 'Can only assign field agents to fields' });
            }
        }
        
        const result = await pool.query(
            `INSERT INTO fields (name, crop_type, planting_date, current_stage, assigned_agent_id)
             VALUES (?, ?, ?, ?, ?)
             RETURNING *`,
            [name, crop_type, planting_date, 'planted', assigned_agent_id || null]
        );
        
        // Get agent info
        let field = result.rows[0];
        if (field.assigned_agent_id) {
            const agentResult = await pool.query(
                'SELECT name FROM users WHERE id = ?',
                [field.assigned_agent_id]
            );
            if (agentResult.rows.length > 0) {
                field.assigned_agent_name = agentResult.rows[0].name;
            }
        }
        
        field.status = computeFieldStatus(field);
        
        res.status(201).json({
            message: 'Field created successfully',
            field
        });
    } catch (error) {
        console.error('Create field error:', error);
        res.status(500).json({ error: 'Failed to create field' });
    }
};

// Update field (admin only)
const updateField = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, crop_type, planting_date, assigned_agent_id } = req.body;
        
        // Check if field exists
        const fieldCheck = await pool.query('SELECT id FROM fields WHERE id = ?', [id]);
        if (fieldCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        // Check if agent exists if assigned
        if (assigned_agent_id) {
            const agentCheck = await pool.query(
                'SELECT id, role FROM users WHERE id = ?',
                [assigned_agent_id]
            );
            
            if (agentCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
            
            if (agentCheck.rows[0].role !== 'field_agent') {
                return res.status(400).json({ error: 'Can only assign field agents to fields' });
            }
        }
        
        const result = await pool.query(
            `UPDATE fields
             SET name = ?, crop_type = ?, planting_date = ?, assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
             RETURNING *`,
            [
                name || fieldCheck.rows[0].name,
                crop_type || fieldCheck.rows[0].crop_type,
                planting_date || fieldCheck.rows[0].planting_date,
                assigned_agent_id !== undefined ? assigned_agent_id : fieldCheck.rows[0].assigned_agent_id,
                id
            ]
        );
        
        let field = result.rows[0];
        field.status = computeFieldStatus(field);
        
        res.json({
            message: 'Field updated successfully',
            field
        });
    } catch (error) {
        console.error('Update field error:', error);
        res.status(500).json({ error: 'Failed to update field' });
    }
};

// Delete field (admin only)
const deleteField = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM fields WHERE id = ? RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        res.json({ message: 'Field deleted successfully' });
    } catch (error) {
        console.error('Delete field error:', error);
        res.status(500).json({ error: 'Failed to delete field' });
    }
};

// Update field stage and add notes (field agent)
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
        let fieldQuery;
        let fieldParams;
        
        if (req.user.role === 'admin') {
            fieldQuery = 'SELECT * FROM fields WHERE id = ?';
            fieldParams = [id];
        } else {
            fieldQuery = 'SELECT * FROM fields WHERE id = ? AND assigned_agent_id = ?';
            fieldParams = [id, req.user.id];
        }
        
        const fieldResult = await pool.query(fieldQuery, fieldParams);
        
        if (fieldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Field not found or not assigned to you' });
        }
        
        // Add field update
        await pool.query(
            `INSERT INTO field_updates (field_id, agent_id, stage, notes) VALUES (?, ?, ?, ?)`,
            [id, req.user.id, stage, notes || null]
        );
        
        // Update field current stage
        await pool.query(
            `UPDATE fields SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [stage, id]
        );
        
        const field = fieldResult.rows[0];
        field.current_stage = stage;
        field.status = computeFieldStatus({ ...field, current_stage: stage });
        
        res.json({
            message: 'Field update added successfully',
            field
        });
    } catch (error) {
        console.error('Add field update error:', error);
        res.status(500).json({ error: 'Failed to add field update: ' + error.message });
    }
};

// Get dashboard summary
const getDashboard = async (req, res) => {
    try {
        let fieldsQuery;
        let params = [];
        
        if (req.user.role === 'admin') {
            // Admin dashboard - all fields
            fieldsQuery = 'SELECT id, current_stage, planting_date FROM fields';
        } else {
            // Agent dashboard - only assigned fields
            fieldsQuery = 'SELECT id, current_stage, planting_date FROM fields WHERE assigned_agent_id = ?';
            params = [req.user.id];
        }
        
        const fieldsResult = await pool.query(fieldsQuery, params);
        const fields = fieldsResult.rows.map(f => ({
            ...f,
            status: computeFieldStatus(f)
        }));
        
        // Calculate statistics
        const totalFields = fields.length;
        const statusCounts = {
            active: fields.filter(f => f.status === 'active').length,
            at_risk: fields.filter(f => f.status === 'at_risk').length,
            completed: fields.filter(f => f.status === 'completed').length
        };
        
        const stageCounts = {
            planted: fields.filter(f => f.current_stage === 'planted').length,
            growing: fields.filter(f => f.current_stage === 'growing').length,
            ready: fields.filter(f => f.current_stage === 'ready').length,
            harvested: fields.filter(f => f.current_stage === 'harvested').length
        };
        
        // Get recent updates
        let updatesQuery;
        let updatesParams = [];
        
        if (req.user.role === 'admin') {
            updatesQuery = `
                SELECT fu.*, f.name as field_name, u.name as agent_name
                FROM field_updates fu
                JOIN fields f ON fu.field_id = f.id
                JOIN users u ON fu.agent_id = u.id
                ORDER BY fu.created_at DESC
                LIMIT 10
            `;
        } else {
            updatesQuery = `
                SELECT fu.*, f.name as field_name
                FROM field_updates fu
                JOIN fields f ON fu.field_id = f.id
                WHERE fu.agent_id = ?
                ORDER BY fu.created_at DESC
                LIMIT 10
            `;
            updatesParams = [req.user.id];
        }
        
        const updatesResult = await pool.query(updatesQuery, updatesParams);
        
        // Get agent list for admin
        let agents = [];
        if (req.user.role === 'admin') {
            const agentsResult = await pool.query(`
                SELECT u.id, u.name, u.email, COUNT(f.id) as field_count
                FROM users u
                LEFT JOIN fields f ON u.id = f.assigned_agent_id
                WHERE u.role = 'field_agent'
                GROUP BY u.id, u.name, u.email
                ORDER BY u.name
            `);
            agents = agentsResult.rows;
        }
        
        res.json({
            summary: {
                totalFields,
                statusCounts,
                stageCounts
            },
            recentUpdates: updatesResult.rows,
            agents: req.user.role === 'admin' ? agents : undefined
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard data' });
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
