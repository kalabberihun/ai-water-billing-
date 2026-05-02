import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

const SupportWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const tokens = useSelector((state) => state.auth.tokens);
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const location = useLocation();

    // Don't show on auth pages
    const hiddenPaths = ['/login', '/register', '/verify-email', '/forgot-password'];
    if (hiddenPaths.some(p => location.pathname.startsWith(p)) || location.pathname.startsWith('/reset-password')) {
        return null;
    }

    const isCustomer = tokens && user && !user.is_staff && !['Admin', 'ADMIN', 'Clerk', 'CLERK', 'Technician', 'TECHNICIAN'].includes(user?.role);

    const supportOptions = [
        {
            icon: '📧',
            label: 'Email Support',
            desc: 'support@aquabillai.com',
            action: () => window.location.href = 'mailto:support@aquabillai.com'
        },
        {
            icon: '📞',
            label: 'Call Us',
            desc: '+251 912 345 678',
            action: () => window.location.href = 'tel:+251912345678'
        },
        {
            icon: '✈️',
            label: 'Telegram',
            desc: '@AquaBillAI_Bot',
            action: () => window.open('https://t.me/AquaBillAI_Bot', '_blank')
        },
    ];

    // Add report leakage option for logged-in customers
    if (isCustomer) {
        supportOptions.unshift({
            icon: '🚰',
            label: 'Report Leakage',
            desc: 'Report a water leak',
            action: () => { navigate('/report-leakage'); setIsOpen(false); },
            highlight: true,
        });
    }

    return (
        <>
            {/* Floating Button */}
            <button
                className={`support-fab ${isOpen ? 'support-fab--open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Support"
            >
                {isOpen ? '✕' : '💬'}
            </button>

            {/* Support Panel */}
            {isOpen && (
                <>
                    <div className="support-overlay" onClick={() => setIsOpen(false)} />
                    <div className="support-panel">
                        <div className="support-panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>💧</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Need Help?
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        We're here for you
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: 'none', border: 'none', fontSize: '1.2rem',
                                    cursor: 'pointer', color: 'var(--text-tertiary)',
                                    padding: '0.25rem'
                                }}
                            >✕</button>
                        </div>

                        <div className="support-panel-body">
                            {supportOptions.map((option, i) => (
                                <button
                                    key={i}
                                    className={`support-option ${option.highlight ? 'support-option--highlight' : ''}`}
                                    onClick={option.action}
                                >
                                    <span className="support-option-icon">{option.icon}</span>
                                    <div className="support-option-text">
                                        <div className="support-option-label">{option.label}</div>
                                        <div className="support-option-desc">{option.desc}</div>
                                    </div>
                                    <span className="support-option-arrow">→</span>
                                </button>
                            ))}
                        </div>

                        <div className="support-panel-footer">
                            <p>Available Mon–Sat, 8AM – 6PM EAT</p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default SupportWidget;
