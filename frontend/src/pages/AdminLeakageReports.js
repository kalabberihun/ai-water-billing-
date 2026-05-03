import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AdminLeakageReports = () => {
    const [reports, setReports] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const getConfig = () => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    };

    useEffect(() => {
        const fetchData = async () => {
            const config = getConfig();

            // Fetch reports — this is the primary data
            try {
                const reportsRes = await axios.get(`${API_URL}/api/metering/admin/leakage-reports`, config);
                setReports(reportsRes.data || []);
            } catch (err) {
                console.error('Failed to fetch leakage reports:', err);
                setError('Failed to fetch leakage reports.');
            }

            // Fetch technicians — secondary, don't let it break the page
            try {
                const usersRes = await axios.get(`${API_URL}/api/auth/admin/users`, config);
                if (usersRes.data && usersRes.data.users) {
                    const techs = usersRes.data.users.filter(u => 
                        u.role === 'Technician' || u.role === 'TECHNICIAN'
                    );
                    setTechnicians(techs);
                }
            } catch (err) {
                console.error('Failed to fetch technicians:', err);
            }

            setLoading(false);
        };
        fetchData();
    }, []);

    const handleUpdate = async (reportId, newStatus, adminNotes, technicianId) => {
        setError('');
        setSuccess('');
        
        try {
            const payload = {
                status: newStatus,
                admin_notes: adminNotes
            };

            if (newStatus === 'DISPATCHED') {
                if (!technicianId) {
                    setError('Please select a technician to dispatch.');
                    return;
                }
                payload.technician_id = technicianId;
            }

            const res = await axios.patch(`${API_URL}/api/metering/admin/leakage-reports/${reportId}`, payload, getConfig());
            
            // Update local state
            setReports(reports.map(r => r.id === reportId ? res.data : r));
            setSuccess(`Report status updated to ${newStatus}`);
            
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update report.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const statusColors = {
        SUBMITTED: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
        UNDER_REVIEW: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
        DISPATCHED: { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' },
        RESOLVED: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
    };

    const urgencyColors = {
        LOW: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: '🟢' },
        MEDIUM: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: '🟡' },
        HIGH: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: '🟠' },
        CRITICAL: { bg: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', icon: '🔴' },
    };

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="spinner"></div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">🚰 Leakage Reports Management</h1>
                        <p className="content-subtitle">Review, update, and dispatch technicians for customer-reported water leaks.</p>
                    </div>
                </div>

                <div className="content-body">
                    {success && (
                        <div className="error-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeftColor: '#10b981', color: '#10b981', marginBottom: '1.5rem' }}>
                            <span>✅</span><span>{success}</span>
                        </div>
                    )}
                    {error && (
                        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
                            <span>⚠️</span><span>{error}</span>
                        </div>
                    )}

                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Meter</th>
                                    <th>Urgency</th>
                                    <th>Location / Details</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                                            No leakage reports found.
                                        </td>
                                    </tr>
                                ) : (
                                    reports.map(report => (
                                        <ReportRow 
                                            key={report.id} 
                                            report={report} 
                                            technicians={technicians}
                                            onUpdate={handleUpdate}
                                            urgencyColors={urgencyColors}
                                            statusColors={statusColors}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

// Component for individual row to manage local edit state
const ReportRow = ({ report, technicians, onUpdate, urgencyColors, statusColors }) => {
    const [status, setStatus] = useState(report.status);
    const [adminNotes, setAdminNotes] = useState(report.admin_notes || '');
    const [technicianId, setTechnicianId] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const urg = urgencyColors[report.urgency] || urgencyColors.MEDIUM;
    const stat = statusColors[report.status] || statusColors.SUBMITTED;

    const handleSave = () => {
        onUpdate(report.id, status, adminNotes, technicianId);
        setIsEditing(false);
    };

    return (
        <tr style={{ borderLeft: `3px solid ${urg.color}` }}>
            <td style={{ whiteSpace: 'nowrap' }}>
                {new Date(report.created_at).toLocaleDateString()}
                <br />
                <small style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </small>
            </td>
            <td>
                <strong>{report.customer_name}</strong>
                <br />
                <small style={{ color: 'var(--text-tertiary)' }}>{report.customer_email}</small>
            </td>
            <td>
                {report.meter_number ? (
                    <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {report.meter_number}
                    </span>
                ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>General Area</span>
                )}
            </td>
            <td>
                <span className="badge" style={{ background: urg.bg, color: urg.color }}>
                    {urg.icon} {report.urgency}
                </span>
            </td>
            <td style={{ maxWidth: '250px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    {report.location_description}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {report.description}
                </div>
                {report.admin_notes && !isEditing && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--primary-400)', background: 'rgba(59, 130, 246, 0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        <strong>Note:</strong> {report.admin_notes}
                    </div>
                )}
            </td>
            <td>
                {isEditing ? (
                    <select 
                        className="form-input" 
                        style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="SUBMITTED">Submitted</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="DISPATCHED">Dispatched</option>
                        <option value="RESOLVED">Resolved</option>
                    </select>
                ) : (
                    <span className="badge" style={{ background: stat.bg, color: stat.color }}>
                        {report.status.replace('_', ' ')}
                    </span>
                )}
            </td>
            <td>
                {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {status === 'DISPATCHED' && (
                            <select 
                                className="form-input" 
                                style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                                value={technicianId} 
                                onChange={(e) => setTechnicianId(e.target.value)}
                            >
                                <option value="">-- Select Technician --</option>
                                {technicians.map(t => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                            </select>
                        )}
                        <textarea 
                            className="form-input" 
                            style={{ padding: '0.25rem', fontSize: '0.85rem', minHeight: '40px', resize: 'vertical' }}
                            placeholder="Add note for customer..."
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={handleSave} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', flex: 1 }}>Save</button>
                            <button onClick={() => setIsEditing(false)} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="btn btn-ghost" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        disabled={report.status === 'RESOLVED'}
                    >
                        {report.status === 'RESOLVED' ? 'Resolved' : 'Update'}
                    </button>
                )}
            </td>
        </tr>
    );
};

export default AdminLeakageReports;
