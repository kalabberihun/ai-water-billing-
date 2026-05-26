import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({
        total_paid: '0.00',
        total_completed: 0,
        total_pending: 0,
        total_failed: 0,
        total_transactions: 0,
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
                const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
                const res = await axios.get(`${url_base}/api/billing/customer/payment-history`, config);
                setPayments(res.data.payments || []);
                setSummary(res.data.summary || {});
            } catch (err) {
                console.error('Failed to fetch payment history', err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleDownloadPDF = async (billId) => {
        try {
            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
            const config = {
                headers: { Authorization: `Bearer ${tokenObj?.access}` },
                responseType: 'blob'
            };
            const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const res = await axios.get(`${url_base}/api/billing/bills/${billId}/pdf`, config);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice_${billId.split('-')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download invoice. Please try again.');
        }
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredPayments = useMemo(() => {
        let filtered = [...payments];

        // Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.transaction_ref.toLowerCase().includes(lower) ||
                p.bill_period.toLowerCase().includes(lower) ||
                p.payment_method.toLowerCase().includes(lower) ||
                String(p.amount).includes(lower)
            );
        }

        // Status filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(p => p.status === statusFilter);
        }

        // Method filter
        if (methodFilter !== 'ALL') {
            filtered = filtered.filter(p =>
                p.payment_method.toLowerCase().includes(methodFilter.toLowerCase())
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (sortConfig.key === 'amount' || sortConfig.key === 'consumption') {
                valA = Number(valA);
                valB = Number(valB);
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [payments, searchTerm, statusFilter, methodFilter, sortConfig]);

    const getStatusBadge = (status) => {
        const styles = {
            COMPLETED: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: '✓' },
            PENDING: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: '⏳' },
            FAILED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: '✗' },
            REFUNDED: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', icon: '↩' },
        };
        const s = styles[status] || styles.PENDING;
        return (
            <span style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: s.bg,
                color: s.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                letterSpacing: '0.02em',
                textTransform: 'capitalize',
            }}>
                {s.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
        );
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const uniqueMethods = [...new Set(payments.map(p => p.payment_method))];

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">Payment History</h1>
                        <p className="content-subtitle">View your complete monthly payment transaction history</p>
                    </div>
                </div>

                <div className="content-body">
                    {/* Summary Stats */}
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '2rem' }}>
                        <div className="stat-card teal">
                            <div className="stat-icon teal">💰</div>
                            <div className="stat-value">
                                <span className="currency" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ETB </span>
                                {summary.total_paid}
                            </div>
                            <div className="stat-label">Total Paid</div>
                        </div>
                        <div className="stat-card blue">
                            <div className="stat-icon blue">✅</div>
                            <div className="stat-value">{summary.total_completed}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <div className="stat-card amber">
                            <div className="stat-icon amber">⏳</div>
                            <div className="stat-value">{summary.total_pending}</div>
                            <div className="stat-label">Pending</div>
                        </div>
                        <div className="stat-card rose">
                            <div className="stat-icon rose">❌</div>
                            <div className="stat-value">{summary.total_failed}</div>
                            <div className="stat-label">Failed</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="panel" style={{ marginBottom: '1.5rem' }}>
                        <div className="panel-body" style={{ padding: '1rem 1.5rem' }}>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                alignItems: 'center',
                            }}>
                                <div style={{ flex: '1 1 250px', position: 'relative' }}>
                                    <span style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '1rem',
                                        opacity: 0.5,
                                        pointerEvents: 'none',
                                    }}>🔍</span>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Search by reference, period, method..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{
                                            paddingLeft: '2.5rem',
                                            height: '42px',
                                            borderRadius: '10px',
                                        }}
                                    />
                                </div>
                                <select
                                    className="form-input"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    style={{ width: 'auto', minWidth: '140px', height: '42px', borderRadius: '10px' }}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="FAILED">Failed</option>
                                    <option value="REFUNDED">Refunded</option>
                                </select>
                                <select
                                    className="form-input"
                                    value={methodFilter}
                                    onChange={e => setMethodFilter(e.target.value)}
                                    style={{ width: 'auto', minWidth: '140px', height: '42px', borderRadius: '10px' }}
                                >
                                    <option value="ALL">All Methods</option>
                                    {uniqueMethods.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <span style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-tertiary)',
                                    fontWeight: 500,
                                    marginLeft: 'auto',
                                }}>
                                    {filteredPayments.length} of {payments.length} transactions
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Transaction History</h3>
                        </div>
                        <div className="panel-body" style={{ padding: 0, overflow: 'auto' }}>
                            {loading ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4rem 2rem',
                                    gap: '1rem',
                                }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        border: '4px solid var(--border-subtle)',
                                        borderTopColor: 'var(--primary-500)',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                    }} />
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading payment history...</span>
                                </div>
                            ) : filteredPayments.length === 0 ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4rem 2rem',
                                    gap: '0.75rem',
                                }}>
                                    <span style={{ fontSize: '3rem' }}>📭</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>No payments found</span>
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                        {payments.length > 0 ? 'Try adjusting your filters' : 'Your payment history will appear here once you make a payment'}
                                    </span>
                                </div>
                            ) : (
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '0.875rem',
                                }}>
                                    <thead>
                                        <tr style={{
                                            background: 'var(--bg-tertiary)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                        }}>
                                            {[
                                                { key: 'created_at', label: 'Date' },
                                                { key: 'bill_period', label: 'Billing Period' },
                                                { key: 'amount', label: 'Amount (ETB)' },
                                                { key: 'consumption', label: 'Usage (m³)' },
                                                { key: 'payment_method', label: 'Method' },
                                                { key: 'status', label: 'Status' },
                                                { key: 'transaction_ref', label: 'Reference' },
                                                { key: null, label: 'Invoice' },
                                            ].map((col, i) => (
                                                <th
                                                    key={i}
                                                    onClick={() => col.key && handleSort(col.key)}
                                                    style={{
                                                        padding: '0.85rem 1rem',
                                                        textAlign: 'left',
                                                        fontWeight: 600,
                                                        fontSize: '0.78rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.06em',
                                                        color: 'var(--text-secondary)',
                                                        cursor: col.key ? 'pointer' : 'default',
                                                        userSelect: 'none',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'color 0.2s',
                                                    }}
                                                >
                                                    {col.label} {col.key && (
                                                        <span style={{
                                                            opacity: sortConfig.key === col.key ? 1 : 0.35,
                                                            marginLeft: '4px',
                                                            fontSize: '0.7rem',
                                                        }}>{getSortIcon(col.key)}</span>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.map((p, index) => (
                                            <tr
                                                key={p.id}
                                                style={{
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    transition: 'background 0.15s',
                                                    background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(52, 120, 255, 0.04)'}
                                                onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                                            >
                                                <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                    {new Date(p.created_at).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {p.bill_period || '—'}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
                                                    {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)' }}>
                                                    {p.consumption ? p.consumption.toFixed(1) : '—'}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500,
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)',
                                                        textTransform: 'capitalize',
                                                    }}>
                                                        {p.payment_method}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem' }}>
                                                    {getStatusBadge(p.status)}
                                                </td>
                                                <td style={{
                                                    padding: '0.8rem 1rem',
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: '0.8rem',
                                                    fontFamily: "'Courier New', monospace",
                                                    maxWidth: '140px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {p.transaction_ref || '—'}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem' }}>
                                                    {p.bill_id && (
                                                        <button
                                                            onClick={() => handleDownloadPDF(p.bill_id)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: '1px solid var(--border-default)',
                                                                color: 'var(--primary-400)',
                                                                padding: '0.3rem 0.7rem',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 500,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.3rem',
                                                                transition: 'all 0.2s',
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.background = 'var(--primary-500)';
                                                                e.currentTarget.style.color = '#fff';
                                                                e.currentTarget.style.borderColor = 'var(--primary-500)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.background = 'transparent';
                                                                e.currentTarget.style.color = 'var(--primary-400)';
                                                                e.currentTarget.style.borderColor = 'var(--border-default)';
                                                            }}
                                                        >
                                                            📄 PDF
                                                        </button>
                                                    )}
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

            {/* Spinner animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default PaymentHistory;
