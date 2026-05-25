import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/password-reset`, { email });
            setStatus('success');
        } catch (error) {
            // Even if it fails, we typically don't reveal if the email exists for security
            // But if there's a validation error with the email format or server offline, we show it
            if (error.response && error.response.status === 400 && error.response.data.email) {
                setErrorMessage(error.response.data.email[0]);
                setStatus('error');
            } else {
                setStatus('success'); // General security best practice: act like it succeeded to avoid enumeration
            }
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: 'var(--space-md)'
        }}>
            {/* Background effects */}
            <div className="landing-bg">
                <div className="landing-orb landing-orb-1"></div>
                <div className="landing-orb landing-orb-2"></div>
            </div>

            <ThemeToggle />

            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'var(--bg-card)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-xl)',
                padding: '3rem 2.5rem',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div className="landing-logo-icon" style={{ margin: '0 auto 1.5rem', width: '50px', height: '50px', fontSize: '24px' }}>💧</div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Reset Password
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                            fontSize: '3rem', 
                            marginBottom: '1rem',
                            color: '#10b981',
                            animation: 'fadeInUp 0.5s ease both'
                        }}>
                            ✉️
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Check your email</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
                            If an account exists for <strong>{email}</strong>, we have sent instructions to reset your password.
                        </p>
                        <Link to="/login" className="landing-btn-primary" style={{ width: '100%', display: 'block' }}>
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {status === 'error' && (
                            <div style={{
                                padding: '12px 16px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderLeft: '4px solid #ef4444',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--color-danger)',
                                fontSize: '0.85rem'
                            }}>
                                {errorMessage}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder=""
                                style={{ padding: '12px 16px' }}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="landing-btn-primary"
                            disabled={status === 'loading'}
                            style={{ 
                                width: '100%', 
                                padding: '14px', 
                                marginTop: '0.5rem',
                                opacity: status === 'loading' ? 0.7 : 1,
                                cursor: status === 'loading' ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {status === 'loading' ? 'Sending request...' : 'Send Reset Link'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none', transition: 'color 0.2s' }}
                                onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                                onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                            >
                                ← Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
