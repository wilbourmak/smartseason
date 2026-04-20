import React from 'react';

const statusConfig = {
    active: { label: 'Active', className: 'status-active' },
    at_risk: { label: 'At Risk', className: 'status-at-risk' },
    completed: { label: 'Completed', className: 'status-completed' }
};

const stageConfig = {
    planted: { label: 'Planted', className: 'stage-planted' },
    growing: { label: 'Growing', className: 'stage-growing' },
    ready: { label: 'Ready', className: 'stage-ready' },
    harvested: { label: 'Harvested', className: 'stage-harvested' }
};

export const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || { label: status, className: '' };
    return <span className={`badge ${config.className}`}>{config.label}</span>;
};

export const StageBadge = ({ stage }) => {
    const config = stageConfig[stage] || { label: stage, className: '' };
    return <span className={`badge ${config.className}`}>{config.label}</span>;
};
