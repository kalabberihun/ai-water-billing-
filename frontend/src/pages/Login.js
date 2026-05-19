import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login } from '../store/authSlice';

const Login = () => {
    const location = useLocation();
    const successMessage = location.state?.message;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const loading = useSelector((state) => state.auth.loading);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await dispatch(login({ email, password })).unwrap();
            navigate('/');
        } catch (err) {
            setError(err.error || 'Invalid email or password. Please try again.');
        }
    };

    return (
        <>
            <div className="auth-bg">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
                <div className="orb orb-3"></div>
            </div>
            <div className="auth-wrapper">
                <div className="auth-card">
                    <div className="auth-logo">
                        <div className="auth-logo-icon">💧</div>
                        <h1 className="auth-title">AquaBill AI</h1>
                        <p className="auth-subtitle">Sign in to manage your account</p>
                    </div>

                    {error && (
                        <div className="error-banner">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="error-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeftColor: 'var(--color-success)', color: 'var(--color-success)' }}>
                            <span>✅</span>
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                required
                                className="form-input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--color-accent)', textDecoration: 'none' }}>
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                required
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In →'
                            )}
                        </button>
                    </form>

                    <p className="auth-link">
                        Don't have an account?{' '}
                        <Link to="/register">Create one</Link>
                    </p>
                </div>
            </div>
        </>
    );
};

export default Login;
