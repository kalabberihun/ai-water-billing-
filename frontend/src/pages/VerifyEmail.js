import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const emailParam = searchParams.get('email') || '';
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendMsg, setResendMsg] = useState('');
    const inputRefs = useRef([]);


    // Mask the email for display: jo***@gmail.com
    const maskedEmail = emailParam
        ? emailParam.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c)
        : '';

    // Start resend cooldown on mount
    useEffect(() => {
        setResendCooldown(60);
    }, []);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // Auto-focus first input
    useEffect(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
    }, []);

    const handleChange = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');

        // Auto-focus next input
        if (value && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 0) return;
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
            newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        // Focus last filled or the next empty
        const focusIndex = Math.min(pasted.length, 5);
        if (inputRefs.current[focusIndex]) inputRefs.current[focusIndex].focus();
    };

    const handleSubmit = useCallback(async () => {
        const code = otp.join('');
        if (code.length !== 6) {
            setError('Please enter the full 6-digit code.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            const res = await axios.post(`${API_URL}/api/auth/verify-email`, {
                email: emailParam,
                otp_code: code,
            });

            setSuccess(true);

            // Store tokens & auto-login
            localStorage.setItem('tokens', JSON.stringify(res.data));
            // Small delay to show success animation, then redirect
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } catch (err) {
            const msg = err.response?.data?.error || 'Verification failed. Please try again.';
            setError(msg);
            // Clear inputs on error
            setOtp(['', '', '', '', '', '']);
            if (inputRefs.current[0]) inputRefs.current[0].focus();
        } finally {
            setLoading(false);
        }
    }, [otp, emailParam]);

    // Auto-submit when all 6 digits are entered
    useEffect(() => {
        if (otp.every(d => d !== '') && !loading && !success) {
            handleSubmit();
        }
    }, [otp, loading, success, handleSubmit]);

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setResendMsg('');
        setError('');
        try {
            await axios.post(`${API_URL}/api/auth/resend-otp`, { email: emailParam });
            setResendMsg('A new code has been sent to your email!');
            setResendCooldown(60);
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to resend code. Try again later.';
            setError(msg);
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
                <div className="auth-card" style={{ maxWidth: 460 }}>
                    <div className="auth-logo">
                        {success ? (
                            <div className="otp-success-icon">✓</div>
                        ) : (
                            <div className="auth-logo-icon">✉️</div>
                        )}
                        <h1 className="auth-title">
                            {success ? 'Email Verified!' : 'Verify Your Email'}
                        </h1>
                        <p className="auth-subtitle">
                            {success
                                ? 'Redirecting you to your dashboard...'
                                : <>We sent a 6-digit code to <strong>{maskedEmail}</strong></>
                            }
                        </p>
                    </div>

                    {error && (
                        <div className="error-banner">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {resendMsg && (
                        <div className="error-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeftColor: 'var(--color-success)', color: 'var(--color-success)' }}>
                            <span>✅</span>
                            <span>{resendMsg}</span>
                        </div>
                    )}

                    {!success && (
                        <>
                            <div className="otp-container">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => inputRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className={`otp-input ${digit ? 'otp-input--filled' : ''}`}
                                        value={digit}
                                        onChange={(e) => handleChange(i, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(i, e)}
                                        onPaste={i === 0 ? handlePaste : undefined}
                                        disabled={loading}
                                        autoComplete="one-time-code"
                                    />
                                ))}
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={loading || otp.some(d => d === '')}
                                style={{ marginTop: '1.5rem' }}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner"></div>
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify Email →'
                                )}
                            </button>

                            <div className="otp-resend">
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Didn't receive the code?{' '}
                                </span>
                                {resendCooldown > 0 ? (
                                    <span className="otp-cooldown">
                                        Resend in {resendCooldown}s
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="otp-resend-btn"
                                        onClick={handleResend}
                                    >
                                        Resend Code
                                    </button>
                                )}
                            </div>

                            <p className="auth-link">
                                Wrong email?{' '}
                                <Link to="/register">Go back to registration</Link>
                            </p>
                        </>
                    )}

                    {success && (
                        <div className="otp-success-spinner">
                            <div className="spinner" style={{ width: 28, height: 28 }}></div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default VerifyEmail;
