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
    const [hasUnread, setHasUnread] = useState(false);
    
    const bellRef = useRef(null);
    const navigate = useNavigate();

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

                if (isClerk) {
                    const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/clerk/pending-readings`, config);
                    if (res.data && res.data.length > 0) {
                        fetchedAlerts.push({
                            id: 'clerk-manual-reviews',
                            alert_type: 'CLERK_REVIEW',
                            message: `You have ${res.data.length} meter readings requiring manual review in your queue.`,
                            created_at: new Date().toISOString()
                        });
                    }
                } else {
                    // For typical customers - returns 400 if user doesn't have a linked Customer profile
                    const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/billing/customer-stats`, config);
                    
                    if (res.data.balance) {
                        const balanceVal = parseFloat(res.data.balance.replace(/,/g, ''));
                        if (balanceVal > 0) uCount += 1;
                    }
                    fetchedAlerts = res.data.alerts || [];
                }
                
                setAlerts(fetchedAlerts);
                setUnpaidCount(uCount);
                
                const currentTotal = uCount + fetchedAlerts.length;
                setNotificationCount(currentTotal);
                
                const currentSnapshot = JSON.stringify({ unpaid: uCount, alerts: fetchedAlerts.map(a => a.id) });
                const lastSeenSnapshot = localStorage.getItem('lastSeenNotifications');
                if (currentTotal > 0 && currentSnapshot !== lastSeenSnapshot) {
                    setHasUnread(true);
                } else {
                    setHasUnread(false);
                }
            } catch (error) {
                if (error.response?.status !== 401 && error.response?.status !== 403) {
                    // Ignore 400s if it's admin/staff without a customer profile
                    if (error.response?.status !== 400) {
                        console.error("Failed to fetch notifications", error);
                    }
                }
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
        const newIsOpen = !isOpen;
        setIsOpen(newIsOpen);
        
        if (newIsOpen && notificationCount > 0) {
            const currentSnapshot = JSON.stringify({ unpaid: unpaidCount, alerts: alerts.map(a => a.id) });
            localStorage.setItem('lastSeenNotifications', currentSnapshot);
            setHasUnread(false);
        }
    };

    const handleNavigate = (path) => {
        setIsOpen(false);
        navigate(path);
    };

    const getAlertIcon = (type) => {
        if (type === 'LEAK') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: '💧' };
        if (type === 'CLERK_REVIEW') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: '📋' };
        if (type === 'INFO') return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', icon: 'ℹ️' };
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: '📈' };
    };

    const getAlertTitle = (type) => {
        if (type === 'LEAK') return 'Possible Leak Detected';
        if (type === 'CLERK_REVIEW') return 'Action Required';
        if (type === 'INFO') return 'Information';
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
                    title={hasUnread ? `${notificationCount} new notifications` : `Notifications`}
                >
                    🔔
                </span>
                
                {hasUnread && notificationCount > 0 && (
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
                                        onClick={() => handleNavigate('/bills')}
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
                                            onClick={() => alert.alert_type === 'CLERK_REVIEW' ? handleNavigate('/clerk') : null}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid var(--border-subtle)',
                                                cursor: alert.alert_type === 'CLERK_REVIEW' ? 'pointer' : 'default',
                                                transition: 'background 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { if(alert.alert_type === 'CLERK_REVIEW') e.currentTarget.style.background = 'var(--bg-glass-hover)'; }}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: design.bg, color: design.color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0
                                                }}>
                                                    {design.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                        {getAlertTitle(alert.alert_type)}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {alert.message}
                                                    </div>
                                                </div>
                                            </div>
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
