import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const MeterReadings = () => {
    const [readings, setReadings] = useState([]);
    const [meters, setMeters] = useState([]);
    const [selectedMeterId, setSelectedMeterId] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        verified: 0,
        pending: 0
    });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'processing', 'success', 'error'
    const [uploadMessage, setUploadMessage] = useState('');
    const fileInputRef = useRef(null);

    // ─── Camera Capture State ─────────────────────────────────────────────
    const [inputMethod, setInputMethod] = useState('upload'); // 'upload' | 'camera'
    const [cameraStream, setCameraStream] = useState(null);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };

                const [readingsRes, metersRes] = await Promise.all([
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/readings`, config),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/meters`, config)
                ]);

                const fetchedMeters = metersRes.data.results || metersRes.data;
                const fetchedReadings = readingsRes.data.results || readingsRes.data;
                
                setMeters(fetchedMeters);
                if (fetchedMeters.length > 0 && !selectedMeterId) {
                    setSelectedMeterId(fetchedMeters[0].id);
                }
                
                setReadings(fetchedReadings);
                let total = fetchedReadings.length;
                let verified = 0;
                let pending = 0;

                fetchedReadings.forEach(r => {
                    if (r.status === 'VERIFIED') verified++;
                    if (r.status === 'PENDING' || r.status === 'MANUAL_REVIEW') pending++;
                });

                setStats({ total, verified, pending });
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Cleanup camera on unmount ────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    // ─── Shared Upload Pipeline ───────────────────────────────────────────
    const uploadReadingFile = useCallback(async (file) => {
        if (meters.length === 0) {
            alert("No meters found for your account.");
            return;
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('meter_id', selectedMeterId || meters[0].id);

        setIsUploading(true);
        setUploadStatus('processing');
        setUploadMessage('Uploading image...');
        
        try {
            const config = {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            };

            const res = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/readings/upload`,
                formData,
                config
            );

            const readingId = res.data.reading_id;
            if (readingId) {
                setUploadMessage('AI is extracting reading...');
                pollStatus(readingId);
            } else {
                setUploadStatus('success');
                setUploadMessage(res.data.message || 'Added successfully');
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (error) {
            console.error("Upload failed:", error);
            setUploadStatus('error');
            setUploadMessage(error.response?.data?.error || "Upload failed. Please try again.");
            setIsUploading(false);
        }
    }, [meters, selectedMeterId]);

    const handleImageSelect = () => {
        fileInputRef.current.click();
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await uploadReadingFile(file);
    };

    const pollStatus = (readingId) => {
        let pollCount = 0;
        const maxPolls = 30; // ~90 seconds max
        const intervalId = setInterval(async () => {
            pollCount++;
            try {
                const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/metering/readings/${readingId}/status`);
                const { status, message } = res.data;
                
                if (status === 'VERIFIED' || status === 'MANUAL_REVIEW') {
                    clearInterval(intervalId);
                    setUploadStatus('success');
                    setUploadMessage(message || `Processing complete. Status: ${status}`);
                    setIsUploading(false);
                    setTimeout(() => window.location.reload(), 2000);
                } else if (status === 'FAILED') {
                    clearInterval(intervalId);
                    setUploadStatus('error');
                    setUploadMessage(message || 'OCR Processing failed');
                    setIsUploading(false);
                } else if (pollCount >= maxPolls) {
                    clearInterval(intervalId);
                    setUploadStatus('success');
                    setUploadMessage('Processing is taking longer than expected. Your reading has been submitted and will be processed shortly.');
                    setIsUploading(false);
                    setTimeout(() => window.location.reload(), 3000);
                }
            } catch (err) {
                console.error("Polling error", err);
                if (pollCount >= maxPolls) {
                    clearInterval(intervalId);
                    setUploadStatus('error');
                    setUploadMessage('Could not confirm processing status. Please refresh the page.');
                    setIsUploading(false);
                }
            }
        }, 3000);
    };

    // ─── Camera Functions ─────────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, [cameraStream]);

    const startCamera = useCallback(async () => {
        setCameraError('');
        setIsCameraLoading(true);

        // Stop any existing stream first
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access error:", err);
            if (err.name === 'NotAllowedError') {
                setCameraError('Camera access was denied. Please allow camera permissions in your browser settings and try again.');
            } else if (err.name === 'NotFoundError') {
                setCameraError('No camera found on this device. Please use the file upload option instead.');
            } else {
                setCameraError(`Could not access camera: ${err.message}. Try the file upload option.`);
            }
        } finally {
            setIsCameraLoading(false);
        }
    }, [cameraStream]);

    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Use the actual video resolution for maximum quality
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Stop camera immediately after capture
        stopCamera();

        // Convert canvas to a high-quality JPEG blob
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setUploadStatus('error');
                setUploadMessage('Failed to capture image. Please try again.');
                return;
            }
            const file = new File([blob], `meter_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            await uploadReadingFile(file);
        }, 'image/jpeg', 0.95);
    }, [stopCamera, uploadReadingFile]);

    // ─── Toggle Input Method ──────────────────────────────────────────────
    const switchToUpload = useCallback(() => {
        stopCamera();
        setInputMethod('upload');
        setCameraError('');
    }, [stopCamera]);

    const switchToCamera = useCallback(() => {
        setInputMethod('camera');
        setUploadStatus(null);
        setUploadMessage('');
        // Camera will start after the video element mounts
    }, []);

    // Start camera when switching to camera mode and video is available
    useEffect(() => {
        if (inputMethod === 'camera' && !cameraStream && !isCameraLoading && !isUploading) {
            startCamera();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputMethod]);

    // Filter readings by selected meter
    const filteredReadings = readings.filter(r => r.meter_number === meters.find(m => m.id === selectedMeterId)?.meter_number || r.meter === selectedMeterId);

    // ─── Inline Styles ────────────────────────────────────────────────────
    const tabGroupStyle = {
        display: 'flex',
        background: 'var(--bg-tertiary)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px',
        marginBottom: '1.25rem',
    };
    const tabStyle = (active) => ({
        flex: 1,
        padding: '0.6rem 1.25rem',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        boxShadow: active ? '0 2px 8px rgba(0,180,216,0.3)' : 'none',
    });

    const cameraViewportStyle = {
        position: 'relative',
        width: '100%',
        maxWidth: '640px',
        margin: '0 auto',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '16/9',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '2px solid var(--border-default)',
    };

    const scannerOverlayStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '70%',
        height: '40%',
        border: '2px dashed rgba(0, 180, 216, 0.8)',
        borderRadius: '12px',
        boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(0, 180, 216, 0.15)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0.5rem',
    };

    const scannerLabelStyle = {
        color: 'rgba(0, 180, 216, 0.9)',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        background: 'rgba(0,0,0,0.5)',
        padding: '3px 10px',
        borderRadius: '6px',
    };

    const captureButtonStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.75rem 2rem',
        background: 'linear-gradient(135deg, #00b4d8, #0096c7)',
        border: 'none',
        borderRadius: '12px',
        color: '#fff',
        fontWeight: 700,
        fontSize: '1rem',
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 15px rgba(0, 180, 216, 0.4)',
        margin: '1rem auto 0',
    };

    const cameraLoadingStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '280px',
        color: 'var(--text-secondary)',
        gap: '1rem',
    };

    const cameraErrorStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '280px',
        color: 'var(--color-danger)',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
    };

    const cornerStyle = (position) => {
        const base = {
            position: 'absolute',
            width: '20px',
            height: '20px',
            borderColor: 'rgba(0, 180, 216, 0.9)',
            borderStyle: 'solid',
            borderWidth: '0',
            pointerEvents: 'none',
        };
        switch (position) {
            case 'tl': return { ...base, top: '0', left: '0', borderTopWidth: '3px', borderLeftWidth: '3px', borderTopLeftRadius: '12px' };
            case 'tr': return { ...base, top: '0', right: '0', borderTopWidth: '3px', borderRightWidth: '3px', borderTopRightRadius: '12px' };
            case 'bl': return { ...base, bottom: '0', left: '0', borderBottomWidth: '3px', borderLeftWidth: '3px', borderBottomLeftRadius: '12px' };
            case 'br': return { ...base, bottom: '0', right: '0', borderBottomWidth: '3px', borderRightWidth: '3px', borderBottomRightRadius: '12px' };
            default: return base;
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 className="content-title">Meter Readings</h1>
                        <p className="content-subtitle">Upload meter photos or capture live and track AI-processed readings</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {meters.length > 1 && (
                            <select 
                                className="form-input" 
                                style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 1rem' }}
                                value={selectedMeterId}
                                onChange={(e) => setSelectedMeterId(e.target.value)}
                            >
                                {meters.map(m => (
                                    <option key={m.id} value={m.id}>Meter: {m.meter_number}</option>
                                ))}
                            </select>
                        )}
                        <button className="btn btn-primary btn-sm" onClick={inputMethod === 'upload' ? handleImageSelect : capturePhoto} disabled={isUploading || (inputMethod === 'camera' && !cameraStream)}>
                            {inputMethod === 'upload' ? '📸 Upload Reading' : '📸 Capture & Submit'}
                        </button>
                    </div>
                </div>

                <div className="content-body">
                    {/* Submit New Reading Panel */}
                    <div className="panel" style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className="panel-header">
                            <h3 className="panel-title">Submit New Reading</h3>
                        </div>
                        <div className="panel-body">
                            {/* Input Method Toggle Tabs */}
                            <div style={tabGroupStyle}>
                                <button
                                    id="tab-upload"
                                    style={tabStyle(inputMethod === 'upload')}
                                    onClick={switchToUpload}
                                    disabled={isUploading}
                                >
                                    📂 Upload File
                                </button>
                                <button
                                    id="tab-camera"
                                    style={tabStyle(inputMethod === 'camera')}
                                    onClick={switchToCamera}
                                    disabled={isUploading}
                                >
                                    📷 Live Camera
                                </button>
                            </div>

                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                accept="image/*"
                            />
                            {/* Hidden canvas for frame capture */}
                            <canvas ref={canvasRef} style={{ display: 'none' }} />

                            {/* ═══════════════ UPLOAD MODE ═══════════════ */}
                            {inputMethod === 'upload' && (
                                <div
                                    className={`upload-zone ${isUploading ? 'uploading' : ''}`}
                                    onClick={handleImageSelect}
                                    style={{ cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}
                                >
                                    <div className="upload-icon">
                                        {uploadStatus === 'processing' ? <span className="spinner">⏳</span> : 
                                         uploadStatus === 'success' ? '✅' : 
                                         uploadStatus === 'error' ? '❌' : '📷'}
                                    </div>
                                    <div className="upload-text">
                                        {uploadMessage || 'Click to upload a meter photo'}
                                    </div>
                                    {!isUploading && !uploadStatus && (
                                        <div className="upload-hint">Supports JPG, PNG — max 10MB. Our AI will extract the reading automatically.</div>
                                    )}
                                </div>
                            )}

                            {/* ═══════════════ CAMERA MODE ═══════════════ */}
                            {inputMethod === 'camera' && (
                                <div>
                                    {/* Camera Viewport */}
                                    <div style={cameraViewportStyle}>
                                        {isCameraLoading && (
                                            <div style={cameraLoadingStyle}>
                                                <div style={{ fontSize: '2.5rem', animation: 'pulse 1.5s ease-in-out infinite' }}>📷</div>
                                                <div style={{ fontWeight: 500 }}>Initializing camera...</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Please allow camera access when prompted</div>
                                            </div>
                                        )}

                                        {cameraError && (
                                            <div style={cameraErrorStyle}>
                                                <div style={{ fontSize: '2.5rem' }}>🚫</div>
                                                <div style={{ fontWeight: 600 }}>{cameraError}</div>
                                                <button
                                                    onClick={startCamera}
                                                    className="btn btn-primary btn-sm"
                                                    style={{ marginTop: '0.5rem' }}
                                                >
                                                    🔄 Retry
                                                </button>
                                            </div>
                                        )}

                                        {/* Video stream */}
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                display: (cameraStream && !isCameraLoading && !cameraError) ? 'block' : 'none',
                                            }}
                                        />

                                        {/* Scanner overlay — only show when stream is live */}
                                        {cameraStream && !isCameraLoading && !cameraError && (
                                            <>
                                                <div style={scannerOverlayStyle}>
                                                    <div style={cornerStyle('tl')} />
                                                    <div style={cornerStyle('tr')} />
                                                    <div style={cornerStyle('bl')} />
                                                    <div style={cornerStyle('br')} />
                                                    <span style={scannerLabelStyle}>Align meter digits here</span>
                                                </div>

                                                {/* Subtle scanning line animation */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '30%',
                                                    left: '15%',
                                                    width: '70%',
                                                    height: '2px',
                                                    background: 'linear-gradient(90deg, transparent, rgba(0, 180, 216, 0.6), transparent)',
                                                    animation: 'scanLine 2.5s ease-in-out infinite',
                                                    pointerEvents: 'none',
                                                }} />
                                            </>
                                        )}

                                        {/* Processing overlay */}
                                        {isUploading && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(0,0,0,0.7)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '1rem',
                                                color: '#fff',
                                                zIndex: 5,
                                            }}>
                                                <div style={{ fontSize: '2.5rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
                                                    {uploadStatus === 'success' ? '✅' : uploadStatus === 'error' ? '❌' : '🔄'}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{uploadMessage}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Capture Button */}
                                    {cameraStream && !isUploading && (
                                        <div style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={capturePhoto}
                                                style={captureButtonStyle}
                                                onMouseEnter={(e) => { e.target.style.transform = 'scale(1.04)'; e.target.style.boxShadow = '0 6px 20px rgba(0, 180, 216, 0.5)'; }}
                                                onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 4px 15px rgba(0, 180, 216, 0.4)'; }}
                                            >
                                                📸 Capture & Submit
                                            </button>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                Position your meter clearly in the frame, then tap capture
                                            </div>
                                        </div>
                                    )}

                                    {/* Restart camera after a capture/error */}
                                    {!cameraStream && !isCameraLoading && !cameraError && !isUploading && (
                                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                            <button onClick={startCamera} className="btn btn-primary btn-sm">
                                                🔄 Restart Camera
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="stat-card blue">
                            <div className="stat-icon blue">📋</div>
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">Total Readings</div>
                        </div>
                        <div className="stat-card teal">
                            <div className="stat-icon teal">✅</div>
                            <div className="stat-value">{stats.verified}</div>
                            <div className="stat-label">AI Verified</div>
                        </div>
                        <div className="stat-card amber">
                            <div className="stat-icon amber">👁️</div>
                            <div className="stat-value">{stats.pending}</div>
                            <div className="stat-label">Pending Review</div>
                        </div>
                    </div>

                    {/* Readings Table */}
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Reading History</h3>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Reading ID</th>
                                    <th>Date</th>
                                    <th>Meter</th>
                                    <th>Value</th>
                                    <th>AI Confidence</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReadings.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
                                            No meter readings found for this meter. Upload a photo to get started!
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReadings.map((r) => {
                                        const readingDate = new Date(r.submitted_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        const confidenceVal = r.ocr_confidence ? Math.round(r.ocr_confidence * 100) : 0;
                                        const confidencePercent = r.ocr_confidence ? `${confidenceVal}%` : 'N/A';
                                        const isVerified = r.status === 'VERIFIED';

                                        // Title-case status for badge
                                        const displayStatus = r.status.charAt(0) + r.status.slice(1).toLowerCase();

                                        return (
                                            <tr key={r.id}>
                                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: 'var(--text-primary)' }}>{r.id.split('-')[0]}...</td>
                                                <td>{readingDate}</td>
                                                <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.meter_number}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.reading_value} m³</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, height: 4, background: 'var(--border-default)', borderRadius: 99, maxWidth: 80 }}>
                                                            <div style={{
                                                                height: '100%',
                                                                width: r.ocr_confidence ? confidencePercent : '0%',
                                                                background: confidenceVal >= 90 ? 'var(--accent-400)' : '#fbbf24',
                                                                borderRadius: 99
                                                            }}></div>
                                                        </div>
                                                        <span>{confidencePercent}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${isVerified ? 'badge-success' : 'badge-warning'}`}>
                                                        {isVerified ? '✓ ' : '⏳ '}{displayStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Scan line animation keyframes */}
            <style>{`
                @keyframes scanLine {
                    0% { top: 30%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 68%; opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default MeterReadings;
