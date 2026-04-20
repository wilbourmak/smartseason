import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, StageBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

const FieldDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin, user } = useAuth();
    const [field, setField] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [newStage, setNewStage] = useState('');
    const [notes, setNotes] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);

    useEffect(() => {
        fetchField();
    }, [id]);

    const fetchField = async () => {
        try {
            const response = await api.get(`/api/fields/${id}`);
            setField(response.data.field);
            setNewStage(response.data.field.current_stage);
        } catch (err) {
            if (err.response?.status === 404) {
                setError('Field not found');
            } else {
                setError('Failed to load field details');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this field?')) return;
        
        try {
            await api.delete(`/api/fields/${id}`);
            navigate('/fields');
        } catch (err) {
            setError('Failed to delete field');
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        
        try {
            await api.post(`/api/fields/${id}/updates`, { stage: newStage, notes });
            setShowUpdateForm(false);
            setNotes('');
            fetchField();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add update');
        } finally {
            setUpdateLoading(false);
        }
    };

    const getDaysSince = (date) => {
        const diff = new Date() - new Date(date);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const canUpdate = isAdmin || field?.assigned_agent_id === user?.id;

    if (loading) return <div className="loading">Loading field details...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!field) return <div className="error-message">Field not found</div>;

    const stages = ['planted', 'growing', 'ready', 'harvested'];
    const currentStageIndex = stages.indexOf(field.current_stage);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <Link to="/fields" className="back-link">← Back to Fields</Link>
                    <h1>{field.name}</h1>
                </div>
                {isAdmin && (
                    <div className="header-actions">
                        <Link to={`/fields/${id}/edit`} className="btn-secondary">
                            Edit
                        </Link>
                        <button onClick={handleDelete} className="btn-danger">
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Field Overview */}
            <div className="field-overview">
                <div className="overview-card">
                    <h3>Status</h3>
                    <StatusBadge status={field.status} />
                </div>
                <div className="overview-card">
                    <h3>Current Stage</h3>
                    <StageBadge stage={field.current_stage} />
                </div>
                <div className="overview-card">
                    <h3>Crop Type</h3>
                    <p>{field.crop_type}</p>
                </div>
                <div className="overview-card">
                    <h3>Planted</h3>
                    <p>{format(new Date(field.planting_date), 'MMM d, yyyy')}</p>
                    <small>({getDaysSince(field.planting_date)} days ago)</small>
                </div>
            </div>

            {/* Stage Progress */}
            <div className="section">
                <h2>Progress</h2>
                <div className="stage-progress">
                    {stages.map((stage, index) => (
                        <div 
                            key={stage} 
                            className={`progress-step ${index <= currentStageIndex ? 'completed' : ''} ${stage === field.current_stage ? 'current' : ''}`}
                        >
                            <div className="step-dot"></div>
                            <span className="step-label">{stage}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Update Form */}
            {canUpdate && field.current_stage !== 'harvested' && (
                <div className="section">
                    <h2>Update Field</h2>
                    {!showUpdateForm ? (
                        <button 
                            className="btn-primary" 
                            onClick={() => setShowUpdateForm(true)}
                        >
                            Add Progress Update
                        </button>
                    ) : (
                        <form onSubmit={handleUpdateSubmit} className="update-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>New Stage</label>
                                    <select 
                                        value={newStage} 
                                        onChange={(e) => setNewStage(e.target.value)}
                                        required
                                    >
                                        {stages.map(stage => (
                                            <option key={stage} value={stage}>
                                                {stage.charAt(0).toUpperCase() + stage.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes / Observations</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Enter observations about the field..."
                                    rows="3"
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-primary" disabled={updateLoading}>
                                    {updateLoading ? 'Saving...' : 'Save Update'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-secondary"
                                    onClick={() => setShowUpdateForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Assigned Agent */}
            {field.assigned_agent_name && (
                <div className="section">
                    <h2>Assigned Agent</h2>
                    <div className="agent-info">
                        <p><strong>{field.assigned_agent_name}</strong></p>
                        {field.assigned_agent_email && <p>{field.assigned_agent_email}</p>}
                    </div>
                </div>
            )}

            {/* Update History */}
            <div className="section">
                <h2>Update History</h2>
                {field.updates?.length > 0 ? (
                    <div className="timeline">
                        {field.updates.map((update, index) => (
                            <div key={update.id} className="timeline-item">
                                <div className="timeline-marker"></div>
                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <StageBadge stage={update.stage} />
                                        <span className="timeline-date">
                                            {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
                                        </span>
                                    </div>
                                    <p className="timeline-agent">by {update.agent_name}</p>
                                    {update.notes && (
                                        <p className="timeline-notes">{update.notes}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="empty-state">No updates yet</p>
                )}
            </div>
        </div>
    );
};

export default FieldDetail;
