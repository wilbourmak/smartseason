import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, StageBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

const Fields = () => {
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const { isAdmin } = useAuth();
    const [searchParams] = useSearchParams();
    const agentFilter = searchParams.get('agent');

    useEffect(() => {
        fetchFields();
    }, []);

    const fetchFields = async () => {
        try {
            const response = await api.get('/api/fields');
            setFields(response.data.fields || []);
        } catch (err) {
            setError('Failed to load fields');
        } finally {
            setLoading(false);
        }
    };

    const getDaysSince = (date) => {
        const diff = new Date() - new Date(date);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const filteredFields = fields.filter(field => {
        if (agentFilter && field.assigned_agent_id !== parseInt(agentFilter)) {
            return false;
        }
        if (filter === 'all') return true;
        if (filter === 'active') return field.status === 'active';
        if (filter === 'at_risk') return field.status === 'at_risk';
        if (filter === 'completed') return field.status === 'completed';
        return true;
    });

    if (loading) return <div className="loading">Loading fields...</div>;

    return (
        <div className="page">
            <div className="page-header">
                <h1>{agentFilter ? 'Agent Fields' : 'All Fields'}</h1>
                {isAdmin && (
                    <Link to="/fields/new" className="btn-primary">
                        + Add Field
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="filters">
                <button 
                    className={filter === 'all' ? 'active' : ''} 
                    onClick={() => setFilter('all')}
                >
                    All ({fields.length})
                </button>
                <button 
                    className={filter === 'active' ? 'active' : ''} 
                    onClick={() => setFilter('active')}
                >
                    Active ({fields.filter(f => f.status === 'active').length})
                </button>
                <button 
                    className={filter === 'at_risk' ? 'active' : ''} 
                    onClick={() => setFilter('at_risk')}
                >
                    At Risk ({fields.filter(f => f.status === 'at_risk').length})
                </button>
                <button 
                    className={filter === 'completed' ? 'active' : ''} 
                    onClick={() => setFilter('completed')}
                >
                    Completed ({fields.filter(f => f.status === 'completed').length})
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {filteredFields.length === 0 ? (
                <div className="empty-state">
                    <p>No fields found</p>
                    {isAdmin && <Link to="/fields/new" className="link">Create your first field</Link>}
                </div>
            ) : (
                <div className="fields-grid">
                    {filteredFields.map((field) => (
                        <div key={field.id} className={`field-card ${field.status}`}>
                            <div className="field-header">
                                <h3>{field.name}</h3>
                                <StatusBadge status={field.status} />
                            </div>
                            
                            <div className="field-details">
                                <div className="detail">
                                    <span className="label">Crop:</span>
                                    <span className="value">{field.crop_type}</span>
                                </div>
                                <div className="detail">
                                    <span className="label">Stage:</span>
                                    <StageBadge stage={field.current_stage} />
                                </div>
                                <div className="detail">
                                    <span className="label">Planted:</span>
                                    <span className="value">
                                        {format(new Date(field.planting_date), 'MMM d, yyyy')}
                                        <span className="days">
                                            ({getDaysSince(field.planting_date)} days)
                                        </span>
                                    </span>
                                </div>
                                {field.assigned_agent_name && (
                                    <div className="detail">
                                        <span className="label">Agent:</span>
                                        <span className="value">{field.assigned_agent_name}</span>
                                    </div>
                                )}
                            </div>

                            <Link to={`/fields/${field.id}`} className="field-link">
                                View Details
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Fields;
