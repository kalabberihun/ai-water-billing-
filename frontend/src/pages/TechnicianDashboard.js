import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const TechnicianDashboard = () => {
    const user = useSelector((state) => state.auth.user);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Resolve modal state
    const [resolveModal, setResolveModal] = useState(null);
    const [statusVal, setStatusVal] = useState('IN_PROGRESS');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const getConfig = () => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/api/metering/technician/maintenance`, getConfig());
            setTasks(res.data);
        } catch (error) {
            console.error('Error fetching technician tasks:', error);
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchData(); }, [fetchData]);

    const openResolve = (task) => {
        setResolveModal(task);
        setStatusVal(task.status);
        setResolutionNotes(task.resolution_notes || '');
        setErrorMsg('');
    };

    const closeResolve = () => {
        setResolveModal(null);
    };

    const handleSubmit = async () => {
        if (statusVal === 'RESOLVED' && !resolutionNotes.trim()) {
            setErrorMsg('Please provide resolution notes before marking as Resolved.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.patch(`${API}/api/metering/technician/maintenance/${resolveModal.id}`, {
                status: statusVal,
                resolution_notes: resolutionNotes
            }, getConfig());
            
            closeResolve();
            fetchData();
        } catch (error) {
            setErrorMsg('Failed to update task: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this maintenance task?')) return;
        try {
            await axios.delete(`${API}/api/metering/technician/maintenance/${taskId}`, getConfig());
            fetchData();
        } catch (error) {
            alert('Failed to delete task: ' + (error.response?.data?.error || error.message));
        }
    };

    // Calculate metrics
    const pendingTasks = tasks.filter(t => t.status === 'PENDING');
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
    const resolvedTasks = tasks.filter(t => t.status === 'RESOLVED').length;

    return (
        <div className="app-layout">
            <Sidebar />

            {/* ── Resolve Modal ──────────────────────────────────────────── */}
            {resolveModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Update Maintenance Task</h2>
                            <button onClick={closeResolve} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                        </div>
                        
                        <div style={{
                            background: 'var(--bg-body)', borderRadius: '10px', padding: '1rem',
                            border: '1px solid var(--border-default)', marginBottom: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Meter Number:</span>
                                    <div style={{ fontWeight: 600 }}><code>{resolveModal.meter_number}</code></div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Customer:</span>
                                    <div style={{ fontWeight: 600 }}>{resolveModal.customer_name || 'N/A'}</div>
                                </div>
                            </div>
                            
                            <hr style={{ borderColor: 'var(--border-default)', margin: '0.75rem 0' }} />
                            
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Issue Description:</span>
                                <div style={{ color: 'var(--text-primary)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                                    {resolveModal.issue_description}
                                </div>
                            </div>
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Update Status</label>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            {['PENDING', 'IN_PROGRESS', 'RESOLVED'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setStatusVal(opt)}
                                    style={{
                                        flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer',
                                        background: statusVal === opt 
                                            ? (opt === 'RESOLVED' ? '#10b981' : opt === 'IN_PROGRESS' ? '#3b82f6' : '#f59e0b') 
                                            : 'var(--bg-body)',
                                        color: statusVal === opt ? '#fff' : 'var(--text-secondary)',
                                        border: '1px solid var(--border-default)',
                                        fontWeight: statusVal === opt ? 700 : 400
                                    }}
                                >
                                    {opt === 'IN_PROGRESS' ? 'In Progress' : opt === 'RESOLVED' ? 'Resolved' : 'Pending'}
                                </button>
                            ))}
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Resolution Notes / Findings</label>
                        <textarea
                            rows={3}
                            value={resolutionNotes}
                            onChange={(e) => { setResolutionNotes(e.target.value); setErrorMsg(''); }}
                            placeholder="Detail what was checked or fixed..."
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '10px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-body)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', boxSizing: 'border-box',
                                marginBottom: '1rem', resize: 'vertical'
                            }}
                        />

                        {errorMsg && (
                            <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMsg}</div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={closeResolve} style={{ flex: 1 }} disabled={submitting}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit} 
                                style={{ flex: 2, background: 'var(--color-accent)' }} 
                                disabled={submitting}
                            >
                                {submitting ? 'Saving...' : 'Save Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="main-content">
                <header className="content-header">
                    <div>
                        <h1 className="content-title">Welcome, {user?.first_name || 'Technician'}!</h1>
                        <p className="content-subtitle">Review your physical field inspection assignments</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
                        {loading ? '⏳' : '↻'} Refresh
                    </button>
                </header>

                <div className="content-body">
                    {/* ── Stat Cards ─────────────────────────────────────── */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon amber">⏳</div>
                            <div className="stat-value">{pendingTasks.length}</div>
                            <div className="stat-label">Pending Inspections</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">🔧</div>
                            <div className="stat-value">{inProgressTasks.length}</div>
                            <div className="stat-label">In Progress</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon teal">✅</div>
                            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{resolvedTasks}</div>
                            <div className="stat-label">Resolved Tasks</div>
                        </div>
                    </div>

                    {/* ── Task Queue ──────────────────────────────────── */}
                    <div className="panel" style={{ marginTop: '2rem' }}>
                        <div className="panel-header">
                            <h2 className="panel-title">Your Inspection Queue</h2>
                        </div>
                        <div className="panel-body" style={{ padding: 0 }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>⏳ Loading your field tasks...</div>
                            ) : tasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>All clear!</div>
                                    <div style={{ fontSize: '0.9rem' }}>No meters need inspection at this time.</div>
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Meter Number</th>
                                            <th>Date Assigned</th>
                                            <th>Issue</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tasks.map(task => (
                                            <tr key={task.id}>
                                                <td><code style={{ fontSize: '0.9rem', fontWeight: 600 }}>{task.meter_number}</code></td>
                                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    {new Date(task.created_at).toLocaleDateString()}
                                                </td>
                                                <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {task.issue_description}
                                                </td>
                                                <td>
                                                    <span className={`badge ${task.status === 'RESOLVED' ? 'badge-info' : task.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-warning'}`}>
                                                        {task.status === 'IN_PROGRESS' ? '🔧 In Progress' : task.status === 'RESOLVED' ? '✅ Resolved' : '⏳ Pending'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{ background: task.status === 'RESOLVED' ? 'var(--bg-body)' : 'var(--accent-500)', color: task.status === 'RESOLVED' ? 'var(--text-primary)' : '#fff', border: task.status === 'RESOLVED' ? '1px solid var(--border-default)' : 'none' }}
                                                        onClick={() => openResolve(task)}
                                                    >
                                                        {task.status === 'RESOLVED' ? 'View/Edit' : 'Update'}
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm" 
                                                        onClick={() => handleDeleteTask(task.id)}
                                                        style={{ marginLeft: '0.5rem', padding: '4px 8px', fontSize: '0.8rem', background: 'transparent', border: '1px solid #ef4444', color: 'var(--color-danger)', cursor: 'pointer', borderRadius: '4px' }}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TechnicianDashboard;
