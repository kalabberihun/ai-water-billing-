import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';

const ResetPassword = () => {
    const { uidb64, token } = useParams();
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (formData.password !== formData.confirmPassword) {
            setErrorMessage("Passwords do not match.");
            setStatus('error');
            return;
        }

        if (formData.password.length < 8) {
            setErrorMessage("Password must be at least 8 characters long.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/password-reset-confirm`, {
                uidb64: uidb64,
                token: token,
                new_password: formData.password
            });
            setStatus('success');
            
            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login', { state: { message: "Password reset successful. Please log in with your new password." } });
            }, 3000);
            
        } catch (error) {
            setStatus('error');
            setErrorMessage(
                error.response?.data?.error || 
                error.response?.data?.new_password?.[0] || 
                "The password reset link is invalid or has expired."
            );
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
                    <div className="landing-logo-icon" style={{ margin: '0 auto 1.5rem', width: '50px', height: '50px', fontSize: '24px' }}>🔐</div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Set New Password
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        Please enter your new password below.
                    </p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                            fontSize: '3rem', 
                            marginBottom: '1rem',
                            color: '#10b981',
                            animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both'
                        }}>
                            ✅
                        </div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Password Updated!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
                            Your password has been changed successfully. Redirecting to login...
                        </p>
                        <button onClick={() => navigate('/login')} className="landing-btn-primary" style={{ width: '100%' }}>
                            Go to Login Now
                        </button>
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
                            <label className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                required
                                minLength="8"
                                placeholder="••••••••"
                                autoComplete="new-password"
                                style={{ padding: '12px 16px' }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Confirm New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                required
                                minLength="8"
                                placeholder="••••••••"
                                autoComplete="new-password"
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
                            {status === 'loading' ? 'Updating...' : 'Update Password'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
                                Cancel
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
