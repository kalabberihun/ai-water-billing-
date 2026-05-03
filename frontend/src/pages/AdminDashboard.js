import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import Sidebar from '../components/Sidebar';
import SecureImage from '../components/SecureImage';

const SearchableSelect = ({ options, value, onChange, placeholder }) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    
    const selectedOption = options.find(o => o.value === value);
    const displayValue = selectedOption ? selectedOption.label : search;

    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ position: 'relative', width: '100%', marginBottom: '1rem' }}>
            <input 
                type="text" 
                placeholder={placeholder}
                value={open ? search : displayValue}
                onChange={e => { setSearch(e.target.value); setOpen(true); if(!e.target.value) onChange(''); }}
                onFocus={() => { setOpen(true); setSearch(''); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                style={{ 
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', 
                    border: '1px solid var(--border-default)', background: 'var(--bg-body)', 
                    color: 'var(--text-primary)', fontSize: '0.95rem' 
                }}
            />
            {open && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', 
                    borderRadius: '8px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', 
                    zIndex: 1000, boxShadow: 'var(--shadow-lg)' 
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>No matches</div>
                    ) : filtered.map(opt => (
                        <div 
                            key={opt.value} 
                            onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                            style={{ 
                                padding: '0.75rem 1rem', cursor: 'pointer', 
                                background: value === opt.value ? 'rgba(52,120,255,0.2)' : 'transparent', 
                                color: 'var(--text-primary)', fontSize: '0.95rem',
                                borderBottom: '1px solid var(--border-subtle)'
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.target.style.background = value === opt.value ? 'rgba(52,120,255,0.2)' : 'transparent'}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AdminDashboard = ({ section = 'dashboard' }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        pendingReadings: 0,
        totalRevenue: 0,
        activeMeters: 0,
        revenueHistory: [],
        collectionStats: []
    });
    const [pendingReadings, setPendingReadings] = useState([]);
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [verifyingId, setVerifyingId] = useState(null);

    // Reading review modal
    const [reviewModal, setReviewModal] = useState(null);
    const [reviewValue, setReviewValue] = useState('');
    const [reviewError, setReviewError] = useState('');

    // Dispute resolve modal
    const [disputeModal, setDisputeModal] = useState(null);
    const [disputeAction, setDisputeAction] = useState('RESOLVED');
    const [disputeNotes, setDisputeNotes] = useState('');
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);
    const [disputeError, setDisputeError] = useState('');

    // Role management
    const [allUsers, setAllUsers] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [roleSearch, setRoleSearch] = useState('');
    const [updatingRoleId, setUpdatingRoleId] = useState(null);

    // Maintenance management
    const [maintenanceTasks, setMaintenanceTasks] = useState([]);
    const [allMeters, setAllMeters] = useState([]);
    const [maintModal, setMaintModal] = useState(false);
    const [maintForm, setMaintForm] = useState({ meter_id: '', assigned_to: '', issue_description: '' });
    const [maintSubmitting, setMaintSubmitting] = useState(false);
    const [maintError, setMaintError] = useState('');



    const getConfig = () => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    };

    const fetchData = async () => {
        try {
            const [statsRes, readingsRes, disputesRes, usersRes, tasksRes, metersRes] = await Promise.all([
                axios.get(`${API}/api/auth/admin/stats`, getConfig()),
                axios.get(`${API}/api/auth/admin/pending-readings`, getConfig()),
                axios.get(`${API}/api/auth/admin/disputes`, getConfig()),
                axios.get(`${API}/api/auth/admin/users`, getConfig()),
                axios.get(`${API}/api/metering/admin/maintenance`, getConfig()),
                axios.get(`${API}/api/metering/meters`, getConfig()),
            ]);
            setStats(statsRes.data);
            setPendingReadings(readingsRes.data);
            setDisputes(disputesRes.data);
            setAllUsers(usersRes.data.users || []);
            setAllRoles(usersRes.data.roles || []);
            setMaintenanceTasks(tasksRes.data);
            setAllMeters(metersRes.data.results || metersRes.data);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Reading review handlers ───────────────────────────────────────────────
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
            closeReview();
            fetchData();
        } catch (error) {
            setReviewError('Verification failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setVerifyingId(null);
        }
    };

    // ── Batch assign handler ─────────────────────────────────────────────────
    const handleBatchAssign = async () => {
        try {
            await axios.post(`${API}/api/metering/admin/batch-assign`, {}, getConfig());
            alert('Batch assigned to clerks successfully!');
            fetchData();
        } catch (error) {
            alert('Batch assign failed: ' + (error.response?.data?.error || error.message));
        }
    };

    // ── Dispute handlers ─────────────────────────────────────────────────────
    const openDisputeModal = (dispute) => {
        setDisputeModal(dispute);
        setDisputeAction('RESOLVED');
        setDisputeNotes('');
        setDisputeError('');
    };

    const closeDisputeModal = () => {
        setDisputeModal(null);
        setDisputeNotes('');
        setDisputeError('');
    };

    const handleDisputeSubmit = async () => {
        setDisputeSubmitting(true);
        try {
            await axios.patch(
                `${API}/api/billing/disputes/${disputeModal.id}/resolve/`,
                { status: disputeAction, admin_notes: disputeNotes },
                getConfig()
            );
            closeDisputeModal();
            fetchData();
        } catch (error) {
            setDisputeError('Failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setDisputeSubmitting(false);
        }
    };

    // ── Role management handlers ─────────────────────────────────────────────
    const handleSetRole = async (userId, roleId) => {
        setUpdatingRoleId(userId);
        try {
            const res = await axios.patch(
                `${API}/api/auth/admin/users/${userId}/set-role/`,
                { role_id: roleId || null },
                getConfig()
            );
            setAllUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, role: res.data.role, role_id: roleId || null } : u
            ));
        } catch (error) {
            alert('Failed to update role: ' + (error.response?.data?.error || error.message));
        } finally {
            setUpdatingRoleId(null);
        }
    };

    // ── Maintenance Handlers ─────────────────────────────────────────────────
    const handleMaintSubmit = async () => {
        if (!maintForm.meter_id || !maintForm.assigned_to || !maintForm.issue_description.trim()) {
            setMaintError('All fields are required.');
            return;
        }

        setMaintSubmitting(true);
        try {
            await axios.post(`${API}/api/metering/admin/maintenance`, {
                meter: maintForm.meter_id,
                assigned_to: maintForm.assigned_to,
                issue_description: maintForm.issue_description
            }, getConfig());
            setMaintModal(false);
            setMaintForm({ meter_id: '', assigned_to: '', issue_description: '' });
            fetchData();
        } catch (error) {
            setMaintError('Failed to dispatch task: ' + (error.response?.data?.error || error.message));
        } finally {
            setMaintSubmitting(false);
        }
    };

    const handleMaintDelete = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this maintenance task?')) return;
        try {
            await axios.delete(`${API}/api/metering/admin/maintenance/${taskId}`, getConfig());
            fetchData();
        } catch (error) {
            alert('Failed to delete task: ' + (error.response?.data?.error || error.message));
        }
    };

    const getStatusBadge = (status) => {
        const map = {
            'PENDING': 'badge-warning',
            'MANUAL_REVIEW': 'badge-danger',
            'PROCESSING': 'badge-info',
            'IN_PROGRESS': 'badge-info',
        };
        return map[status] || 'badge-warning';
    };

    // ── Section title map ────────────────────────────────────────────────────
    const sectionTitles = {
        dashboard: { title: 'Admin Dashboard', subtitle: 'System-wide overview at a glance' },
        revenue: { title: 'Revenue & Collections', subtitle: 'Track income trends and collection rates' },
        disputes: { title: 'Dispute Review Queue', subtitle: 'Review and resolve customer billing disputes' },
        readings: { title: 'Meter Reading Review', subtitle: 'Review, verify, and assign meter readings' },
        maintenance: { title: 'Field Maintenance', subtitle: 'Dispatch and track technician field tasks' },
        roles: { title: 'Role Management', subtitle: 'Assign and manage user roles across the system' },

        system: { title: 'System Management', subtitle: 'Direct access to Django admin resources' },
    };

    const currentSection = sectionTitles[section] || sectionTitles.dashboard;

    // ── Render section content ───────────────────────────────────────────────
    const renderContent = () => {
        switch (section) {
            case 'dashboard':
                return renderDashboard();
            case 'revenue':
                return renderRevenue();
            case 'disputes':
                return renderDisputes();
            case 'readings':
                return renderReadings();
            case 'maintenance':
                return renderMaintenance();
            case 'roles':
                return renderRoles();

            case 'system':
                return renderSystem();
            default:
                return renderDashboard();
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Dashboard
    // ═══════════════════════════════════════════════════════════════════════════
    const renderDashboard = () => (
        <>
            <div className="stats-grid">
                <div className="stat-card" onClick={() => navigate('/admin/roles')} style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div className="stat-icon blue">👥</div>
                    <div className="stat-value">{stats.totalUsers}</div>
                    <div className="stat-label">Total Customers</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/admin/system')} style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div className="stat-icon teal">📟</div>
                    <div className="stat-value">{stats.activeMeters}</div>
                    <div className="stat-label">Active Meters</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/admin/readings')} style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div className="stat-icon amber">⏳</div>
                    <div className="stat-value">{stats.pendingReadings}</div>
                    <div className="stat-label">Readings to Review</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/admin/revenue')} style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div className="stat-icon rose">💰</div>
                    <div className="stat-value">ETB {stats.totalRevenue}</div>
                    <div className="stat-label">Total Collections</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/admin/disputes')} style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div className="stat-icon" style={{ color: '#ef4444' }}>⚖️</div>
                    <div className="stat-value" style={{ color: disputes.length > 0 ? '#ef4444' : 'inherit' }}>
                        {disputes.length}
                    </div>
                    <div className="stat-label">Open Disputes</div>
                </div>
            </div>

            {/* Quick overview mini-charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '2rem', marginTop: '2rem' }}>
                <div className="panel">
                    <div className="panel-header">
                        <h2 className="panel-title">Revenue Trend</h2>
                    </div>
                    <div className="panel-body" style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.revenueHistory}>
                                <defs>
                                    <linearGradient id="colorRevDash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-400)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent-400)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                <XAxis dataKey="month" stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} />
                                <Area type="monotone" dataKey="amount" stroke="var(--accent-400)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevDash)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2 className="panel-title">Collection Rate</h2>
                    </div>
                    <div className="panel-body" style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.collectionStats}
                                    innerRadius={50} outerRadius={70}
                                    paddingAngle={5} dataKey="value"
                                >
                                    {stats.collectionStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Revenue
    // ═══════════════════════════════════════════════════════════════════════════
    const renderRevenue = () => (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-icon rose">💰</div>
                    <div className="stat-value">ETB {stats.totalRevenue}</div>
                    <div className="stat-label">Total Collections</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon teal">📈</div>
                    <div className="stat-value">
                        {stats.revenueHistory.length > 0 ? `ETB ${stats.revenueHistory[stats.revenueHistory.length - 1]?.amount || 0}` : 'N/A'}
                    </div>
                    <div className="stat-label">Latest Month</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue">📊</div>
                    <div className="stat-value">
                        {stats.collectionStats.length > 0 ? `${((stats.collectionStats.find(s => s.name === 'Paid')?.value || 0) / Math.max(stats.collectionStats.reduce((a, b) => a + b.value, 0), 1) * 100).toFixed(0)}%` : 'N/A'}
                    </div>
                    <div className="stat-label">Collection Rate</div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <h2 className="panel-title">Revenue History (6 Months)</h2>
                </div>
                <div className="panel-body" style={{ height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.revenueHistory}>
                            <defs>
                                <linearGradient id="colorRevAdmin" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-400)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--accent-400)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                            <XAxis dataKey="month" stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                            <YAxis stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} />
                            <Area type="monotone" dataKey="amount" stroke="var(--accent-400)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevAdmin)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="panel" style={{ marginTop: '2rem' }}>
                <div className="panel-header">
                    <h2 className="panel-title">Collection Rate Breakdown</h2>
                </div>
                <div className="panel-body" style={{ height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.collectionStats}
                                innerRadius={60} outerRadius={85}
                                paddingAngle={5} dataKey="value"
                            >
                                {stats.collectionStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Disputes
    // ═══════════════════════════════════════════════════════════════════════════
    const renderDisputes = () => (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">
                    Dispute Review Queue
                    {disputes.length > 0 && (
                        <span style={{
                            marginLeft: '0.75rem', background: '#ef4444', color: '#fff',
                            borderRadius: '9999px', padding: '2px 10px',
                            fontSize: '0.8rem', fontWeight: 700
                        }}>{disputes.length}</span>
                    )}
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={fetchData}>↻ Refresh</button>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>
                ) : disputes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No open disputes</div>
                        <div style={{ margin: '0.5rem 0 0', opacity: 0.7 }}>All customer disputes have been resolved.</div>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Bill Date</th>
                                <th>Amount</th>
                                <th>Reason (preview)</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {disputes.map(dispute => (
                                <tr key={dispute.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{dispute.customer}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{dispute.email}</div>
                                    </td>
                                    <td>{dispute.bill_date}</td>
                                    <td style={{ fontWeight: 600 }}>ETB {parseFloat(dispute.bill_amount).toLocaleString()}</td>
                                    <td style={{ maxWidth: '200px' }}>
                                        <span style={{
                                            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.875rem'
                                        }}>{dispute.reason}</span>
                                    </td>
                                    <td>
                                        <span className={`badge ${dispute.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning'}`}>
                                            {dispute.status === 'IN_PROGRESS' ? '↻ In Progress' : '⏳ Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ padding: '4px 12px' }}
                                            onClick={() => openDisputeModal(dispute)}
                                        >
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Readings
    // ═══════════════════════════════════════════════════════════════════════════
    const renderReadings = () => (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">
                    Meter Reading Review Queue
                    {pendingReadings.length > 0 && (
                        <span style={{
                            marginLeft: '0.75rem', background: '#f59e0b', color: '#000',
                            borderRadius: '9999px', padding: '2px 10px',
                            fontSize: '0.8rem', fontWeight: 700
                        }}>{pendingReadings.length}</span>
                    )}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleBatchAssign}
                        style={{ background: 'var(--accent-500)' }}
                    >
                        👥 Assign Batch to Clerks
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData}>↻ Refresh</button>
                </div>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
                {pendingReadings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No readings awaiting review</div>
                        <div style={{ margin: '0.5rem 0 0', opacity: 0.7 }}>All meter readings have been processed.</div>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Meter</th>
                                <th>Submitted</th>
                                <th>AI Value</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingReadings.map(reading => (
                                <tr key={reading.id}>
                                    <td>{reading.customer || 'Unassigned'}</td>
                                    <td><code>{reading.meter}</code></td>
                                    <td>{reading.submitted}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        {reading.reading_value != null ? `${reading.reading_value} m³` : '—'}
                                        {reading.ocr_confidence != null && (
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>
                                                ({Math.round(reading.ocr_confidence * 100)}%)
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(reading.status)}`}>
                                            {reading.status === 'MANUAL_REVIEW' ? '⚠ Manual Review' : '⏳ Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ padding: '4px 12px' }}
                                            onClick={() => openReview(reading)}
                                        >
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Maintenance
    // ═══════════════════════════════════════════════════════════════════════════
    const renderMaintenance = () => (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">
                    Field Maintenance Queue
                    {maintenanceTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length > 0 && (
                        <span style={{
                            marginLeft: '0.75rem', background: '#3b82f6', color: '#fff',
                            borderRadius: '9999px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700
                        }}>{maintenanceTasks.filter(t => t.status !== 'RESOLVED').length}</span>
                    )}
                </h2>
                <button className="btn btn-primary btn-sm" onClick={() => setMaintModal(true)}>
                    + Dispatch Technician
                </button>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
                {maintenanceTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No maintenance tasks</div>
                        <div style={{ margin: '0.5rem 0 0', opacity: 0.7 }}>Dispatch a technician to create the first task.</div>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Meter</th>
                                <th>Customer</th>
                                <th>Tech Assigned</th>
                                <th>Issue</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {maintenanceTasks.map(task => (
                                <tr key={task.id}>
                                    <td><code>{task.meter_number}</code></td>
                                    <td>{task.customer_name || 'N/A'}</td>
                                    <td style={{ fontWeight: 600 }}>{task.tech_name}</td>
                                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.issue_description}</td>
                                    <td>
                                        <span className={`badge ${task.status === 'RESOLVED' ? 'badge-info' : task.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-warning'}`}>
                                            {task.status === 'IN_PROGRESS' ? '🔧 In Progress' : task.status === 'RESOLVED' ? '✅ Resolved' : '⏳ Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className="btn btn-danger btn-sm" 
                                            onClick={() => handleMaintDelete(task.id)}
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
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
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION: Roles
    // ═══════════════════════════════════════════════════════════════════════════
    const renderRoles = () => (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">Role Management</h2>
                <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                    style={{
                        padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-default)',
                        background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '0.9rem', width: '250px'
                    }}
                />
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Current Role</th>
                            <th>Assign Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allUsers
                            .filter(u => u.full_name.toLowerCase().includes(roleSearch.toLowerCase()) || u.email.toLowerCase().includes(roleSearch.toLowerCase()))
                            .map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 600 }}>{user.full_name} {user.is_staff ? <span style={{ color: '#3b82f6', fontSize: '0.8rem', marginLeft: 4 }}>[Staff]</span> : ''}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                                    <td>
                                        <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : user.role === 'CLERK' ? 'badge-warning' : 'badge-secondary'}`} style={{ opacity: user.role ? 1 : 0.5 }}>
                                            {user.role || 'No Role'}
                                        </span>
                                    </td>
                                    <td>
                                        <select
                                            value={user.role_id || ''}
                                            onChange={(e) => handleSetRole(user.id, e.target.value)}
                                            disabled={updatingRoleId === user.id}
                                            style={{
                                                padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-default)',
                                                background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '0.85rem'
                                            }}
                                        >
                                            <option value="">-- Remove Role --</option>
                                            {allRoles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        {allUsers.length === 0 && (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No users found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );


    // ═══════════════════════════════════════════════════════════════════════════

    const renderSystem = () => (
        <div className="panel" style={{ marginBottom: '2rem' }}>
            <div className="panel-header">
                <h2 className="panel-title">System Management</h2>
            </div>
            <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
                    {/* Accounts */}
                    <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <div className="stat-icon blue" style={{ width: 32, height: 32, fontSize: '1rem', marginBottom: 0 }}>👥</div> Accounts
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { label: 'Users', path: 'accounts/user' },
                                { label: 'Customers', path: 'accounts/customer' },
                                { label: 'Roles', path: 'accounts/role' },
                                { label: 'Audit Logs', path: 'accounts/auditlog' }
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <a href={`http://localhost:8000/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`http://localhost:8000/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Metering */}
                    <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <div className="stat-icon teal" style={{ width: 32, height: 32, fontSize: '1rem', marginBottom: 0 }}>📟</div> Metering
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { label: 'Meters', path: 'metering/meter' },
                                { label: 'Meter Readings', path: 'metering/meterreading' }
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <a href={`http://localhost:8000/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`http://localhost:8000/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Billing */}
                    <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                            <div className="stat-icon amber" style={{ width: 32, height: 32, fontSize: '1rem', marginBottom: 0 }}>💰</div> Billing
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { label: 'Bills', path: 'billing/bill' },
                                { label: 'Payments', path: 'billing/payment' },
                                { label: 'Disputes', path: 'billing/dispute' },
                                { label: 'Tariff Tiers', path: 'billing/tarifftier' }
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <a href={`http://localhost:8000/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`http://localhost:8000/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="app-layout">
            <Sidebar />

            {/* ── Reading Review Modal ───────────────────────────────────── */}
            {reviewModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem',
                        width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-default)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Review Reading</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Customer: <strong>{reviewModal.customer}</strong> &nbsp;|&nbsp; Meter: <code>{reviewModal.meter}</code>
                        </p>

                        {reviewModal.image_url && (
                            <div style={{ marginBottom: '1.25rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                <SecureImage
                                    src={reviewModal.image_url.startsWith('http') ? reviewModal.image_url : `${API}${reviewModal.image_url}`}
                                    alt="Meter reading"
                                    style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: '#000' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            AI Suggested Value: <strong style={{ color: 'var(--text-primary)' }}>
                                {reviewModal.reading_value ?? 'N/A'} m³
                            </strong>
                            {reviewModal.ocr_confidence && (
                                <span style={{ marginLeft: '0.75rem', color: '#f59e0b' }}>
                                    ({Math.round(reviewModal.ocr_confidence * 100)}% confidence)
                                </span>
                            )}
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Confirmed Reading (m³)
                        </label>
                        <input
                            type="number" min="0" step="0.01" value={reviewValue}
                            onChange={e => { setReviewValue(e.target.value); setReviewError(''); }}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-body)',
                                color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        {reviewError && (
                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{reviewError}</p>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={closeReview}>Cancel</button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleVerify}
                                disabled={verifyingId === reviewModal.id}
                            >
                                {verifyingId === reviewModal.id ? 'Verifying...' : '✓ Confirm & Generate Bill'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Dispute Resolve Modal ──────────────────────────────────── */}
            {disputeModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem',
                        width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-default)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Review Dispute</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            Customer: <strong>{disputeModal.customer}</strong> &nbsp;|&nbsp;
                            Bill: <code>{disputeModal.bill_id?.split('-')[0]}...</code> &nbsp;|&nbsp;
                            Amount: <strong>ETB {parseFloat(disputeModal.bill_amount).toLocaleString()}</strong>
                        </p>

                        <div style={{
                            background: 'var(--bg-body)', border: '1px solid var(--border-default)',
                            borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem',
                            fontSize: '0.9rem', color: 'var(--text-secondary)'
                        }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Customer's Reason:</div>
                            {disputeModal.reason}
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Action
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            {['RESOLVED', 'REJECTED', 'IN_PROGRESS'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setDisputeAction(opt)}
                                    className="btn btn-sm"
                                    style={{
                                        flex: 1,
                                        background: disputeAction === opt
                                            ? (opt === 'RESOLVED' ? '#10b981' : opt === 'REJECTED' ? '#ef4444' : '#3b82f6')
                                            : 'var(--bg-body)',
                                        color: disputeAction === opt ? '#fff' : 'var(--text-secondary)',
                                        border: '1px solid var(--border-default)',
                                        fontWeight: disputeAction === opt ? 700 : 400
                                    }}
                                >
                                    {opt === 'RESOLVED' ? '✓ Resolve' : opt === 'REJECTED' ? '✗ Reject' : '↻ In Progress'}
                                </button>
                            ))}
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Admin Notes (optional)
                        </label>
                        <textarea
                            rows={3}
                            value={disputeNotes}
                            onChange={e => setDisputeNotes(e.target.value)}
                            placeholder="Explain the decision to the customer..."
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-body)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1rem',
                                boxSizing: 'border-box', resize: 'vertical'
                            }}
                        />
                        {disputeError && (
                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{disputeError}</p>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={closeDisputeModal} disabled={disputeSubmitting}>Cancel</button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleDisputeSubmit}
                                disabled={disputeSubmitting}
                                style={{
                                    background: disputeAction === 'RESOLVED' ? '#10b981'
                                        : disputeAction === 'REJECTED' ? '#ef4444' : '#3b82f6'
                                }}
                            >
                                {disputeSubmitting ? 'Saving...' : `Submit ${disputeAction}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Maintenance Dispatch Modal ─────────────────────────────── */}
            {maintModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem',
                        width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-default)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Dispatch Technician</h2>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Select Meter</label>
                        <SearchableSelect
                            placeholder="-- Type or Select Active Meter --"
                            value={maintForm.meter_id}
                            onChange={val => { setMaintForm({ ...maintForm, meter_id: val }); setMaintError(''); }}
                            options={(Array.isArray(allMeters) ? allMeters : [])
                                .filter(m => m.status?.toUpperCase() === 'ACTIVE')
                                .map(m => ({ value: m.id, label: m.meter_number }))}
                        />

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Assign Technician</label>
                        <SearchableSelect
                            placeholder="-- Type or Select Technician --"
                            value={maintForm.assigned_to}
                            onChange={val => { setMaintForm({ ...maintForm, assigned_to: val }); setMaintError(''); }}
                            options={allUsers
                                .filter(u => u.role?.toUpperCase() === 'TECHNICIAN')
                                .map(t => ({ value: t.id, label: `${t.full_name} (${t.email})` }))}
                        />

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Issue Description</label>
                        <textarea
                            rows={3}
                            value={maintForm.issue_description}
                            onChange={e => { setMaintForm({ ...maintForm, issue_description: e.target.value }); setMaintError(''); }}
                            placeholder="Describe the meter issue..."
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-body)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1rem',
                                resize: 'vertical'
                            }}
                        />

                        {maintError && (
                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{maintError}</p>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setMaintModal(false)} disabled={maintSubmitting}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleMaintSubmit} disabled={maintSubmitting}>
                                {maintSubmitting ? 'Dispatching...' : 'Dispatch Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="main-content">
                <header className="content-header">
                    <h1 className="content-title">{currentSection.title}</h1>
                    <p className="content-subtitle">{currentSection.subtitle}</p>
                </header>

                <div className="content-body">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
