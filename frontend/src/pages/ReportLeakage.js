import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ReportLeakage = () => {
    const user = useSelector((state) => state.auth.user);
    const [meters, setMeters] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        meter: '',
        location_description: '',
        urgency: 'MEDIUM',
        description: '',
    });

    const getConfig = () => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = getConfig();
                const [metersRes, reportsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/metering/meters`, config),
                    axios.get(`${API_URL}/api/metering/leakage-reports`, config),
                ]);
                const metersData = metersRes.data.results !== undefined ? metersRes.data.results : metersRes.data;
                const reportsData = reportsRes.data.results !== undefined ? reportsRes.data.results : reportsRes.data;
                
                setMeters(metersData);
                setReports(reportsData);
                if (metersData.length > 0) {
                    setFormData(prev => ({ ...prev, meter: metersData[0].id }));
                }
            } catch (err) {
                console.error('Failed to load data', err);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const payload = { ...formData };
            if (payload.meter === '') {
                payload.meter = null;
            }
            const res = await axios.post(`${API_URL}/api/metering/leakage-reports`, payload, getConfig());
            setSuccess('Your leakage report has been submitted successfully! Our team will investigate shortly.');
            setReports(prev => [res.data, ...prev]);
            setFormData(prev => ({
                ...prev,
                location_description: '',
                urgency: 'MEDIUM',
                description: '',
            }));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const urgencyColors = {
        LOW: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: '🟢' },
        MEDIUM: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: '🟡' },
        HIGH: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: '🟠' },
        CRITICAL: { bg: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', icon: '🔴' },
    };

    const statusColors = {
        SUBMITTED: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
        UNDER_REVIEW: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
        DISPATCHED: { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' },
        RESOLVED: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">🚰 Report Water Leakage</h1>
                        <p className="content-subtitle">Help us locate and fix water leaks quickly. Submit a detailed report below.</p>
                    </div>
                </div>

                <div className="content-body">
                    {/* Report Form */}
                    <div className="panel" style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        marginBottom: '2rem'
                    }}>
                        <div className="panel-header" style={{ borderBottomColor: 'rgba(59, 130, 246, 0.1)' }}>
                            <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📋</span> New Leakage Report
                            </h3>
                        </div>
                        <div className="panel-body">
                            {success && (
                                <div className="error-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeftColor: '#10b981', color: '#10b981', marginBottom: '1.5rem' }}>
                                    <span>✅</span>
                                    <span>{success}</span>
                                </div>
                            )}
                            {error && (
                                <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
                                    <span>⚠️</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Affected Meter</label>
                                        <select
                                            className="form-input"
                                            value={formData.meter}
                                            onChange={(e) => setFormData({ ...formData, meter: e.target.value })}
                                        >
                                            <option value="">-- Not sure / General area --</option>
                                            {meters.map(m => (
                                                <option key={m.id} value={m.id}>{m.meter_number}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Urgency Level</label>
                                        <div className="urgency-selector">
                                            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    className={`urgency-btn ${formData.urgency === level ? 'active' : ''}`}
                                                    onClick={() => setFormData({ ...formData, urgency: level })}
                                                    style={{
                                                        background: formData.urgency === level
                                                            ? urgencyColors[level].bg
                                                            : 'var(--bg-secondary)',
                                                        color: formData.urgency === level
                                                            ? urgencyColors[level].color
                                                            : 'var(--text-secondary)',
                                                        borderColor: formData.urgency === level
                                                            ? urgencyColors[level].color
                                                            : 'var(--border-subtle)',
                                                    }}
                                                >
                                                    {urgencyColors[level].icon} {level}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label">Location Description *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Near main meter on the left side of the house, street pipe near gate..."
                                        value={formData.location_description}
                                        onChange={(e) => setFormData({ ...formData, location_description: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label">What are you observing? *</label>
                                    <textarea
                                        className="form-input"
                                        rows="4"
                                        placeholder="Describe the leak in detail: Is it a drip, spray, or pooling water? When did you first notice it? Any unusual sounds?"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                        style={{ resize: 'vertical', minHeight: '100px' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                    style={{ width: 'auto', padding: '0.75rem 2rem' }}
                                >
                                    {loading ? (
                                        <>
                                            <div className="spinner"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        '🚨 Submit Report'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Previous Reports */}
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Your Previous Reports</h3>
                            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                {reports.length} total
                            </span>
                        </div>
                        <div className="panel-body">
                            {reports.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💧</div>
                                    <p>No reports submitted yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {reports.map(report => {
                                        const urg = urgencyColors[report.urgency] || urgencyColors.MEDIUM;
                                        const stat = statusColors[report.status] || statusColors.SUBMITTED;
                                        return (
                                            <div key={report.id} style={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '12px',
                                                padding: '1.25rem',
                                                borderLeft: `4px solid ${urg.color}`,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <span className="badge" style={{ background: urg.bg, color: urg.color }}>
                                                            {urg.icon} {report.urgency}
                                                        </span>
                                                        <span className="badge" style={{ background: stat.bg, color: stat.color }}>
                                                            {report.status.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                                        {new Date(report.created_at).toLocaleDateString('en-US', {
                                                            month: 'short', day: 'numeric', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                    <strong>📍 Location:</strong> {report.location_description}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                    {report.description}
                                                </div>
                                                {report.admin_notes && (
                                                    <div style={{
                                                        marginTop: '0.75rem',
                                                        padding: '0.75rem',
                                                        background: 'rgba(59, 130, 246, 0.05)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--primary-400)',
                                                    }}>
                                                        <strong>Admin Response:</strong> {report.admin_notes}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportLeakage;
