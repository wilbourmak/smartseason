import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
    const { user, logout, isAdmin } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>SmartSeason</h1>
                    <span className="tagline">Field Monitoring</span>
                </div>
                
                <nav className="nav-menu">
                    <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                        Dashboard
                    </Link>
                    <Link to="/fields" className={isActive('/fields') ? 'active' : ''}>
                        Fields
                    </Link>
                    {isAdmin && (
                        <Link to="/agents" className={isActive('/agents') ? 'active' : ''}>
                            Field Agents
                        </Link>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <span className="user-name">{user?.name}</span>
                        <span className="user-role">{isAdmin ? 'Administrator' : 'Field Agent'}</span>
                    </div>
                    <button onClick={logout} className="logout-btn">
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
