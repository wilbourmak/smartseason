import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StageBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { isAdmin, user } = useAuth();

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/api/fields/dashboard');
            setData(response.data);
        } catch (err) {
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading dashboard...</div>;
    if (error) return <div className="error-message">{error}</div>;

    const { summary, recentUpdates, agents } = data || {};

    return (
        <div className="page">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p className="subtitle">
                    Welcome, {user?.name}. Here is your {isAdmin ? 'system' : 'field'} overview.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="card">
                    <div className="card-value">{summary?.totalFields || 0}</div>
                    <div className="card-label">Total Fields</div>
                </div>
                <div className="card card-success">
                    <div className="card-value">{summary?.statusCounts?.active || 0}</div>
                    <div className="card-label">Active</div>
                </div>
                <div className="card card-warning">
                    <div className="card-value">{summary?.statusCounts?.at_risk || 0}</div>
                    <div className="card-label">At Risk</div>
                </div>
                <div className="card card-completed">
                    <div className="card-value">{summary?.statusCounts?.completed || 0}</div>
                    <div className="card-label">Completed</div>
                </div>
            </div>

            {/* Stage Breakdown */}
            <div className="section">
                <h2>Stage Breakdown</h2>
                <div className="stage-grid">
                    {summary?.stageCounts && Object.entries(summary.stageCounts).map(([stage, count]) => (
                        <div key={stage} className="stage-item">
                            <StageBadge stage={stage} />
                            <span className="count">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Updates */}
            <div className="section">
                <h2>Recent Activity</h2>
                {recentUpdates?.length > 0 ? (
                    <div className="updates-list">
                        {recentUpdates.map((update) => (
                            <div key={update.id} className="update-item">
                                <div className="update-header">
                                    <Link to={`/fields/${update.field_id}`} className="field-name">
                                        {update.field_name}
                                    </Link>
                                    <span className="update-time">
                                        {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
                                    </span>
                                </div>
                                <div className="update-body">
                                    <StageBadge stage={update.stage} />
                                    <span className="agent-name">by {update.agent_name}</span>
                                </div>
                                {update.notes && (
                                    <p className="update-notes">{update.notes}</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="empty-state">No recent updates</p>
                )}
            </div>

            {/* Field Agents (Admin only) */}
            {isAdmin && agents?.length > 0 && (
                <div className="section">
                    <h2>Field Agents</h2>
                    <div className="agents-grid">
                        {agents.map((agent) => (
                            <div key={agent.id} className="agent-card">
                                <h3>{agent.name}</h3>
                                <p className="agent-email">{agent.email}</p>
                                <div className="agent-stats">
                                    <span className="stat">
                                        <strong>{agent.field_count}</strong> fields assigned
                                    </span>
                                </div>
                                <Link to={`/fields?agent=${agent.id}`} className="link">
                                    View Fields
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
