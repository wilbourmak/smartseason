import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const FieldForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);
    
    const [formData, setFormData] = useState({
        name: '',
        crop_type: '',
        planting_date: '',
        assigned_agent_id: ''
    });
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(isEdit);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAgents();
        if (isEdit) {
            fetchField();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchAgents = async () => {
        try {
            const response = await api.get('/api/agents');
            setAgents(response.data.agents || []);
        } catch (err) {
            console.error('Failed to fetch agents');
        }
    };

    const fetchField = async () => {
        try {
            const response = await api.get(`/api/fields/${id}`);
            const field = response.data.field;
            setFormData({
                name: field.name,
                crop_type: field.crop_type,
                planting_date: field.planting_date,
                assigned_agent_id: field.assigned_agent_id || ''
            });
        } catch (err) {
            setError('Failed to load field data');
        } finally {
            setFetchLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                ...formData,
                assigned_agent_id: formData.assigned_agent_id || null
            };

            if (isEdit) {
                await api.put(`/api/fields/${id}`, payload);
            } else {
                await api.post('/api/fields', payload);
            }
            navigate('/fields');
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} field`);
        } finally {
            setLoading(false);
        }
    };

    if (fetchLoading) return <div className="loading">Loading...</div>;

    return (
        <div className="page">
            <div className="page-header">
                <h1>{isEdit ? 'Edit Field' : 'Create Field'}</h1>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="form-container">
                <div className="form-group">
                    <label htmlFor="name">Field Name *</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="e.g., North Field - Corn"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="crop_type">Crop Type *</label>
                    <input
                        type="text"
                        id="crop_type"
                        name="crop_type"
                        value={formData.crop_type}
                        onChange={handleChange}
                        required
                        placeholder="e.g., Corn, Wheat, Soybeans"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="planting_date">Planting Date *</label>
                    <input
                        type="date"
                        id="planting_date"
                        name="planting_date"
                        value={formData.planting_date}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="assigned_agent_id">Assign to Field Agent</label>
                    <select
                        id="assigned_agent_id"
                        name="assigned_agent_id"
                        value={formData.assigned_agent_id}
                        onChange={handleChange}
                    >
                        <option value="">-- Unassigned --</option>
                        {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.field_count} fields)
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : (isEdit ? 'Update Field' : 'Create Field')}
                    </button>
                    <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => navigate('/fields')}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FieldForm;
