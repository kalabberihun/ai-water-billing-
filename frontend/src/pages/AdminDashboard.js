import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
const API = process.env.REACT_APP_API_URL || 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : 'https://water-billing-api-k6qs.onrender.com');

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

    // Field Tasks management
    const [fieldTaskModal, setFieldTaskModal] = useState(false);
    const [fieldTaskForm, setFieldTaskForm] = useState({ meter_id: '', clerk_id: '' });
    const [fieldTaskSubmitting, setFieldTaskSubmitting] = useState(false);
    const [fieldTaskError, setFieldTaskError] = useState('');

    // Customer Payments management
    const [customerPayments, setCustomerPayments] = useState([]);
    const [paymentKpis, setPaymentKpis] = useState({
        total_customers: 0,
        paid_this_month: 0,
        unpaid: 0,
        overdue: 0,
        total_revenue: '0.00'
    });
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [paymentSearch, setPaymentSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [zoneFilter, setZoneFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [deactivateModalCustomer, setDeactivateModalCustomer] = useState(null);
    const [reactivateModalCustomer, setReactivateModalCustomer] = useState(null);
    const [detailsModalCustomer, setDetailsModalCustomer] = useState(null);
    const [warnModalCustomer, setWarnModalCustomer] = useState(null);
    const [warnType, setWarnType] = useState('standard');
    const [bulkWarnModal, setBulkWarnModal] = useState(false);
    const [bulkWarnType, setBulkWarnType] = useState('standard');

    // Global billing system control state
    const [systemActive, setSystemActive] = useState(true);
    const [systemControlLoading, setSystemControlLoading] = useState(false);

    // Global Payment History Sidebar state
    const [showHistorySidebar, setShowHistorySidebar] = useState(false);
    const [historyPayments, setHistoryPayments] = useState([]);
    const [historySummary, setHistorySummary] = useState({
        total_completed: 0,
        total_pending: 0,
        total_failed: 0,
        total_amount: '0.00'
    });
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('');
    const [historyMethodFilter, setHistoryMethodFilter] = useState('');
    const [historyLoading, setHistoryLoading] = useState(false);

    const getConfig = useCallback(() => {
        const tokenObj = JSON.parse(localStorage.getItem('tokens'));
        return { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, readingsRes, disputesRes, usersRes, tasksRes, metersRes, paymentsRes, systemRes] = await Promise.all([
                axios.get(`${API}/api/auth/admin/stats`, getConfig()),
                axios.get(`${API}/api/auth/admin/pending-readings`, getConfig()),
                axios.get(`${API}/api/auth/admin/disputes`, getConfig()),
                axios.get(`${API}/api/auth/admin/users`, getConfig()),
                axios.get(`${API}/api/metering/admin/maintenance`, getConfig()),
                axios.get(`${API}/api/metering/meters`, getConfig()),
                axios.get(`${API}/api/billing/admin/customer-payments`, getConfig()),
                axios.get(`${API}/api/auth/admin/system-control`, getConfig())
            ]);
            setStats(statsRes.data);
            setPendingReadings(readingsRes.data);
            setDisputes(disputesRes.data);
            setAllUsers(usersRes.data.users || []);
            setAllRoles(usersRes.data.roles || []);
            setMaintenanceTasks(tasksRes.data);
            setAllMeters(metersRes.data.results || metersRes.data);
            setCustomerPayments(paymentsRes.data.customers || []);
            setPaymentKpis(paymentsRes.data.kpis || {});
            setSystemActive(systemRes.data.system_active);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    }, [getConfig]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchPaymentHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const params = {};
            if (historySearch) params.search = historySearch;
            if (historyStatusFilter) params.status = historyStatusFilter;
            if (historyMethodFilter) params.method = historyMethodFilter;

            const res = await axios.get(`${API}/api/billing/admin/payment-history`, {
                ...getConfig(),
                params
            });
            setHistoryPayments(res.data.payments || []);
            setHistorySummary(res.data.summary || {
                total_completed: 0,
                total_pending: 0,
                total_failed: 0,
                total_amount: '0.00'
            });
        } catch (error) {
            console.error('Error fetching global payment history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, [getConfig, historySearch, historyStatusFilter, historyMethodFilter]);

    useEffect(() => {
        if (showHistorySidebar) {
            fetchPaymentHistory();
        }
    }, [showHistorySidebar, fetchPaymentHistory]);

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

    // ── Field Task Handler ───────────────────────────────────────────────────
    const handleFieldTaskSubmit = async () => {
        if (!fieldTaskForm.meter_id || !fieldTaskForm.clerk_id) {
            setFieldTaskError('Both meter and clerk must be selected.');
            return;
        }
        setFieldTaskSubmitting(true);
        try {
            await axios.post(`${API}/api/metering/admin/field-tasks`, fieldTaskForm, getConfig());
            alert('Field task assigned successfully!');
            setFieldTaskModal(false);
            setFieldTaskForm({ meter_id: '', clerk_id: '' });
            fetchData();
        } catch (error) {
            setFieldTaskError('Assignment failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setFieldTaskSubmitting(false);
        }
    };

    const handleBatchAssignFieldTasks = async () => {
        if (!window.confirm('Are you sure you want to assign all active meters to clerks for field tasks? This may create a large number of tasks.')) return;
        
        try {
            const res = await axios.post(`${API}/api/metering/admin/field-tasks/batch`, {}, getConfig());
            alert(res.data.message || 'Batch field tasks assigned successfully!');
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

    // ── Customer Payments Action Handlers ─────────────────────────────────────
    const handleSendWarning = async (customerId, type = 'standard') => {
        try {
            const res = await axios.post(`${API}/api/billing/admin/customer-payments`, {
                action: 'warn',
                customer_id: customerId,
                warning_type: type
            }, getConfig());
            if (res.data.success) {
                alert('Warning notification and email sent successfully!');
                setWarnModalCustomer(null);
                fetchData();
            } else {
                alert('Action failed: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error sending warning: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeactivateMeter = async (customerId) => {
        try {
            const res = await axios.post(`${API}/api/billing/admin/customer-payments`, {
                action: 'deactivate_meter',
                customer_id: customerId
            }, getConfig());
            if (res.data.success) {
                alert('Meter remotely deactivated successfully!');
                setDeactivateModalCustomer(null);
                fetchData();
            } else {
                alert('Action failed: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error deactivating meter: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleReactivateMeter = async (customerId) => {
        try {
            const res = await axios.post(`${API}/api/billing/admin/customer-payments`, {
                action: 'reactivate_meter',
                customer_id: customerId
            }, getConfig());
            if (res.data.success) {
                alert('Meter remotely reactivated successfully!');
                setReactivateModalCustomer(null);
                fetchData();
            } else {
                alert('Action failed: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error reactivating meter: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleBulkWarn = async (type = 'standard') => {
        if (selectedCustomers.length === 0) return;
        try {
            const res = await axios.post(`${API}/api/billing/admin/customer-payments`, {
                action: 'bulk_warn',
                customer_ids: selectedCustomers,
                warning_type: type
            }, getConfig());
            if (res.data.success) {
                alert(res.data.message || 'Bulk warnings sent successfully!');
                setSelectedCustomers([]);
                setBulkWarnModal(false);
                fetchData();
            } else {
                alert('Action failed: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error in bulk warning: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleBulkFlag = async () => {
        if (selectedCustomers.length === 0) return;
        if (!window.confirm(`Are you sure you want to flag the ${selectedCustomers.length} selected customer accounts for administrative review?`)) return;
        try {
            const res = await axios.post(`${API}/api/billing/admin/customer-payments`, {
                action: 'bulk_flag',
                customer_ids: selectedCustomers
            }, getConfig());
            if (res.data.success) {
                alert(res.data.message || 'Bulk accounts flagged successfully!');
                setSelectedCustomers([]);
                fetchData();
            } else {
                alert('Action failed: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error in bulk flag: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleToggleSystem = async (action) => {
        if (!window.confirm(`Are you sure you want to ${action === 'activate' ? 'ACTIVATE' : 'DEACTIVATE'} the global water billing system? This will send bulk notifications/emails to all active customers.`)) {
            return;
        }
        setSystemControlLoading(true);
        try {
            const res = await axios.post(`${API}/api/auth/admin/system-control`, { action }, getConfig());
            if (res.data.success) {
                setSystemActive(res.data.system_active);
                alert(res.data.message);
            } else {
                alert('Failed to toggle system status: ' + (res.data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error toggling system status: ' + (error.response?.data?.error || error.message));
        } finally {
            setSystemControlLoading(false);
        }
    };

    const renderSystemControlPanel = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Month and Year label
        const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        // Next Activation: 5th of next month or 5th of current month
        let nextActivation = new Date(currentYear, currentMonth, 5);
        if (now.getDate() > 5) {
            nextActivation = new Date(currentYear, currentMonth + 1, 5);
        }
        
        // Next Deactivation: last day of the current month
        const nextDeactivation = new Date(currentYear, currentMonth + 1, 0);

        // Calendar calculations
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        for (let d = 1; d <= totalDays; d++) {
            days.push(d);
        }

        return (
            <div style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--border-default)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '2rem',
                boxShadow: 'var(--shadow-md)',
                backgroundImage: 'var(--gradient-surface)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background glowing/pulse effect based on active state */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: systemActive ? 'var(--color-success)' : 'var(--color-danger)',
                    opacity: 0.08,
                    filter: 'blur(40px)',
                    pointerEvents: 'none'
                }} />

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '2rem',
                    alignItems: 'start',
                    position: 'relative',
                    zIndex: 1
                }}>
                    {/* Left Column: System Control Info & Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '12px',
                                background: systemActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.75rem',
                                boxShadow: systemActive ? '0 0 15px rgba(16, 185, 129, 0.2)' : '0 0 15px rgba(239, 68, 68, 0.2)',
                                transition: 'all 0.3s ease'
                            }}>
                                {systemActive ? '💧' : '🔒'}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif' }}>
                                        Global Billing System Control
                                    </h3>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: systemActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: systemActive ? 'var(--color-success)' : 'var(--color-danger)',
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        <span style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            background: systemActive ? 'var(--color-success)' : 'var(--color-danger)',
                                            display: 'inline-block',
                                            animation: 'pulse 1.5s infinite'
                                        }} />
                                        {systemActive ? 'Active' : 'Deactivated'}
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    {systemActive 
                                        ? 'Customers can scan water meters, upload readings, and receive system notifications/emails.' 
                                        : 'Water meter reading submissions are locked. Customer scanning is temporarily blocked.'}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleToggleSystem('activate')}
                                disabled={systemActive || systemControlLoading}
                                style={{
                                    background: systemActive ? 'var(--color-surface-2)' : 'var(--gradient-accent)',
                                    color: systemActive ? 'var(--text-secondary)' : 'var(--color-text-inverse)',
                                    border: systemActive ? '1px solid var(--border-default)' : 'none',
                                    opacity: systemActive ? 0.6 : 1,
                                    cursor: systemActive ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontWeight: 600,
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '10px',
                                    boxShadow: !systemActive ? '0 4px 12px rgba(0, 180, 216, 0.2)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                ⚡ Activate System
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleToggleSystem('deactivate')}
                                disabled={!systemActive || systemControlLoading}
                                style={{
                                    background: !systemActive ? 'var(--color-surface-2)' : 'var(--color-danger)',
                                    color: !systemActive ? 'var(--text-secondary)' : '#fff',
                                    border: !systemActive ? '1px solid var(--border-default)' : 'none',
                                    opacity: !systemActive ? 0.6 : 1,
                                    cursor: !systemActive ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontWeight: 600,
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '10px',
                                    boxShadow: systemActive ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                🔒 Deactivate System
                            </button>
                        </div>

                        {/* Text Schedule Info */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px dashed var(--border-default)',
                            borderRadius: '12px',
                            padding: '1rem',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📅 Automatic Schedule Reminders
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div>🔄 <strong>Reactivation:</strong> Occurs automatically on the <strong style={{ color: 'var(--color-success)' }}>5th day</strong> of the month.</div>
                                <div>🛑 <strong>Deactivation:</strong> Occurs automatically on the <strong style={{ color: 'var(--color-danger)' }}>last day</strong> of the month.</div>
                                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div>⏰ <strong>Next Deactivation:</strong> {nextDeactivation.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                    <div>⏰ <strong>Next Activation:</strong> {nextActivation.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visual Calendar Grid */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif' }}>
                                {monthLabel}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-body)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
                                Auto-cycle Calendar
                            </span>
                        </div>

                        {/* Calendar Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => (
                                <div key={w} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: '4px' }}>
                                    {w}
                                </div>
                            ))}
                            {days.map((day, idx) => {
                                if (day === null) {
                                    return <div key={`empty-${idx}`} />;
                                }

                                const isToday = day === now.getDate();
                                const isActivation = day === 5;
                                const isDeactivation = day === totalDays;

                                let dayStyle = {
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '6px',
                                    position: 'relative',
                                    transition: 'all 0.15s ease',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid transparent'
                                };

                                let dayTitle = `Day ${day}`;

                                if (isActivation) {
                                    dayStyle = {
                                        ...dayStyle,
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        border: '1.5px solid var(--color-success)',
                                        color: 'var(--color-success)',
                                        fontWeight: '700',
                                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                                    };
                                    dayTitle = "Automatic System Activation (5th)";
                                } else if (isDeactivation) {
                                    dayStyle = {
                                        ...dayStyle,
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        border: '1.5px solid var(--color-danger)',
                                        color: 'var(--color-danger)',
                                        fontWeight: '700',
                                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)'
                                    };
                                    dayTitle = "Automatic System Deactivation (Last Day)";
                                } else if (isToday) {
                                    dayStyle = {
                                        ...dayStyle,
                                        border: '1.5px dashed var(--primary-400)',
                                        color: 'var(--primary-400)',
                                        fontWeight: '700',
                                        background: 'rgba(59, 130, 246, 0.08)'
                                    };
                                    dayTitle = "Today";
                                }

                                return (
                                    <div
                                        key={`day-${day}`}
                                        style={dayStyle}
                                        title={dayTitle}
                                        onMouseEnter={e => {
                                            if (!isActivation && !isDeactivation) {
                                                e.target.style.background = 'rgba(255,255,255,0.08)';
                                                e.target.style.color = 'var(--text-primary)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isActivation && !isDeactivation) {
                                                e.target.style.background = 'rgba(255, 255, 255, 0.02)';
                                                e.target.style.color = 'var(--text-secondary)';
                                            }
                                        }}
                                    >
                                        {day}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            fontSize: '0.75rem',
                            borderTop: '1px solid var(--border-subtle)',
                            paddingTop: '0.5rem',
                            marginTop: '0.25rem',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                                <span>Activation (5th)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} />
                                <span>Deactivation (Last)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', border: '1px dashed var(--primary-400)', borderRadius: '2px', display: 'inline-block' }} />
                                <span>Today</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Inject keyframes dynamically to make standard CSS animations work without external file changes */}
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes pulse {
                        0% { transform: scale(0.9); opacity: 0.6; }
                        50% { transform: scale(1.2); opacity: 1; }
                        100% { transform: scale(0.9); opacity: 0.6; }
                    }
                `}} />
            </div>
        );
    };

    const getPaymentBadge = (status) => {
        const map = {
            'PAID': 'badge-success',
            'UNPAID': 'badge-warning',
            'DUE': 'badge-danger',
            'OVERDUE': 'badge-danger',
            'PARTIAL': 'badge-info',
            'NONE': 'badge-secondary'
        };
        return map[status] || 'badge-secondary';
    };

    const getMeterBadge = (status) => {
        const map = {
            'ACTIVE': 'badge-success',
            'DISCONNECTED': 'badge-danger',
            'MAINTENANCE': 'badge-warning',
            'NONE': 'badge-secondary'
        };
        return map[status] || 'badge-secondary';
    };

    const CALENDAR_MONTHS = [
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' },
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];

    const renderPayments = () => {
        // Unique zones for dropdown options
        const uniqueZones = [...new Set(customerPayments.map(c => c.zone).filter(Boolean))];

        // Filter customer payments list
        const filteredPayments = customerPayments.filter(c => {
            const matchesSearch = !paymentSearch || 
                c.name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                c.email.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                c.id.toLowerCase().includes(paymentSearch.toLowerCase());
                
            const matchesStatus = !statusFilter || c.payment_status === statusFilter;
            
            const matchesZone = !zoneFilter || c.zone === zoneFilter;
            
            const matchesMonth = !monthFilter || (c.latest_bill_date && c.latest_bill_date.split('-')[1] === monthFilter);
            
            return matchesSearch && matchesStatus && matchesZone && matchesMonth;
        });

        const toggleSelectCustomer = (id) => {
            if (selectedCustomers.includes(id)) {
                setSelectedCustomers(prev => prev.filter(cId => cId !== id));
            } else {
                setSelectedCustomers(prev => [...prev, id]);
            }
        };

        const toggleSelectAll = () => {
            if (selectedCustomers.length === filteredPayments.length) {
                setSelectedCustomers([]);
            } else {
                setSelectedCustomers(filteredPayments.map(c => c.id));
            }
        };

        return (
            <>
                {/* KPI Cards */}
                <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon blue">👥</div>
                        <div className="stat-value">{paymentKpis.total_customers ?? 0}</div>
                        <div className="stat-label">Total Customers</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon teal">✓</div>
                        <div className="stat-value">{paymentKpis.paid_this_month ?? 0}</div>
                        <div className="stat-label">Paid This Month</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon amber">⏳</div>
                        <div className="stat-value">{paymentKpis.unpaid ?? 0}</div>
                        <div className="stat-label">Unpaid Accounts</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon rose">⚠</div>
                        <div className="stat-value" style={{ color: paymentKpis.overdue > 0 ? 'var(--color-danger)' : 'inherit' }}>
                            {paymentKpis.overdue ?? 0}
                        </div>
                        <div className="stat-label">Overdue Bills</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon success">💰</div>
                        <div className="stat-value">ETB {paymentKpis.total_revenue ?? '0.00'}</div>
                        <div className="stat-label">Total Revenue Collected</div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="panel" style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem',
                        alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                            <input
                                type="text"
                                placeholder="Search by customer name, email, or ID..."
                                value={paymentSearch}
                                onChange={e => setPaymentSearch(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                    border: '1px solid var(--border-default)', background: 'var(--bg-body)',
                                    color: 'var(--text-primary)', fontSize: '0.9rem'
                                }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: '2 1 auto' }}>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                style={{
                                    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-default)',
                                    background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '0.9rem'
                                }}
                            >
                                <option value="">-- All Payment Statuses --</option>
                                <option value="PAID">Paid</option>
                                <option value="UNPAID">Unpaid</option>
                                <option value="DUE">Due</option>
                                <option value="OVERDUE">Overdue</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="NONE">No Bills</option>
                            </select>

                            <select
                                value={zoneFilter}
                                onChange={e => setZoneFilter(e.target.value)}
                                style={{
                                    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-default)',
                                    background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '0.9rem'
                                }}
                            >
                                <option value="">-- All Zones/Areas --</option>
                                {uniqueZones.map(zone => (
                                    <option key={zone} value={zone}>{zone}</option>
                                ))}
                            </select>

                            <select
                                value={monthFilter}
                                onChange={e => setMonthFilter(e.target.value)}
                                style={{
                                    padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-default)',
                                    background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '0.9rem'
                                }}
                            >
                                <option value="">-- All Months --</option>
                                {CALENDAR_MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setPaymentSearch('');
                                    setStatusFilter('');
                                    setZoneFilter('');
                                    setMonthFilter('');
                                }}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                Clear
                            </button>

                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setShowHistorySidebar(true)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontWeight: 600,
                                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #4f46e5 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                📜 View Payment History Log
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions Toolbar */}
                {selectedCustomers.length > 0 && (
                    <div style={{
                        background: 'rgba(52, 120, 255, 0.1)', border: '1.5px solid var(--primary-400)',
                        borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        animation: 'fadeIn 200ms ease'
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            <span>💳 {selectedCustomers.length} Customer{selectedCustomers.length > 1 ? 's' : ''} Selected</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                    setBulkWarnModal(true);
                                    setBulkWarnType('standard');
                                }}
                                style={{ background: 'var(--color-warning)', border: 'none', color: '#fff', fontWeight: 600 }}
                            >
                                ✉ Bulk Send Warning
                            </button>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={handleBulkFlag}
                                style={{ fontWeight: 600 }}
                            >
                                🚩 Bulk Flag Account
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSelectedCustomers([])}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Customer Payments Table */}
                <div className="panel">
                    <div className="panel-header">
                        <h2 className="panel-title">Customer Billing Status Overview</h2>
                        <button className="btn btn-secondary btn-sm" onClick={fetchData}>↻ Refresh</button>
                    </div>
                    <div className="panel-body" style={{ padding: 0 }}>
                        {filteredPayments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔎</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No customers matching current filters</div>
                                <div style={{ margin: '0.5rem 0 0', opacity: 0.7 }}>Try adjusting your search query or filters.</div>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={filteredPayments.length > 0 && selectedCustomers.length === filteredPayments.length}
                                                onChange={toggleSelectAll}
                                                style={{ cursor: 'pointer', scale: '1.1' }}
                                            />
                                        </th>
                                        <th>Customer Details</th>
                                        <th>Zone</th>
                                        <th>Current Bill</th>
                                        <th>Payment Status</th>
                                        <th>Meter Status</th>
                                        <th>Months Unpaid</th>
                                        <th>Last Payment</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map(c => {
                                        const isSelected = selectedCustomers.includes(c.id);
                                        return (
                                            <tr key={c.id} style={{ background: isSelected ? 'rgba(52, 120, 255, 0.04)' : 'transparent' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectCustomer(c.id)}
                                                        style={{ cursor: 'pointer', scale: '1.1' }}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span>ID: <code>{c.id.split('-')[0]}...</code></span>
                                                        <span>{c.email}</span>
                                                    </div>
                                                </td>
                                                <td><span style={{ fontWeight: 500 }}>{c.zone || 'N/A'}</span></td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {c.current_bill_amount > 0 ? `ETB ${c.current_bill_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                                </td>
                                                <td>
                                                    <span className={`badge ${getPaymentBadge(c.payment_status)}`} style={{ textTransform: 'uppercase', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}>
                                                        {c.payment_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getMeterBadge(c.meter?.status)}`} style={{ textTransform: 'uppercase', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}>
                                                        {c.meter?.status ?? 'NONE'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: c.consecutive_unpaid_months > 0 ? 700 : 400, color: c.consecutive_unpaid_months >= 2 ? 'var(--color-danger)' : 'inherit' }}>
                                                    {c.consecutive_unpaid_months > 0 ? c.consecutive_unpaid_months : '—'}
                                                </td>
                                                <td>{c.last_payment_date}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => setDetailsModalCustomer(c)}
                                                            style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                                                            title="View Billing History"
                                                        >
                                                            Profile
                                                        </button>
                                                        {c.payment_status !== 'PAID' && c.payment_status !== 'NONE' && (
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => {
                                                                    setWarnModalCustomer(c);
                                                                    setWarnType('standard');
                                                                }}
                                                                style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' }}
                                                                title="Send warning message and email"
                                                            >
                                                                Warn
                                                            </button>
                                                        )}
                                                        {c.meter?.status === 'ACTIVE' && (
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => setDeactivateModalCustomer(c)}
                                                                style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                                                                title="Remotely deactivate water meter"
                                                            >
                                                                Deactivate
                                                            </button>
                                                        )}
                                                        {c.meter?.status === 'DISCONNECTED' && (
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => setReactivateModalCustomer(c)}
                                                                style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', background: 'var(--color-success)', border: 'none', color: '#fff' }}
                                                                title="Remotely reactivate water meter"
                                                            >
                                                                Reactivate
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </>
        );
    };

    // ── Section title map ────────────────────────────────────────────────────
    const sectionTitles = {
        dashboard: { title: 'Admin Dashboard', subtitle: 'System-wide overview at a glance' },
        payments: { title: 'Customer Payments & Connection Status', subtitle: 'Manage billing notifications, payment status, and system activation states' },
        revenue: { title: 'Revenue & Collections', subtitle: 'Track income trends and collection rates' },
        disputes: { title: 'Dispute Review Queue', subtitle: 'Review and resolve customer billing disputes' },
        readings: { title: 'Meter Reading Review', subtitle: 'Review, verify, and assign meter readings' },
        maintenance: { title: 'Field Maintenance', subtitle: 'Dispatch and track technician field tasks' },
        roles: { title: 'Role Management', subtitle: 'Assign and manage user roles across the system' },
        exports: { title: 'Export Data', subtitle: 'Download system data as professionally formatted Excel spreadsheets' },
        system: { title: 'System Management', subtitle: 'Direct access to Django admin resources' },
    };

    const currentSection = sectionTitles[section] || sectionTitles.dashboard;

    // ── Render section content ───────────────────────────────────────────────
    const renderContent = () => {
        switch (section) {
            case 'dashboard':
                return renderDashboard();
            case 'payments':
                return renderPayments();
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
            case 'exports':
                return renderExports();
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
                    <div className="stat-icon" style={{ color: 'var(--color-danger)' }}>⚖️</div>
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
                            marginLeft: '0.75rem', background: '#ef4444', color: 'var(--color-text-inverse)',
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
                            marginLeft: '0.75rem', background: '#f59e0b', color: 'var(--color-text)',
                            borderRadius: '9999px', padding: '2px 10px',
                            fontSize: '0.8rem', fontWeight: 700
                        }}>{pendingReadings.length}</span>
                    )}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setFieldTaskModal(true)}
                        style={{ background: 'var(--color-accent)' }}
                    >
                        + Assign Field Task
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleBatchAssignFieldTasks}
                        style={{ background: 'var(--color-accent)' }}
                    >
                        📍 Assign All Active Meters
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleBatchAssign}
                        style={{ background: 'var(--color-accent-hover)' }}
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
                            marginLeft: '0.75rem', background: '#3b82f6', color: 'var(--color-text-inverse)',
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
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid #ef4444', color: 'var(--color-danger)' }}
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
                                    <td style={{ fontWeight: 600 }}>{user.full_name} {user.is_staff ? <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem', marginLeft: 4 }}>[Staff]</span> : ''}</td>
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
    // SECTION: Exports
    // ═══════════════════════════════════════════════════════════════════════════
    const renderExports = () => (
        <div className="panel">
            <div className="panel-header">
                <h2 className="panel-title">📥 Export Data</h2>
            </div>
            <div className="panel-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Download system data as professionally formatted Excel spreadsheets.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
                    <div style={{
                        background: 'var(--bg-body)', border: '1px solid var(--border-default)',
                        borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease', cursor: 'pointer'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        onClick={() => {
                            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                            window.open(`${API}/api/analytics/export/bills/?token=${tokenObj?.access}`, '_blank');
                        }}
                    >
                        <div className="stat-icon rose" style={{ width: 48, height: 48, fontSize: '1.4rem', marginBottom: 0 }}>💰</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Export Bills</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Download all billing records with amounts, status, and due dates.</div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: '0.25rem' }}>⬇ Download .xlsx</button>
                    </div>

                    <div style={{
                        background: 'var(--bg-body)', border: '1px solid var(--border-default)',
                        borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease', cursor: 'pointer'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        onClick={() => {
                            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                            window.open(`${API}/api/analytics/export/customers/?token=${tokenObj?.access}`, '_blank');
                        }}
                    >
                        <div className="stat-icon blue" style={{ width: 48, height: 48, fontSize: '1.4rem', marginBottom: 0 }}>👥</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Export Customers</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Download the full customer list with contact info and meter counts.</div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: '0.25rem' }}>⬇ Download .xlsx</button>
                    </div>

                    <div style={{
                        background: 'var(--bg-body)', border: '1px solid var(--border-default)',
                        borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease', cursor: 'pointer'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        onClick={() => {
                            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                            window.open(`${API}/api/analytics/export/anomalies/?token=${tokenObj?.access}`, '_blank');
                        }}
                    >
                        <div className="stat-icon amber" style={{ width: 48, height: 48, fontSize: '1.4rem', marginBottom: 0 }}>⚠️</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Export Anomalies</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Download anomaly and alert reports with resolution status.</div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: '0.25rem' }}>⬇ Download .xlsx</button>
                    </div>
                </div>
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════════

    const renderSystem = () => (
        <>
            {renderSystemControlPanel()}
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
                                        <a href={`${API}/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`${API}/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
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
                                        <a href={`${API}/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`${API}/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
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
                                        <a href={`${API}/admin/${item.path}/add/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>+ Add</a>
                                        <a href={`${API}/admin/${item.path}/`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}>Manage</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Data Panel */}
            <div className="panel" style={{ marginTop: '2rem' }}>
                <div className="panel-header">
                    <h2 className="panel-title">📥 Export Data</h2>
                </div>
                <div className="panel-body">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                        Download system data as professionally formatted Excel spreadsheets.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                                window.open(`${API}/api/analytics/export/bills/?token=${tokenObj?.access}`, '_blank');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            💰 Export Bills
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                                window.open(`${API}/api/analytics/export/customers/?token=${tokenObj?.access}`, '_blank');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            👥 Export Customers
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                                window.open(`${API}/api/analytics/export/anomalies/?token=${tokenObj?.access}`, '_blank');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            ⚠️ Export Anomalies
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </>
);

    return (
        <div className="app-layout">
            <Sidebar />

            {/* ── Reading Review Modal ───────────────────────────────────── */}
            {reviewModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Review Reading</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Customer: <strong>{reviewModal.customer}</strong> &nbsp;|&nbsp; Meter: <code>{reviewModal.meter}</code>
                        </p>

                        {reviewModal.image_url && (
                            <div style={{ marginBottom: '1.25rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                <SecureImage
                                    src={reviewModal.image_url.startsWith('http') ? reviewModal.image_url : `${API}${reviewModal.image_url}`}
                                    alt="Meter reading"
                                    style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: 'var(--color-primary)' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            AI Suggested Value: <strong style={{ color: 'var(--text-primary)' }}>
                                {reviewModal.reading_value ?? 'N/A'} m³
                            </strong>
                            {reviewModal.ocr_confidence && (
                                <span style={{ marginLeft: '0.75rem', color: 'var(--color-warning)' }}>
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
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{reviewError}</p>
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
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '520px' }}>
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
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{disputeError}</p>
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
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '520px' }}>
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
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{maintError}</p>
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

            {/* ── Field Task Modal ─────────────────────────────── */}
            {fieldTaskModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '520px' }}>
                        <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Assign Field Task</h2>

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Select Meter</label>
                        <SearchableSelect
                            placeholder="-- Type or Select Meter --"
                            value={fieldTaskForm.meter_id}
                            onChange={val => { setFieldTaskForm({ ...fieldTaskForm, meter_id: val }); setFieldTaskError(''); }}
                            options={(Array.isArray(allMeters) ? allMeters : [])
                                .map(m => ({ value: m.id, label: m.meter_number }))}
                        />

                        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Assign Clerk</label>
                        <SearchableSelect
                            placeholder="-- Type or Select Clerk --"
                            value={fieldTaskForm.clerk_id}
                            onChange={val => { setFieldTaskForm({ ...fieldTaskForm, clerk_id: val }); setFieldTaskError(''); }}
                            options={allUsers
                                .filter(u => u.role?.toUpperCase() === 'CLERK')
                                .map(c => ({ value: c.id, label: `${c.full_name} (${c.email})` }))}
                        />

                        {fieldTaskError && (
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{fieldTaskError}</p>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setFieldTaskModal(false)} disabled={fieldTaskSubmitting}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleFieldTaskSubmit} disabled={fieldTaskSubmitting}>
                                {fieldTaskSubmitting ? 'Assigning...' : 'Assign Field Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Deactivate Meter Modal ─────────────────────────────── */}
            {deactivateModalCustomer && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <h2 style={{ marginBottom: '1rem', color: 'var(--color-danger)' }}>⚠️ Deactivate Meter</h2>
                        <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
                            Are you sure you want to remotely deactivate the water meter for <strong>{deactivateModalCustomer.name}</strong>?
                        </p>
                        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            <div>Customer ID: <code>{deactivateModalCustomer.id}</code></div>
                            <div>Meter Number: <code>{deactivateModalCustomer.meter?.meter_number}</code></div>
                            <div>Current Bill: <strong>ETB {deactivateModalCustomer.current_bill_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                            <div>Status: <span className="badge badge-danger" style={{ textTransform: 'uppercase' }}>{deactivateModalCustomer.payment_status}</span></div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            * This action will remotely disconnect the water meter and transition its status to 'DISCONNECTED'. The customer will be notified via email and system notification.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDeactivateModalCustomer(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeactivateMeter(deactivateModalCustomer.id)}>Confirm Deactivation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reactivate Meter Modal ─────────────────────────────── */}
            {reactivateModalCustomer && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <h2 style={{ marginBottom: '1rem', color: 'var(--color-success)' }}>⚡ Reactivate Meter</h2>
                        <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
                            Are you sure you want to remotely reactivate the water meter for <strong>{reactivateModalCustomer.name}</strong>?
                        </p>
                        <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            <div>Customer ID: <code>{reactivateModalCustomer.id}</code></div>
                            <div>Meter Number: <code>{reactivateModalCustomer.meter?.meter_number}</code></div>
                            <div>Status: <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>{reactivateModalCustomer.payment_status}</span></div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            * This action will remotely enable the water meter and restore its status to 'ACTIVE'. The customer will receive service restoration confirmation.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setReactivateModalCustomer(null)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" style={{ background: 'var(--color-success)', border: 'none' }} onClick={() => handleReactivateMeter(reactivateModalCustomer.id)}>Confirm Reactivation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Single Warning Options Modal ─────────────────────────────── */}
            {warnModalCustomer && (
                <div className="modal-overlay" style={{ zIndex: 1001 }}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
                        <h2 style={{ marginBottom: '1rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✉️ Send Outstanding Bill Warning
                        </h2>
                        <p style={{ color: 'var(--text-primary)', marginBottom: '1.25rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            You are about to send an outstanding payment warning to <strong>{warnModalCustomer.name}</strong> (ID: <code>{warnModalCustomer.id.split('-')[0]}...</code>).
                            They currently have <strong>{warnModalCustomer.billing_history?.filter(b => b.status === 'UNPAID' || b.status === 'OVERDUE').length || warnModalCustomer.consecutive_unpaid_months || 0}</strong> unpaid/overdue bill(s).
                        </p>
                        
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Select Severity / Warning Type
                            </label>
                            <select 
                                value={warnType} 
                                onChange={e => setWarnType(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.75rem', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--border-default)', 
                                    background: 'var(--bg-body)', 
                                    color: 'var(--text-primary)', 
                                    fontSize: '0.95rem',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="standard">Standard Warning</option>
                                <option value="urgent">Urgent Warning</option>
                                <option value="disconnection">Disconnection Notice (Final Notice)</option>
                            </select>
                        </div>
                        
                        <div style={{ 
                            background: 'var(--color-surface-2)', 
                            border: '1px solid var(--border-default)', 
                            padding: '1.25rem', 
                            borderRadius: '8px', 
                            marginBottom: '1.5rem', 
                            fontSize: '0.9rem' 
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                🔍 Live Notification Preview:
                            </div>
                            <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                {(() => {
                                    const unpaidCount = warnModalCustomer.billing_history?.filter(b => b.status === 'UNPAID' || b.status === 'OVERDUE').length || warnModalCustomer.consecutive_unpaid_months || 0;
                                    if (warnType === 'urgent') {
                                        return `URGENT: Dear Customer, you have ${unpaidCount} unpaid/overdue water bill(s). Please settle them immediately to avoid remote deactivation of your meter.`;
                                    } else if (warnType === 'disconnection') {
                                        return `FINAL NOTICE: Your water meter is scheduled for remote deactivation due to ${unpaidCount} unpaid/overdue bill(s). Please settle them now to prevent service cutoff.`;
                                    } else {
                                        return `Dear Customer, you have ${unpaidCount} unpaid/overdue water bill(s). Please settle them as soon as possible to avoid service disruption.`;
                                    }
                                })()}
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setWarnModalCustomer(null)}>Cancel</button>
                            <button 
                                className="btn btn-primary btn-sm" 
                                style={{ background: 'var(--color-warning)', border: 'none', color: '#fff', fontWeight: 600 }} 
                                onClick={() => handleSendWarning(warnModalCustomer.id, warnType)}
                            >
                                Dispatch Warning
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bulk Warning Options Modal ─────────────────────────────── */}
            {bulkWarnModal && (
                <div className="modal-overlay" style={{ zIndex: 1001 }}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
                        <h2 style={{ marginBottom: '1rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✉️ Send Bulk Outstanding Warning
                        </h2>
                        <p style={{ color: 'var(--text-primary)', marginBottom: '1.25rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            You are about to dispatch outstanding billing warnings to <strong>{selectedCustomers.length}</strong> selected customer(s).
                            Each warning will automatically calculate and display that customer's exact count of unpaid/overdue bills.
                        </p>
                        
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Select Severity / Warning Type
                            </label>
                            <select 
                                value={bulkWarnType} 
                                onChange={e => setBulkWarnType(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.75rem', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--border-default)', 
                                    background: 'var(--bg-body)', 
                                    color: 'var(--text-primary)', 
                                    fontSize: '0.95rem',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="standard">Standard Warning</option>
                                <option value="urgent">Urgent Warning</option>
                                <option value="disconnection">Disconnection Notice (Final Notice)</option>
                            </select>
                        </div>
                        
                        <div style={{ 
                            background: 'var(--color-surface-2)', 
                            border: '1px solid var(--border-default)', 
                            padding: '1.25rem', 
                            borderRadius: '8px', 
                            marginBottom: '1.5rem', 
                            fontSize: '0.9rem' 
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                🔍 Message Template Preview (Example with 3 unpaid bills):
                            </div>
                            <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                {bulkWarnType === 'urgent' && "URGENT: Dear Customer, you have 3 unpaid/overdue water bill(s). Please settle them immediately to avoid remote deactivation of your meter."}
                                {bulkWarnType === 'disconnection' && "FINAL NOTICE: Your water meter is scheduled for remote deactivation due to 3 unpaid/overdue bill(s). Please settle them now to prevent service cutoff."}
                                {bulkWarnType === 'standard' && "Dear Customer, you have 3 unpaid/overdue water bill(s). Please settle them as soon as possible to avoid service disruption."}
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setBulkWarnModal(false)}>Cancel</button>
                            <button 
                                className="btn btn-primary btn-sm" 
                                style={{ background: 'var(--color-warning)', border: 'none', color: '#fff', fontWeight: 600 }} 
                                onClick={() => handleBulkWarn(bulkWarnType)}
                            >
                                Dispatch Bulk Warnings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Customer Details & Billing History Modal ─────────────── */}
            {detailsModalCustomer && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '780px', width: '90%' }}>
                        <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>👤 Customer Profile Details</h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'var(--color-surface-2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Personal Info</h3>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div><strong>Name:</strong> {detailsModalCustomer.name}</div>
                                    <div><strong>Email:</strong> {detailsModalCustomer.email}</div>
                                    <div><strong>Phone:</strong> {detailsModalCustomer.phone || 'N/A'}</div>
                                    <div><strong>Class:</strong> <span style={{ textTransform: 'capitalize' }}>{detailsModalCustomer.customer_class?.toLowerCase()}</span></div>
                                </div>
                            </div>
                            
                            <div style={{ background: 'var(--color-surface-2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Meter Info</h3>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div><strong>Meter ID:</strong> <code>{detailsModalCustomer.meter?.id || 'N/A'}</code></div>
                                    <div><strong>Meter Number:</strong> <code>{detailsModalCustomer.meter?.meter_number}</code></div>
                                    <div><strong>Meter Status:</strong> <span className={`badge ${getMeterBadge(detailsModalCustomer.meter?.status)}`} style={{ fontSize: '0.75rem' }}>{detailsModalCustomer.meter?.status}</span></div>
                                    <div><strong>Zone/Area:</strong> {detailsModalCustomer.zone || 'N/A'}</div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--color-surface-2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Billing Summary</h3>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div><strong>Payment Status:</strong> <span className={`badge ${getPaymentBadge(detailsModalCustomer.payment_status)}`} style={{ fontSize: '0.75rem' }}>{detailsModalCustomer.payment_status}</span></div>
                                    <div><strong>Current Bill Amount:</strong> ETB {detailsModalCustomer.current_bill_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    <div><strong>Months Unpaid:</strong> {detailsModalCustomer.consecutive_unpaid_months}</div>
                                    <div><strong>Last Payment Date:</strong> {detailsModalCustomer.last_payment_date}</div>
                                </div>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>💳 Billing History</h3>
                        <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            {(!detailsModalCustomer.billing_history || detailsModalCustomer.billing_history.length === 0) ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No billing records available for this customer.</div>
                            ) : (
                                <table className="data-table" style={{ margin: 0 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-surface-2)' }}>
                                            <th>Bill Date</th>
                                            <th>Due Date</th>
                                            <th style={{ textAlign: 'right' }}>Consumption (m³)</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                            <th>Status</th>
                                            <th>Paid Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailsModalCustomer.billing_history.map(bill => (
                                            <tr key={bill.id}>
                                                <td>{bill.created_at}</td>
                                                <td>{bill.due_date}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 500 }}>{bill.consumption.toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>ETB {bill.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td>
                                                    <span className={`badge ${getPaymentBadge(bill.status)}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                                        {bill.status}
                                                    </span>
                                                </td>
                                                <td>{bill.paid_at || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDetailsModalCustomer(null)}>Close Profile</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Global Payment History Sidebar Drawer ─────────────────── */}
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    right: showHistorySidebar ? 0 : '-500px',
                    width: '460px',
                    maxWidth: '90vw',
                    height: '100vh',
                    background: 'var(--bg-secondary)',
                    borderLeft: '1px solid var(--border-default)',
                    boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
                    zIndex: 1050,
                    transition: 'right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--color-surface-2)',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📜 Payment History Log
                        </h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All customer payment records</span>
                    </div>
                    <button 
                        onClick={() => setShowHistorySidebar(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            transition: 'all 0.2s',
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* KPI stats inside sidebar */}
                <div style={{
                    padding: '1rem 1.5rem',
                    background: 'var(--bg-body)',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem'
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Completed</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>ETB {historySummary.total_amount}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{historySummary.total_completed} transactions</div>
                    </div>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Pending:</span>
                            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{historySummary.total_pending}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span>Failed:</span>
                            <span style={{ fontWeight: 600, color: '#ef4444' }}>{historySummary.total_failed}</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Filter Panel */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border-default)',
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <input 
                        type="text" 
                        placeholder="Search by customer, trans ref..."
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-body)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <select
                            value={historyStatusFilter}
                            onChange={e => setHistoryStatusFilter(e.target.value)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-body)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">-- All Statuses --</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="PENDING">Pending</option>
                            <option value="FAILED">Failed</option>
                        </select>
                        <select
                            value={historyMethodFilter}
                            onChange={e => setHistoryMethodFilter(e.target.value)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-body)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">-- All Methods --</option>
                            <option value="MPESA">M-Pesa</option>
                            <option value="CHAPA">Chapa</option>
                            <option value="CASH">Cash</option>
                        </select>
                    </div>
                </div>

                {/* List Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'var(--bg-body)'
                }}>
                    {historyLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-secondary)' }}>
                            <div style={{ border: '3px solid var(--border-default)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', width: '24px', height: '24px', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
                            <span>Fetching transactions...</span>
                        </div>
                    ) : historyPayments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>No payments found</div>
                            <span style={{ fontSize: '0.8rem' }}>Try clearing filters or search query</span>
                        </div>
                    ) : (
                        historyPayments.map(p => (
                            <div 
                                key={p.id}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '10px',
                                    padding: '0.85rem 1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                            {p.customer_name}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {p.customer_email}
                                        </span>
                                    </div>
                                    <span className={`badge ${getPaymentBadge(p.status)}`} style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {p.status}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        💳 {p.payment_method}
                                        {p.transaction_ref && <code style={{ fontSize: '0.75rem', background: 'var(--bg-body)', padding: '1px 4px', borderRadius: '4px' }}>({p.transaction_ref})</code>}
                                    </span>
                                    <strong style={{ color: p.status === 'COMPLETED' ? '#10b981' : 'var(--text-primary)' }}>
                                        ETB {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </strong>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>📅 {p.paid_at || p.created_at}</span>
                                    {p.bill_period && <span style={{ fontStyle: 'italic' }}>Bill: {p.bill_period}</span>}
                                </div>

                                {p.bill_id && (
                                    <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`${API}/api/billing/bills/${p.bill_id}/pdf`, '_blank');
                                        }}
                                        style={{
                                            marginTop: '0.35rem',
                                            padding: '0.2rem 0.5rem',
                                            fontSize: '0.7rem',
                                            minHeight: 'auto',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            alignSelf: 'flex-start'
                                        }}
                                    >
                                        📄 View PDF Bill
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-default)',
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                }}>
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            setHistorySearch('');
                            setHistoryStatusFilter('');
                            setHistoryMethodFilter('');
                        }}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Background Backdrop overlay when sidebar is open */}
            {showHistorySidebar && (
                <div 
                    onClick={() => setShowHistorySidebar(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 1040,
                        transition: 'opacity 0.25s ease'
                    }}
                />
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
