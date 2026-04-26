import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

const Sidebar = () => {
    const user = useSelector((state) => state.auth.user);
    const dispatch = useDispatch();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    let navItems = [];

    if (user?.role === 'Clerk' || user?.role === 'CLERK') {
        // Clerks only see their assigned readings page
        navItems = [
            { path: '/clerk', label: 'Assigned Readings', icon: '📋' },
        ];
    } else if (user?.role === 'Technician' || user?.role === 'TECHNICIAN') {
        // Technicians only see their field task board
        navItems = [
            { path: '/technician', label: 'Field Tasks', icon: '🔧' },
        ];
    } else if (user?.role === 'Admin' || user?.is_staff || user?.role === 'ADMIN') {
        navItems = [
            { path: '/admin', label: 'Dashboard', icon: '📊' },
            { path: '/admin/revenue', label: 'Revenue', icon: '💰' },
            { path: '/admin/disputes', label: 'Dispute Review', icon: '⚖️' },
            { path: '/admin/readings', label: 'Reading Review', icon: '🔍' },
            { path: '/admin/maintenance', label: 'Field Maintenance', icon: '🔧' },
            { path: '/admin/roles', label: 'Role Management', icon: '👥' },
            { path: '/admin/system', label: 'System Management', icon: '⚙️' },
        ];
    } else {
        navItems = [
            { path: '/dashboard', label: 'Dashboard', icon: '📊' },
            { path: '/readings', label: 'Meter Readings', icon: '🔍' },
            { path: '/bills', label: 'Bills & Payments', icon: '💳' },
        ];
    }

    const userInitials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'WB';

    return (
        <>
            <NotificationBell />
            <ThemeToggle />
            <button
                type="button"
                className="mobile-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle Menu"
            >
                {isOpen ? '✕' : '☰'}
            </button>
            <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">💧</div>
                    <span className="sidebar-brand">AquaBill AI</span>
                </div>
                <nav className="sidebar-nav">
                    <span className="nav-section-title">Main Menu</span>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => setIsOpen(false)}
                        >
                            <span className="nav-link-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                    <span className="nav-section-title" style={{ marginTop: 'auto' }}>Account</span>
                    <button onClick={() => dispatch(logout())} className="nav-link" style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        <span className="nav-link-icon">🚪</span>
                        Sign Out
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{userInitials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.first_name || 'User'}</div>
                            <div className="sidebar-user-email">{user?.email || 'user@example.com'}</div>
                        </div>
                    </div>
                </div>
            </aside>
            {isOpen && <div className="mobile-overlay" onClick={() => setIsOpen(false)}></div>}
        </>
    );
};

export default Sidebar;
