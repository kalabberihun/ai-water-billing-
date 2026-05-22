import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import SecureImage from '../components/SecureImage';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ClerkDashboard = () => {
    const user = useSelector((state) => state.auth.user);
    const [pendingReadings, setPendingReadings] = useState([]);
    const [fieldTasks, setFieldTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [verifyingId, setVerifyingId] = useState(null);
    const [reviewModal, setReviewModal] = useState(null);
    const [reviewValue, setReviewValue] = useState('');
    const [reviewError, setReviewError] = useState('');
    const [successCount, setSuccessCount] = useState(0);

    // Field Task Submission State
    const [fieldTaskModal, setFieldTaskModal] = useState(null);
    const [fieldTaskImage, setFieldTaskImage] = useState(null);
    const [fieldTaskPreview, setFieldTaskPreview] = useState('');
    const [fieldTaskValue, setFieldTaskValue] = useState('');
    const [fieldTaskError, setFieldTaskError] = useState('');
    const [fieldTaskSubmitting, setFieldTaskSubmitting] = useState(false);

    const getConfig = useCallback(() => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingRes, fieldRes] = await Promise.all([
                axios.get(`${API}/api/metering/clerk/pending-readings`, getConfig()),
                axios.get(`${API}/api/metering/clerk/field-tasks`, getConfig())
            ]);
            setPendingReadings(pendingRes.data);
            setFieldTasks(fieldRes.data);
        } catch (error) {
            console.error('Error fetching clerk data:', error);
        } finally {
            setLoading(false);
        }
    }, [getConfig]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openReview = (reading) => {
        setReviewModal(reading);
        setReviewValue(reading.reading_value != null ? String(reading.reading_value) : '');
        setReviewError('');
    };

    const closeReview = () => {
        setReviewModal(null);
        setReviewValue('');
        setReviewError('');
    };

    const handleVerify = async () => {
        const val = parseFloat(reviewValue);
        if (isNaN(val) || val < 0) {
            setReviewError('Please enter a valid positive number.');
            return;
        }
        setVerifyingId(reviewModal.id);
        try {
            await axios.post(`${API}/api/metering/readings/verify`, {
                reading_id: reviewModal.id,
                confirmed_value: val
            }, getConfig());
            setSuccessCount(c => c + 1);
            closeReview();
            fetchData();
        } catch (error) {
            setReviewError('Verification failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setVerifyingId(null);
        }
    };

    // ── Field Task Handlers ──────────────────────────────────────────────────
    const openFieldTask = (task) => {
        setFieldTaskModal(task);
        setFieldTaskImage(null);
        setFieldTaskPreview('');
        setFieldTaskValue('');
        setFieldTaskError('');
    };

    const closeFieldTask = () => {
        setFieldTaskModal(null);
        setFieldTaskImage(null);
        setFieldTaskPreview('');
        setFieldTaskValue('');
        setFieldTaskError('');
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFieldTaskImage(file);
            const url = URL.createObjectURL(file);
            setFieldTaskPreview(url);
        }
    };

    const submitFieldTask = async () => {
        if (!fieldTaskImage) {
            setFieldTaskError('Please upload a photo of the meter.');
            return;
        }
        if (!fieldTaskValue || isNaN(parseFloat(fieldTaskValue)) || parseFloat(fieldTaskValue) < 0) {
            setFieldTaskError('Please enter a valid positive meter reading.');
            return;
        }

        setFieldTaskSubmitting(true);
        const formData = new FormData();
        formData.append('image', fieldTaskImage);
        formData.append('reading_value', fieldTaskValue);

        try {
            await axios.post(`${API}/api/metering/clerk/field-tasks/${fieldTaskModal.id}/submit`, formData, {
                headers: {
                    ...getConfig().headers,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setSuccessCount(c => c + 1);
            closeFieldTask();
            fetchData();
        } catch (error) {
            setFieldTaskError('Failed to submit reading: ' + (error.response?.data?.error || error.message));
        } finally {
            setFieldTaskSubmitting(false);
        }
    };

    // Time remaining helpers
    const getTimeLeft = (mins) => Math.max(0, 60 - Math.floor(mins));
    const getUrgency = (mins) => {
        if (mins > 50) return { color: 'var(--color-danger)', label: 'Urgent' };
        if (mins > 35) return { color: '#f59e0b', label: 'Soon' };
        return { color: 'var(--color-success)', label: 'On time' };
    };

    const urgentCount = pendingReadings.filter(r => r.assigned_duration_mins > 50).length;

    return (
        <div className="app-layout">
            <Sidebar />

            {/* ── Review Modal ──────────────────────────────────────────── */}
            {reviewModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '520px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Confirm Reading</h2>
                            <button
                                onClick={closeReview}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
                            >×</button>
                        </div>

                        <div style={{
                            display: 'flex', gap: '1rem', marginBottom: '1.25rem',
                            background: 'var(--bg-body)', borderRadius: '10px', padding: '0.75rem 1rem',
                            border: '1px solid var(--border-default)'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reviewModal.customer || 'Unknown'}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meter</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{reviewModal.meter}</div>
                            </div>
                        </div>

                        {reviewModal.image_url && (
                            <div style={{
                                marginBottom: '1.25rem', borderRadius: '12px',
                                overflow: 'hidden', border: '1px solid var(--border-default)',
                                position: 'relative'
                            }}>
                                <SecureImage
                                    src={reviewModal.image_url.startsWith('http') ? reviewModal.image_url : `${API}${reviewModal.image_url}`}
                                    alt="Meter reading"
                                    style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', background: 'var(--color-primary)' }}
                                />
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                    padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span style={{ color: 'var(--color-text-inverse)', fontSize: '0.85rem' }}>📷 Meter Photo</span>
                                    {reviewModal.ocr_confidence && (
                                        <span style={{
                                            background: 'rgba(245,158,11,0.9)', color: 'var(--color-text)',
                                            borderRadius: '9999px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700
                                        }}>
                                            AI: {Math.round(reviewModal.ocr_confidence * 100)}% confident
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: '0.5rem'
                            }}>
                                <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Confirmed Reading (m³)
                                </label>
                                {reviewModal.reading_value != null && (
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        AI suggested: <strong style={{ color: 'var(--text-primary)' }}>{reviewModal.reading_value}</strong>
                                    </span>
                                )}
                            </div>
                            <input
                                type="number" min="0" step="0.01" value={reviewValue}
                                onChange={e => { setReviewValue(e.target.value); setReviewError(''); }}
                                placeholder="Enter the actual reading..."
                                style={{
                                    width: '100%', padding: '0.875rem 1rem', borderRadius: '10px',
                                    border: reviewError ? '1px solid #ef4444' : '1px solid var(--border-default)',
                                    background: 'var(--bg-body)', color: 'var(--text-primary)',
                                    fontSize: '1.1rem', fontWeight: 600, boxSizing: 'border-box'
                                }}
                            />
                            {reviewModal.reading_value != null && (
                                <button
                                    onClick={() => setReviewValue(String(reviewModal.reading_value))}
                                    style={{
                                        marginTop: '0.4rem', background: 'none', border: 'none',
                                        color: 'var(--color-accent)', fontSize: '0.8rem', cursor: 'pointer', padding: 0
                                    }}
                                >
                                    Use AI value ({reviewModal.reading_value})
                                </button>
                            )}
                        </div>

                        {reviewError && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
                                borderRadius: '8px', padding: '0.6rem 1rem',
                                color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem'
                            }}>{reviewError}</div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={closeReview}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleVerify}
                                disabled={verifyingId === reviewModal.id || !reviewValue}
                                style={{
                                    flex: 2,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    opacity: !reviewValue ? 0.5 : 1
                                }}
                            >
                                {verifyingId === reviewModal.id ? '⏳ Confirming...' : '✓ Confirm & Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Field Task Submit Modal ──────────────────────────────────────────── */}
            {fieldTaskModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '520px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Submit Field Reading</h2>
                            <button
                                onClick={closeFieldTask}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
                            >×</button>
                        </div>

                        <div style={{
                            display: 'flex', gap: '1rem', marginBottom: '1.25rem',
                            background: 'var(--bg-body)', borderRadius: '10px', padding: '0.75rem 1rem',
                            border: '1px solid var(--border-default)'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fieldTaskModal.customer}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{fieldTaskModal.address}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meter</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fieldTaskModal.meter}</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                                1. Upload Meter Photo
                            </label>
                            {fieldTaskPreview ? (
                                <div style={{ position: 'relative', marginBottom: '0.5rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                    <img src={fieldTaskPreview} alt="Preview" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', background: 'var(--color-primary)' }} />
                                    <button 
                                        onClick={() => { setFieldTaskImage(null); setFieldTaskPreview(''); }}
                                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.9)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer' }}
                                    >✕</button>
                                </div>
                            ) : (
                                <div style={{ 
                                    border: '2px dashed var(--border-default)', borderRadius: '12px', padding: '2rem',
                                    textAlign: 'center', background: 'var(--bg-body)', cursor: 'pointer' 
                                }} onClick={() => document.getElementById('field-img-upload').click()}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Click to capture or upload photo</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Must be clear and readable</div>
                                    <input 
                                        id="field-img-upload" type="file" accept="image/*" capture="environment" 
                                        onChange={handleImageChange} style={{ display: 'none' }} 
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                                2. Manual Reading Value (m³)
                            </label>
                            <input
                                type="number" min="0" step="0.01" value={fieldTaskValue}
                                onChange={e => { setFieldTaskValue(e.target.value); setFieldTaskError(''); }}
                                placeholder="Enter exactly what you see on the meter..."
                                style={{
                                    width: '100%', padding: '0.875rem 1rem', borderRadius: '10px',
                                    border: fieldTaskError.includes('reading') ? '1px solid #ef4444' : '1px solid var(--border-default)',
                                    background: 'var(--bg-body)', color: 'var(--text-primary)',
                                    fontSize: '1.1rem', fontWeight: 600, boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {fieldTaskError && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
                                borderRadius: '8px', padding: '0.6rem 1rem',
                                color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem'
                            }}>{fieldTaskError}</div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={closeFieldTask}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={submitFieldTask}
                                disabled={fieldTaskSubmitting || !fieldTaskImage || !fieldTaskValue}
                                style={{
                                    flex: 2,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    opacity: (!fieldTaskImage || !fieldTaskValue) ? 0.5 : 1
                                }}
                            >
                                {fieldTaskSubmitting ? '⏳ Submitting...' : '✓ Submit Reading'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="main-content">
                <header className="content-header">
                    <div>
                        <h1 className="content-title">Welcome, {user?.first_name || 'Clerk'}!</h1>
                        <p className="content-subtitle">Review and confirm the meter readings assigned to you</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
                        {loading ? '⏳' : '↻'} Refresh
                    </button>
                </header>

                <div className="content-body">

                    {/* ── Stat Cards ─────────────────────────────────────── */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon amber">📋</div>
                            <div className="stat-value">{pendingReadings.length}</div>
                            <div className="stat-label">AI Reviews Assigned</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">📍</div>
                            <div className="stat-value">{fieldTasks.length}</div>
                            <div className="stat-label">Field Tasks Assigned</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon rose">⚠️</div>
                            <div className="stat-value" style={{ color: urgentCount > 0 ? '#ef4444' : 'inherit' }}>
                                {urgentCount}
                            </div>
                            <div className="stat-label">Urgent (expiring soon)</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon teal">✔️</div>
                            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{successCount}</div>
                            <div className="stat-label">Approved This Session</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">🕐</div>
                            <div className="stat-value">
                                {pendingReadings.length > 0
                                    ? `${Math.round(pendingReadings.reduce((a, r) => a + getTimeLeft(r.assigned_duration_mins), 0) / pendingReadings.length)}m`
                                    : '—'
                                }
                            </div>
                            <div className="stat-label">Avg Time Remaining</div>
                        </div>
                    </div>

                    {/* ── Urgent alert banner ─────────────────────────────── */}
                    {urgentCount > 0 && (
                        <div style={{
                            margin: '1.5rem 0', padding: '1rem 1.25rem',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem'
                        }}>
                            <div style={{ fontSize: '1.5rem' }}>🚨</div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                    {urgentCount} reading{urgentCount > 1 ? 's' : ''} expiring soon!
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Please review them before the 1-hour window expires — they will be auto-reassigned.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Readings Queue ──────────────────────────────────── */}
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">
                                Your Assignment Queue
                                {pendingReadings.length > 0 && (
                                    <span style={{
                                        marginLeft: '0.75rem', background: '#f59e0b', color: 'var(--color-text)',
                                        borderRadius: '9999px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700
                                    }}>{pendingReadings.length}</span>
                                )}
                            </h2>
                        </div>
                        <div className="panel-body" style={{ padding: 0 }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                                    Loading your assignments...
                                </div>
                            ) : pendingReadings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                                        All clear!
                                    </div>
                                    <div style={{ fontSize: '0.9rem' }}>
                                        No readings are currently assigned to you.
                                    </div>
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Meter</th>
                                            <th>Submitted</th>
                                            <th>AI Reading</th>
                                            <th>Time Left</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingReadings.map(reading => {
                                            const timeLeft = getTimeLeft(reading.assigned_duration_mins);
                                            const urgency = getUrgency(reading.assigned_duration_mins);
                                            return (
                                                <tr key={reading.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{reading.customer || 'Unassigned'}</div>
                                                    </td>
                                                    <td><code style={{ fontSize: '0.85rem' }}>{reading.meter}</code></td>
                                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {reading.submitted}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {reading.reading_value != null ? (
                                                            <>
                                                                {reading.reading_value} m³
                                                                {reading.ocr_confidence != null && (
                                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4, fontSize: '0.8rem' }}>
                                                                        ({Math.round(reading.ocr_confidence * 100)}%)
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                background: urgency.color, flexShrink: 0
                                                            }} />
                                                            <span style={{ color: urgency.color, fontWeight: 600 }}>
                                                                {timeLeft}m
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            style={{
                                                                padding: '6px 16px',
                                                                background: 'linear-gradient(135deg, #10b981, #059669)'
                                                            }}
                                                            onClick={() => openReview(reading)}
                                                        >
                                                            Review
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* ── Field Tasks Queue ──────────────────────────────────── */}
                    {fieldTasks.length > 0 && (
                        <div className="panel" style={{ marginTop: '2rem' }}>
                            <div className="panel-header">
                                <h2 className="panel-title">
                                    Your Field Tasks
                                    <span style={{
                                        marginLeft: '0.75rem', background: '#3b82f6', color: 'var(--color-text-inverse)',
                                        borderRadius: '9999px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700
                                    }}>{fieldTasks.length}</span>
                                </h2>
                            </div>
                            <div className="panel-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Customer & Location</th>
                                            <th>Meter</th>
                                            <th>Assigned At</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fieldTasks.map(task => (
                                            <tr key={task.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{task.customer}</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{task.address}</div>
                                                </td>
                                                <td><code style={{ fontSize: '0.85rem' }}>{task.meter}</code></td>
                                                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {task.assigned_at}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{
                                                            padding: '6px 16px',
                                                            background: 'var(--color-accent)'
                                                        }}
                                                        onClick={() => openFieldTask(task)}
                                                    >
                                                        📍 Take Reading
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default ClerkDashboard;
