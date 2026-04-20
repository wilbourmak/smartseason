import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Agents = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const response = await api.get('/api/agents');
            setAgents(response.data.agents || []);
        } catch (err) {
            setError('Failed to load field agents');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading agents...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="page">
            <div className="page-header">
                <h1>Field Agents</h1>
            </div>

            {agents.length === 0 ? (
                <div className="empty-state">
                    <p>No field agents found</p>
                </div>
            ) : (
                <div className="agents-list">
                    {agents.map((agent) => (
                        <div key={agent.id} className="agent-detail-card">
                            <div className="agent-header">
                                <h3>{agent.name}</h3>
                                <span className="field-count">
                                    {agent.field_count} field{agent.field_count !== 1 ? 's' : ''} assigned
                                </span>
                            </div>
                            <p className="agent-email">{agent.email}</p>
                            <p className="agent-since">
                                Member since {new Date(agent.created_at).toLocaleDateString()}
                            </p>
                            <Link to={`/fields?agent=${agent.id}`} className="link">
                                View Assigned Fields
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Agents;
