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
        let fieldsSnapshot;
        
        if (req.user.role === 'admin') {
            // Admin sees all fields
            fieldsSnapshot = await db.firestore.collection('fields').orderBy('created_at', 'desc').get();
        } else {
            // Field agent sees only assigned fields
            fieldsSnapshot = await db.firestore.collection('fields')
                .where('assigned_agent_id', '==', req.user.id)
                .orderBy('created_at', 'desc')
                .get();
        }
        
        // Get all agent IDs for batch lookup
        const agentIds = [...new Set(fieldsSnapshot.docs.map(doc => doc.data().assigned_agent_id).filter(id => id))];
        const agentMap = {};
        
        // Batch fetch agent info
        for (const agentId of agentIds) {
            const agentDoc = await db.firestore.collection('users').doc(agentId).get();
            if (agentDoc.exists) {
                const agentData = agentDoc.data();
                agentMap[agentId] = {
                    name: agentData.name,
                    email: agentData.email
                };
            }
        }
        
        // Build fields with status and agent info
        const fields = fieldsSnapshot.docs.map(doc => {
            const data = doc.data();
            const agentInfo = agentMap[data.assigned_agent_id] || {};
            
            return {
                id: doc.id,
                ...data,
                planting_date: data.planting_date || data.plantingDate,
                assigned_agent_name: agentInfo.name,
                assigned_agent_email: agentInfo.email,
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at,
                updated_at: data.updated_at?.toDate?.().toISOString() || data.updated_at,
                status: computeFieldStatus({
                    ...data,
                    planting_date: data.planting_date || data.plantingDate
                })
            };
        });
        
        res.json({ fields });
    } catch (error) {
        console.error('Get fields error:', error);
        res.status(500).json({ error: 'Failed to retrieve fields' });
    }
};

// Get single field by ID
const getField = async (req, res) => {
    try {
        const { id } = req.params;
        
        const fieldDoc = await db.firestore.collection('fields').doc(id).get();
        
        if (!fieldDoc.exists) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const fieldData = fieldDoc.data();
        
        // Check permissions for non-admin
        if (req.user.role !== 'admin' && fieldData.assigned_agent_id !== req.user.id) {
            return res.status(404).json({ error: 'Field not found or not assigned to you' });
        }
        
        // Get agent info
        let agentInfo = {};
        if (fieldData.assigned_agent_id) {
            const agentDoc = await db.firestore.collection('users').doc(fieldData.assigned_agent_id).get();
            if (agentDoc.exists) {
                const agentData = agentDoc.data();
                agentInfo = {
                    assigned_agent_name: agentData.name,
                    assigned_agent_email: agentData.email
                };
            }
        }
        
        const field = {
            id: fieldDoc.id,
            ...fieldData,
            ...agentInfo,
            planting_date: fieldData.planting_date || fieldData.plantingDate,
            created_at: fieldData.created_at?.toDate?.().toISOString() || fieldData.created_at,
            updated_at: fieldData.updated_at?.toDate?.().toISOString() || fieldData.updated_at,
            status: computeFieldStatus({
                ...fieldData,
                planting_date: fieldData.planting_date || fieldData.plantingDate
            })
        };
        
        // Get field updates history
        const updatesSnapshot = await db.firestore.collection('field_updates')
            .where('field_id', '==', id)
            .orderBy('created_at', 'desc')
            .get();
        
        // Batch fetch agent names for updates
        const updateAgentIds = [...new Set(updatesSnapshot.docs.map(doc => doc.data().agent_id))];
        const updateAgentMap = {};
        
        for (const agentId of updateAgentIds) {
            const agentDoc = await db.firestore.collection('users').doc(agentId).get();
            if (agentDoc.exists) {
                updateAgentMap[agentId] = agentDoc.data().name;
            }
        }
        
        const updates = updatesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                agent_name: updateAgentMap[data.agent_id],
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at
            };
        });
        
        res.json({
            field: {
                ...field,
                updates
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
            const agentDoc = await db.firestore.collection('users').doc(assigned_agent_id).get();
            
            if (!agentDoc.exists) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
            
            const agentData = agentDoc.data();
            if (agentData.role !== 'field_agent') {
                return res.status(400).json({ error: 'Can only assign field agents to fields' });
            }
        }
        
        const timestamp = db.admin.firestore.FieldValue.serverTimestamp();
        const fieldData = {
            name,
            crop_type,
            planting_date,
            current_stage: 'planted',
            assigned_agent_id: assigned_agent_id || null,
            created_at: timestamp,
            updated_at: timestamp
        };
        
        const fieldRef = await db.firestore.collection('fields').add(fieldData);
        
        // Get agent info for response
        let agentName = null;
        if (assigned_agent_id) {
            const agentDoc = await db.firestore.collection('users').doc(assigned_agent_id).get();
            if (agentDoc.exists) {
                agentName = agentDoc.data().name;
            }
        }
        
        const field = {
            id: fieldRef.id,
            ...fieldData,
            assigned_agent_name: agentName,
            status: 'active'
        };
        
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
        const fieldDoc = await db.firestore.collection('fields').doc(id).get();
        if (!fieldDoc.exists) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const currentData = fieldDoc.data();
        
        // Check if agent exists if assigned
        if (assigned_agent_id) {
            const agentDoc = await db.firestore.collection('users').doc(assigned_agent_id).get();
            
            if (!agentDoc.exists) {
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
            
            const agentData = agentDoc.data();
            if (agentData.role !== 'field_agent') {
                return res.status(400).json({ error: 'Can only assign field agents to fields' });
            }
        }
        
        const updates = {
            name: name || currentData.name,
            crop_type: crop_type || currentData.crop_type,
            planting_date: planting_date || currentData.planting_date,
            assigned_agent_id: assigned_agent_id !== undefined ? assigned_agent_id : currentData.assigned_agent_id,
            updated_at: db.admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.firestore.collection('fields').doc(id).update(updates);
        
        const updatedField = {
            id,
            ...currentData,
            ...updates,
            status: computeFieldStatus({ ...currentData, ...updates })
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

// Delete field (admin only)
const deleteField = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if field exists
        const fieldDoc = await db.firestore.collection('fields').doc(id).get();
        if (!fieldDoc.exists) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        // Delete related updates first
        const updatesSnapshot = await db.firestore.collection('field_updates')
            .where('field_id', '==', id)
            .get();
        
        const batch = db.firestore.batch();
        updatesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.delete(db.firestore.collection('fields').doc(id));
        
        await batch.commit();
        
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
        const fieldDoc = await db.firestore.collection('fields').doc(id).get();
        
        if (!fieldDoc.exists) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const fieldData = fieldDoc.data();
        
        // Check permissions for non-admin
        if (req.user.role !== 'admin' && fieldData.assigned_agent_id !== req.user.id) {
            return res.status(404).json({ error: 'Field not found or not assigned to you' });
        }
        
        // Add field update
        const timestamp = db.admin.firestore.FieldValue.serverTimestamp();
        await db.firestore.collection('field_updates').add({
            field_id: id,
            agent_id: req.user.id,
            stage,
            notes: notes || null,
            created_at: timestamp
        });
        
        // Update field current stage
        await db.firestore.collection('fields').doc(id).update({
            current_stage: stage,
            updated_at: timestamp
        });
        
        const updatedField = {
            ...fieldData,
            id,
            current_stage: stage,
            status: computeFieldStatus({ ...fieldData, current_stage: stage })
        };
        
        res.json({
            message: 'Field update added successfully',
            field: updatedField
        });
    } catch (error) {
        console.error('Add field update error:', error);
        res.status(500).json({ error: 'Failed to add field update: ' + error.message });
    }
};

// Get dashboard summary
const getDashboard = async (req, res) => {
    try {
        let fieldsSnapshot;
        
        if (req.user.role === 'admin') {
            // Admin dashboard - all fields
            fieldsSnapshot = await db.firestore.collection('fields').get();
        } else {
            // Agent dashboard - only assigned fields
            fieldsSnapshot = await db.firestore.collection('fields')
                .where('assigned_agent_id', '==', req.user.id)
                .get();
        }
        
        const fields = fieldsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                status: computeFieldStatus(data)
            };
        });
        
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
        let updatesQuery = db.firestore.collection('field_updates')
            .orderBy('created_at', 'desc')
            .limit(10);
        
        if (req.user.role !== 'admin') {
            updatesQuery = updatesQuery.where('agent_id', '==', req.user.id);
        }
        
        const updatesSnapshot = await updatesQuery.get();
        
        // Batch fetch field and agent names
        const fieldIds = [...new Set(updatesSnapshot.docs.map(doc => doc.data().field_id))];
        const agentIds = [...new Set(updatesSnapshot.docs.map(doc => doc.data().agent_id))];
        
        const fieldMap = {};
        const agentMap = {};
        
        for (const fieldId of fieldIds) {
            const fieldDoc = await db.firestore.collection('fields').doc(fieldId).get();
            if (fieldDoc.exists) {
                fieldMap[fieldId] = fieldDoc.data().name;
            }
        }
        
        for (const agentId of agentIds) {
            const agentDoc = await db.firestore.collection('users').doc(agentId).get();
            if (agentDoc.exists) {
                agentMap[agentId] = agentDoc.data().name;
            }
        }
        
        const recentUpdates = updatesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                field_name: fieldMap[data.field_id],
                agent_name: req.user.role === 'admin' ? agentMap[data.agent_id] : undefined,
                created_at: data.created_at?.toDate?.().toISOString() || data.created_at
            };
        });
        
        // Get agent list for admin
        let agents = [];
        if (req.user.role === 'admin') {
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
            
            agents = agentsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    created_at: data.created_at?.toDate?.().toISOString() || data.created_at,
                    field_count: agentFieldCounts[doc.id] || 0
                };
            });
        }
        
        res.json({
            summary: {
                totalFields,
                statusCounts,
                stageCounts
            },
            recentUpdates,
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
