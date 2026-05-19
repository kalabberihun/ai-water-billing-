import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const STEPS = [
    { icon: '📤', label: 'Upload', desc: 'Image received' },
    { icon: '🔍', label: 'Pre-process', desc: 'Enhancing image quality' },
    { icon: '🤖', label: 'AI Analysis', desc: 'Gemini Vision processing' },
    { icon: '🔢', label: 'Extraction', desc: 'Reading digits detected' },
    { icon: '✅', label: 'Complete', desc: 'Result verified' },
];

const DemoOCR = () => {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
            setResult(null);
            setError(null);
            setCurrentStep(-1);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
            setResult(null);
            setError(null);
            setCurrentStep(-1);
        }
    };

    const simulateSteps = (callback) => {
        const delays = [400, 800, 1200, 0, 300]; // step durations
        let elapsed = 0;
        
        delays.forEach((delay, idx) => {
            if (idx < 3) { // First 3 steps are simulated
                elapsed += delay;
                setTimeout(() => setCurrentStep(idx), elapsed);
            }
        });

        // Step 3 (AI Analysis) stays active until real API returns
        elapsed += delays[2];
        setTimeout(() => {
            setCurrentStep(2); // Stay on AI Analysis
            callback(); // Fire the real API call
        }, elapsed);
    };

    const runDemo = async () => {
        if (!image) return;
        setProcessing(true);
        setResult(null);
        setError(null);
        setCurrentStep(0);

        simulateSteps(async () => {
            try {
                const formData = new FormData();
                formData.append('image', image);

                const res = await axios.post(`${API_URL}/api/metering/demo-ocr/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data.success) {
                    setCurrentStep(3);
                    setTimeout(() => {
                        setCurrentStep(4);
                        setResult(res.data);
                        setProcessing(false);
                    }, 500);
                } else {
                    setError(res.data.error || 'Could not read meter');
                    setProcessing(false);
                    setCurrentStep(-1);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Processing failed. Please try again.');
                setProcessing(false);
                setCurrentStep(-1);
            }
        });
    };

    const reset = () => {
        setImage(null);
        setImagePreview(null);
        setResult(null);
        setError(null);
        setCurrentStep(-1);
        setProcessing(false);
    };

    return (
        <div className="demo-ocr-page">
            {/* Background */}
            <div className="landing-bg">
                <div className="landing-orb landing-orb-1"></div>
                <div className="landing-orb landing-orb-2"></div>
                <div className="landing-orb landing-orb-3"></div>
            </div>

            {/* Nav */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <Link to="/" className="landing-logo" style={{ textDecoration: 'none' }}>
                        <div className="landing-logo-icon">💧</div>
                        <span className="landing-logo-text">AquaBill AI</span>
                    </Link>
                    <div className="landing-nav-links">
                        <Link to="/features">Features</Link>
                        <Link to="/how-it-works">How It Works</Link>
                        <Link to="/demo-ocr" style={{ color: 'var(--color-accent)' }}>Live Demo</Link>
                    </div>
                    <div className="landing-nav-actions">
                        <ThemeToggle style={{ position: 'relative', top: 'auto', right: 'auto', zIndex: 1, boxShadow: 'none' }} />
                        <Link to="/login" className="landing-btn-ghost">Login</Link>
                        <Link to="/register" className="landing-btn-primary">Sign Up Free</Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="demo-ocr-container">
                <div className="demo-ocr-header">
                    <span className="landing-section-badge">Live Demo</span>
                    <h1 className="demo-ocr-title">AI Meter Reading</h1>
                    <p className="demo-ocr-subtitle">
                        Upload a water meter image and watch our AI extract the reading in real-time
                    </p>
                </div>

                <div className="demo-ocr-content">
                    {/* Left: Upload area */}
                    <div className="demo-ocr-upload-section">
                        <div
                            className={`demo-ocr-dropzone ${imagePreview ? 'demo-ocr-dropzone--has-image' : ''}`}
                            onClick={() => !processing && fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Meter" className="demo-ocr-preview" />
                            ) : (
                                <div className="demo-ocr-dropzone-content">
                                    <div className="demo-ocr-dropzone-icon">📷</div>
                                    <p className="demo-ocr-dropzone-text">
                                        Drop a meter image here or click to browse
                                    </p>
                                    <p className="demo-ocr-dropzone-hint">
                                        Supports JPG, PNG • Min 400x400px
                                    </p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />

                        <div className="demo-ocr-actions">
                            {image && !processing && !result && (
                                <button className="landing-btn landing-btn-primary demo-ocr-run-btn" onClick={runDemo}>
                                    🚀 Start AI Analysis
                                </button>
                            )}
                            {(result || error) && (
                                <button className="landing-btn landing-btn-secondary" onClick={reset}>
                                    🔄 Try Another Image
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Progress & Results */}
                    <div className="demo-ocr-results-section">
                        {/* Processing Steps */}
                        <div className="demo-ocr-steps">
                            {STEPS.map((step, idx) => (
                                <div
                                    key={idx}
                                    className={`demo-ocr-step ${
                                        currentStep > idx ? 'demo-ocr-step--done' :
                                        currentStep === idx ? 'demo-ocr-step--active' :
                                        'demo-ocr-step--pending'
                                    }`}
                                >
                                    <div className="demo-ocr-step-icon">
                                        {currentStep > idx ? '✓' : step.icon}
                                    </div>
                                    <div className="demo-ocr-step-info">
                                        <div className="demo-ocr-step-label">{step.label}</div>
                                        <div className="demo-ocr-step-desc">{step.desc}</div>
                                    </div>
                                    {currentStep === idx && processing && (
                                        <div className="demo-ocr-step-spinner" />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Result Card */}
                        {result && (
                            <div className="demo-ocr-result-card">
                                <div className="demo-ocr-result-header">
                                    <span className="demo-ocr-result-badge">AI Reading Detected</span>
                                </div>
                                <div className="demo-ocr-result-value">
                                    {result.reading} <span className="demo-ocr-result-unit">m³</span>
                                </div>
                                <div className="demo-ocr-confidence">
                                    <div className="demo-ocr-confidence-label">
                                        Confidence: {Math.round(result.confidence * 100)}%
                                    </div>
                                    <div className="demo-ocr-confidence-bar">
                                        <div
                                            className="demo-ocr-confidence-fill"
                                            style={{ width: `${result.confidence * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="demo-ocr-result-meta">
                                    <span>Model: {result.model}</span>
                                    <span>Image: {result.image_size}</span>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="demo-ocr-error">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {/* Empty state */}
                        {currentStep === -1 && !result && !error && (
                            <div className="demo-ocr-empty">
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
                                <p>Upload a meter image to see AI-powered OCR in action</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CTA */}
                <div className="demo-ocr-cta">
                    <p>Ready to automate your water billing?</p>
                    <Link to="/register" className="landing-btn landing-btn-primary">
                        Create Free Account →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DemoOCR;
