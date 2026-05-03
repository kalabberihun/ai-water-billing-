import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

const NotificationBell = () => {
    const user = useSelector((state) => state.auth.user);
    const isClerk = user?.role === 'Clerk' || user?.role === 'CLERK';

    const [notificationCount, setNotificationCount] = useState(0);
    const [unpaidCount, setUnpaidCount] = useState(0);
    const [alerts, setAlerts] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    
    const bellRef = useRef(null);
    const navigate = useNavigate();

    const getClickedAlerts = () => {
        try { return JSON.parse(sessionStorage.getItem('clickedAlerts') || '[]'); } catch { return []; }
    };

    const addClickedAlert = (id) => {
        const current = getClickedAlerts();
        if (!current.includes(id)) {
            sessionStorage.setItem('clickedAlerts', JSON.stringify([...current, id]));
        }
    };

    useEffect(() => {
        const checkNotifications = async () => {
            try {
                const tokenStr = localStorage.getItem('tokens');
                if (!tokenStr) return;
                
                const tokenObj = JSON.parse(tokenStr);
                if (!tokenObj?.access) return;

                const config = { headers: { Authorization: `Bearer ${tokenObj.access}` } };
                let uCount = 0;
                let fetchedAlerts = [];
                const clickedAlerts = getClickedAlerts();

                // Always fetch System Notifications for the user
                try {
                    const notifyRes = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/accounts/notifications/`, config);
                    fetchedAlerts = notifyRes.data.filter(n => !n.is_read && !clickedAlerts.includes(n.id));
                } catch (e) {
                    console.error("Failed to fetch system notifications", e);
                }

                if (isClerk) {
                    try {
                        const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/clerk/pending-readings`, config);
                        if (res.data && res.data.length > 0 && !clickedAlerts.includes('clerk-manual-reviews')) {
                            fetchedAlerts.push({
                                id: 'clerk-manual-reviews',
                                alert_type: 'CLERK_REVIEW',
                                message: `You have ${res.data.length} meter readings requiring manual review in your queue.`,
                                created_at: new Date().toISOString()
                            });
                        }
                    } catch(e) {}
                } else if (user?.role === 'ADMIN' || user?.role === 'Admin' || user?.is_staff) {
                    try {
                        const [disputesRes, leakageRes] = await Promise.all([
                            axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/admin/disputes`, config),
                            axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/admin/leakage-reports`, config)
                        ]);
                        
                        const pendingDisputes = disputesRes.data?.filter(d => d.status !== 'RESOLVED' && d.status !== 'REJECTED') || [];
                        if (pendingDisputes.length > 0 && !clickedAlerts.includes('admin-disputes')) {
                            fetchedAlerts.push({
                                id: 'admin-disputes',
                                alert_type: 'ADMIN_DISPUTES',
                                message: `You have ${pendingDisputes.length} pending billing disputes requiring review.`,
                                created_at: new Date().toISOString()
                            });
                        }

                        const pendingLeakage = leakageRes.data?.filter(l => l.status !== 'RESOLVED' && l.status !== 'FALSE_ALARM') || [];
                        if (pendingLeakage.length > 0 && !clickedAlerts.includes('admin-leakage')) {
                            fetchedAlerts.push({
                                id: 'admin-leakage',
                                alert_type: 'ADMIN_LEAKAGE',
                                message: `You have ${pendingLeakage.length} active leakage reports requiring attention.`,
                                created_at: new Date().toISOString()
                            });
                        }
                    } catch(e) {}
                } else if (!isClerk && user?.role !== 'TECHNICIAN') {
                    // For typical customers - check unpaid balance
                    try {
                        const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/billing/customer-stats`, config);
                        
                        if (res.data.balance) {
                            const balanceVal = parseFloat(res.data.balance.replace(/,/g, ''));
                            if (balanceVal > 0 && !clickedAlerts.includes('unpaid-bill')) {
                                uCount += 1;
                            }
                        }
                    } catch(e) {}
                }
                
                setAlerts(fetchedAlerts);
                setUnpaidCount(uCount);
                
                const currentTotal = uCount + fetchedAlerts.length;
                setNotificationCount(currentTotal);
            } catch (error) {
                console.error("Failed to process notifications", error);
            }
        };

        checkNotifications();
        const intervalId = setInterval(checkNotifications, 30000);

        const handleClickOutside = (event) => {
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isClerk]);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleMarkAsRead = async (alertId) => {
        if (!alertId) return;

        addClickedAlert(alertId);

        if (alertId === 'clerk-manual-reviews' || alertId === 'admin-disputes' || alertId === 'admin-leakage') {
            setAlerts(prev => prev.filter(a => a.id !== alertId));
            setNotificationCount(prev => Math.max(0, prev - 1));
            return;
        }

        // If it's a persisted SystemNotification
        try {
            const tokenStr = localStorage.getItem('tokens');
            const tokenObj = JSON.parse(tokenStr);
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/accounts/notifications/${alertId}/read/`, {}, {
                headers: { Authorization: `Bearer ${tokenObj.access}` }
            });
            
            // Remove locally
            setAlerts(prev => prev.filter(a => a.id !== alertId));
            setNotificationCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error("Failed to mark notification as read", e);
        }
    };

    const handleNavigate = (path) => {
        setIsOpen(false);
        navigate(path);
    };

    const getAlertIcon = (type) => {
        if (type === 'LEAK') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: '💧' };
        if (type === 'ADMIN_LEAKAGE') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: '🚰' };
        if (type === 'ADMIN_DISPUTES') return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: '⚖️' };
        if (type === 'CLERK_REVIEW') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: '📋' };
        if (type === 'TASK') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: '🛠️' };
        if (type === 'INFO') return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', icon: 'ℹ️' };
        if (type === 'WARNING') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: '⚠️' };
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: '📈' };
    };

    const getAlertTitle = (type) => {
        if (type === 'LEAK') return 'Possible Leak Detected';
        if (type === 'ADMIN_LEAKAGE') return 'New Leakage Report';
        if (type === 'ADMIN_DISPUTES') return 'New Billing Dispute';
        if (type === 'CLERK_REVIEW' || type === 'TASK') return 'Action Required';
        if (type === 'INFO') return 'Information';
        if (type === 'WARNING') return 'Warning';
        return 'Usage Spike Detected';
    };

    return (
        <div ref={bellRef} style={{ position: 'fixed', top: '15px', right: '80px', zIndex: 50 }}>
            <div 
                style={{ cursor: 'pointer', position: 'relative' }} 
                onClick={toggleDropdown}
            >
                <span 
                    style={{ fontSize: '1.5rem', opacity: notificationCount === 0 ? 0.6 : 1 }} 
                    title={notificationCount > 0 ? `${notificationCount} new notifications` : `Notifications`}
                >
                    🔔
                </span>
                
                {notificationCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--bg-card)',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
                    }}>
                        {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                )}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '-10px',
                    marginTop: '10px',
                    width: '320px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(24px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                    animation: 'slideDown 0.2s ease-out forwards'
                }}>
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-default)',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        Notifications
                        {notificationCount > 0 && (
                            <span style={{
                                background: 'rgba(52, 120, 255, 0.2)',
                                color: 'var(--primary-400)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                            }}>
                                {notificationCount} New
                            </span>
                        )}
                    </div>
                    
                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                        {notificationCount === 0 ? (
                            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <div style={{ fontSize: '2rem', opacity: 0.5, marginBottom: '10px' }}>🙌</div>
                                You're all caught up!
                            </div>
                        ) : (
                            <>
                                {unpaidCount > 0 && (
                                    <div 
                                        onClick={() => {
                                            addClickedAlert('unpaid-bill');
                                            setUnpaidCount(0);
                                            setNotificationCount(prev => Math.max(0, prev - 1));
                                            handleNavigate('/bills');
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s ease',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0
                                            }}>
                                                💳
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                    Unpaid Bill
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    You have an outstanding balance on your account. Please pay your bill to avoid service interruption.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {alerts.map(alert => {
                                    const design = getAlertIcon(alert.alert_type);
                                    return (
                                        <div 
                                            key={alert.id}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid var(--border-subtle)',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            onClick={() => {
                                                if (alert.alert_type === 'CLERK_REVIEW') {
                                                    handleNavigate('/clerk');
                                                } else if (alert.alert_type === 'ADMIN_DISPUTES') {
                                                    handleNavigate('/admin/disputes');
                                                } else if (alert.alert_type === 'ADMIN_LEAKAGE') {
                                                    handleNavigate('/admin/leakage-reports');
                                                } else if (alert.alert_type === 'TASK') {
                                                    handleNavigate(user?.role === 'TECHNICIAN' ? '/technician' : '/clerk');
                                                } else if (alert.alert_type === 'INFO' || alert.alert_type === 'WARNING') {
                                                    handleNavigate('/bills');
                                                }
                                                handleMarkAsRead(alert.id);
                                            }}
                                        >
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: design.bg, color: design.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0
                                            }}>
                                                {design.icon}
                                            </div>
                                            <div style={{ flexGrow: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                    {getAlertTitle(alert.alert_type)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    {alert.message}
                                                </div>
                                            </div>
                                            
                                            {alert.id !== 'clerk-manual-reviews' && (
                                                <div 
                                                    style={{ color: 'var(--text-secondary)', fontSize: '1rem', padding: '0 4px' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsRead(alert.id);
                                                    }}
                                                    title="Mark as read"
                                                >
                                                    ✕
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
