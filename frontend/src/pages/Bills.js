import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const Bills = () => {
    const [bills, setBills] = useState([]);
    const [stats, setStats] = useState({
        currentBalance: 0,
        totalPaid: 0,
        nextDueDate: 'N/A'
    });
    const [payingBillId, setPayingBillId] = useState(null);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeBillId, setDisputeBillId] = useState(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isDisputing, setIsDisputing] = useState(false);

    useEffect(() => {
        const fetchBills = async () => {
            try {
                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };

                // Fetch user's bills
                const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/billing/bills`, config);
                const fetchedBills = res.data.results || res.data; // Handle both paginated and list responses

                setBills(fetchedBills);

                // Calculate stats
                let balance = 0;
                let paid = 0;
                let nextDue = null;

                fetchedBills.forEach(b => {
                    const amt = parseFloat(b.total_amount);
                    if (b.status === 'UNPAID' || b.status === 'OVERDUE') {
                        balance += amt;
                        if (b.due_date && (!nextDue || new Date(b.due_date) < new Date(nextDue))) {
                            nextDue = b.due_date;
                        }
                    } else if (b.status === 'PAID') {
                        paid += amt;
                    }
                });

                // Format the next due date if found
                let formattedDueDate = 'N/A';
                if (nextDue) {
                    const d = new Date(nextDue);
                    formattedDueDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }

                setStats({
                    currentBalance: balance,
                    totalPaid: paid,
                    nextDueDate: formattedDueDate
                });

            } catch (error) {
                console.error("Error fetching bills:", error);
            }
        };

        fetchBills();
    }, []);

    const handleDownloadPDF = async (billId) => {
        try {
            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
            const config = {
                headers: { Authorization: `Bearer ${tokenObj?.access}` },
                responseType: 'blob'
            };

            const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const res = await axios.get(`${url_base}/api/billing/bills/${billId}/pdf`, { ...config, responseType: 'blob' });

            // Create a link to download the blob
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice_${billId.split('-')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF:", error);
            alert("Failed to download invoice. Please try again.");
        }
    };

    const handlePayChapa = async (billId) => {
        setPayingBillId(billId);
        try {
            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
            const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };

            const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const res = await axios.post(`${url_base}/api/billing/chapa/initialize/`, { bill_id: billId }, config);

            if (res.data.checkout_url) {
                // Redirect to Chapa hosted checkout
                window.location.href = res.data.checkout_url;
            } else {
                alert('Could not get checkout URL. Please try again.');
                setPayingBillId(null);
            }
        } catch (error) {
            console.error("Payment failed:", error);
            const msg = error.response?.data?.error || 'Payment initialization failed. Please try again.';
            alert(msg);
            setPayingBillId(null);
        }
    };

    const handleDisputeSubmit = async () => {
        if (!disputeReason.trim()) {
            alert("Please enter a reason for the dispute.");
            return;
        }

        setIsDisputing(true);
        try {
            const tokenObj = JSON.parse(localStorage.getItem('tokens'));
            const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
            const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            
            await axios.post(`${url_base}/api/billing/disputes/create/`, {
                bill_id: disputeBillId,
                reason: disputeReason
            }, config);
            
            alert("Dispute submitted successfully. We will review it shortly.");
            setShowDisputeModal(false);
            setDisputeReason('');
            setDisputeBillId(null);
        } catch (error) {
            console.error("Dispute failed:", error);
            const msg = error.response?.data?.error || error.response?.data?.detail || "Failed to submit dispute.";
            alert(msg);
        } finally {
            setIsDisputing(false);
        }
    };

    const getStatusBadge = (status) => {
        const map = {
            'Paid': 'badge-success',
            'Unpaid': 'badge-warning',
            'Overdue': 'badge-danger'
        };
        const iconMap = {
            'Paid': '✓',
            'Unpaid': '⏳',
            'Overdue': '⚠️'
        };
        return (
            <span className={`badge ${map[status] || 'badge-info'}`}>
                {iconMap[status]} {status}
            </span>
        );
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">Bills & Payments</h1>
                        <p className="content-subtitle">Track your billing history and make payments</p>
                    </div>
                    <button className="btn btn-primary btn-sm">💳 Pay Now</button>
                </div>

                <div className="content-body">
                    {/* Summary Stats */}
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="stat-card blue">
                            <div className="stat-icon blue">💰</div>
                            <div className="stat-value">
                                <span className="currency" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ETB </span>
                                {stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="stat-label">Current Balance Due</div>
                        </div>
                        <div className="stat-card teal">
                            <div className="stat-icon teal">✅</div>
                            <div className="stat-value">
                                <span className="currency" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ETB </span>
                                {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="stat-label">Total Paid (YTD)</div>
                        </div>
                        <div className="stat-card rose">
                            <div className="stat-icon rose">📅</div>
                            <div className="stat-value">{stats.nextDueDate}</div>
                            <div className="stat-label">Next Due Date</div>
                        </div>
                    </div>

                    {/* Bills Cards */}
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Billing History</h3>
                        </div>
                        <div className="panel-body">
                            <div className="bills-grid">
                                {bills.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>No bills found.</p>
                                ) : (
                                    bills.map((bill) => {
                                        const billDate = new Date(bill.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                        const formattedAmount = parseFloat(bill.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
                                        const isUnpaid = bill.status === 'UNPAID' || bill.status === 'OVERDUE';

                                        // The status badge function expects Title Case ('Paid', 'Unpaid', 'Overdue')
                                        const displayStatus = bill.status.charAt(0) + bill.status.slice(1).toLowerCase();

                                        return (
                                            <div className="bill-card" key={bill.id}>
                                                <div className="bill-card-header">
                                                    <span className="bill-card-id">{bill.id.split('-')[0]}...</span>
                                                    {getStatusBadge(displayStatus)}
                                                </div>
                                                <div className="bill-card-amount">
                                                    <span className="currency">ETB </span>{formattedAmount}
                                                </div>
                                                <div className="bill-card-details">
                                                    <div className="bill-detail">
                                                        <span className="bill-detail-label">Period</span>
                                                        <span className="bill-detail-value">{billDate}</span>
                                                    </div>
                                                    <div className="bill-detail">
                                                        <span className="bill-detail-label">Usage</span>
                                                        <span className="bill-detail-value">{bill.consumption} m³</span>
                                                    </div>
                                                    <div className="bill-detail">
                                                        <span className="bill-detail-label">Due Date</span>
                                                        <span className="bill-detail-value">{bill.due_date || 'N/A'}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleDownloadPDF(bill.id)}
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ width: '100%', marginTop: 'var(--space-md)', background: 'transparent', border: '1px solid var(--border-default)' }}
                                                >
                                                    📄 Download Invoice (PDF)
                                                </button>

                                                {isUnpaid && (
                                                    <button
                                                        onClick={() => handlePayChapa(bill.id)}
                                                        disabled={payingBillId === bill.id || bill.status === 'PROCESSING'}
                                                        className={`btn ${bill.status === 'OVERDUE' ? 'btn-danger' : bill.status === 'PROCESSING' ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                                        style={{ width: '100%', marginTop: 'var(--space-sm)' }}
                                                    >
                                                        {payingBillId === bill.id ? '⏳ Connecting to Chapa...' : bill.status === 'PROCESSING' ? '🔄 Payment Processing...' : `💳 Pay ETB ${formattedAmount}`}
                                                    </button>
                                                )}
                                                
                                                <button
                                                    onClick={() => {
                                                        setDisputeBillId(bill.id);
                                                        setShowDisputeModal(true);
                                                    }}
                                                    className="btn btn-sm"
                                                    style={{ width: '100%', marginTop: 'var(--space-sm)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', textDecoration: 'underline' }}
                                                >
                                                    Report an issue (Dispute)
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {showDisputeModal && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="panel" style={{ width: '90%', maxWidth: '500px' }}>
                        <div className="panel-header">
                            <h3 className="panel-title">Dispute Bill</h3>
                        </div>
                        <div className="panel-body">
                            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                If you believe this bill is incorrect, please describe the issue below. We will temporarily pause late fees while reviewing your case.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Reason for Dispute</label>
                                <textarea 
                                    className="form-input" 
                                    rows="4" 
                                    placeholder="E.g., The reading seems way too high compared to my usual usage..."
                                    value={disputeReason}
                                    onChange={e => setDisputeReason(e.target.value)}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setShowDisputeModal(false)} disabled={isDisputing}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleDisputeSubmit} disabled={isDisputing}>
                                    {isDisputing ? 'Submitting...' : 'Submit Dispute'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bills;
