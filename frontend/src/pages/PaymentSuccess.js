import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'failed', 'pending'
    const [paymentData, setPaymentData] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const txRef = searchParams.get('tx_ref');
    const billId = searchParams.get('bill_id');

    useEffect(() => {
        if (!txRef) {
            setStatus('failed');
            return;
        }

        const verifyPayment = async () => {
            try {
                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };
                const url_base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
                const res = await axios.get(`${url_base}/api/billing/chapa/verify/${txRef}/`, config);

                if (res.data.status === 'success') {
                    setStatus('success');
                    setPaymentData(res.data);
                } else if (res.data.status === 'failed') {
                    setStatus('failed');
                    setPaymentData(res.data);
                } else {
                    // Still pending — retry up to 5 times
                    setStatus('pending');
                    if (retryCount < 5) {
                        setTimeout(() => setRetryCount(prev => prev + 1), 3000);
                    }
                }
            } catch (error) {
                console.error('Verification error:', error);
                if (retryCount < 5) {
                    setTimeout(() => setRetryCount(prev => prev + 1), 3000);
                } else {
                    setStatus('failed');
                }
            }
        };

        verifyPayment();
    }, [txRef, retryCount]);

    const getIcon = () => {
        switch (status) {
            case 'verifying':
            case 'pending':
                return (
                    <div className="payment-status-icon pending">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12,6 12,12 16,14" />
                        </svg>
                    </div>
                );
            case 'success':
                return (
                    <div className="payment-status-icon success">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9 12l2 2 4-4" />
                        </svg>
                    </div>
                );
            case 'failed':
                return (
                    <div className="payment-status-icon failed">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                );
            default:
                return null;
        }
    };

    const getTitle = () => {
        switch (status) {
            case 'verifying': return 'Verifying Payment...';
            case 'pending': return 'Processing Payment...';
            case 'success': return 'Payment Successful! 🎉';
            case 'failed': return 'Payment Failed';
            default: return '';
        }
    };

    const getMessage = () => {
        switch (status) {
            case 'verifying':
                return 'Please wait while we verify your payment with Chapa...';
            case 'pending':
                return 'Your payment is still being processed. We\'ll update you shortly...';
            case 'success':
                return `Your payment of ETB ${paymentData?.amount || ''} has been received. Your bill has been marked as paid.`;
            case 'failed':
                return 'We could not verify your payment. Please try again or contact support.';
            default:
                return '';
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">Payment Status</h1>
                        <p className="content-subtitle">Transaction Reference: {txRef || 'N/A'}</p>
                    </div>
                </div>

                <div className="content-body">
                    <div className="panel" style={{ maxWidth: '560px', margin: '2rem auto', textAlign: 'center' }}>
                        <div className="panel-body" style={{ padding: 'var(--space-2xl)' }}>
                            {/* Status Icon */}
                            <div style={{ marginBottom: 'var(--space-xl)' }}>
                                {getIcon()}
                            </div>

                            {/* Title */}
                            <h2 style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-md)',
                            }}>
                                {getTitle()}
                            </h2>

                            {/* Message */}
                            <p style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.95rem',
                                lineHeight: 1.6,
                                marginBottom: 'var(--space-xl)',
                            }}>
                                {getMessage()}
                            </p>

                            {/* Loading spinner for pending/verifying */}
                            {(status === 'verifying' || status === 'pending') && (
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <div className="spinner" style={{
                                        width: '32px',
                                        height: '32px',
                                        border: '3px solid var(--border-default)',
                                        borderTop: '3px solid var(--color-primary)',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto',
                                    }} />
                                </div>
                            )}

                            {/* Success details */}
                            {status === 'success' && paymentData && (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--space-lg)',
                                    marginBottom: 'var(--space-xl)',
                                    textAlign: 'left',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Amount Paid</span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>ETB {parseFloat(paymentData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</span>
                                        <span className="badge badge-success">✓ Paid</span>
                                    </div>
                                    {paymentData.paid_at && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Paid At</span>
                                            <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                                {new Date(paymentData.paid_at).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => navigate('/bills')}
                                >
                                    ← Back to Bills
                                </button>
                                {status === 'failed' && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => navigate('/bills')}
                                    >
                                        Try Again
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PaymentSuccess;
