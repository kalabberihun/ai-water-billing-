import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        national_id: '',
        meter_number: '',
        phone: '',
        address: '',
        city: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/register`, formData);
            navigate('/login');
        } catch (err) {
            const data = err.response?.data;
            if (data && typeof data === 'object') {
                // DRF returns field-level errors as { field: ["msg", ...] }
                const messages = Object.entries(data)
                    .map(([field, msgs]) => {
                        const label = field.replace(/_/g, ' ');
                        const msg = Array.isArray(msgs) ? msgs[0] : msgs;
                        return `${label}: ${msg}`;
                    })
                    .join('  •  ');
                setError(messages || 'Registration failed. Please try again.');
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
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
                <div className="auth-card" style={{ maxWidth: 520 }}>
                    <div className="auth-logo">
                        <div className="auth-logo-icon">💧</div>
                        <h1 className="auth-title">AquaBill AI</h1>
                        <p className="auth-subtitle">Join the smart AquaBill AI platform</p>
                    </div>

                    {error && (
                        <div className="error-banner">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="John"
                                    value={formData.first_name}
                                    onChange={handleChange('first_name')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="Doe"
                                    value={formData.last_name}
                                    onChange={handleChange('last_name')}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                required
                                className="form-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange('email')}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                required
                                className="form-input"
                                placeholder="Minimum 8 characters"
                                value={formData.password}
                                onChange={handleChange('password')}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">National ID</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="ID Number"
                                    value={formData.national_id}
                                    onChange={handleChange('national_id')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="+254..."
                                    value={formData.phone}
                                    onChange={handleChange('phone')}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Meter Number</label>
                            <input
                                type="text"
                                required
                                className="form-input"
                                placeholder="MTR-XXXX"
                                value={formData.meter_number}
                                onChange={handleChange('meter_number')}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Street address"
                                    value={formData.address}
                                    onChange={handleChange('address')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">City</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="City"
                                    value={formData.city}
                                    onChange={handleChange('city')}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Creating account...
                                </>
                            ) : (
                                'Create Account →'
                            )}
                        </button>
                    </form>

                    <p className="auth-link">
                        Already have an account?{' '}
                        <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </>
    );
};

export default Register;
