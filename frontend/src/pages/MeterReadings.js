import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
    const fileInputRef = React.useRef(null);

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
    }, []);

    const handleImageSelect = () => {
        fileInputRef.current.click();
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

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
    };

    const pollStatus = (readingId) => {
        const intervalId = setInterval(async () => {
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
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 3000);
    };

    // Filter readings by selected meter
    const filteredReadings = readings.filter(r => r.meter_number === meters.find(m => m.id === selectedMeterId)?.meter_number || r.meter === selectedMeterId);

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 className="content-title">Meter Readings</h1>
                        <p className="content-subtitle">Upload meter photos and track AI-processed readings</p>
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
                        <button className="btn btn-primary btn-sm" onClick={handleImageSelect} disabled={isUploading}>
                            📸 Upload Reading
                        </button>
                    </div>
                </div>

                <div className="content-body">
                    {/* Upload Zone */}
                    <div className="panel" style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className="panel-header">
                            <h3 className="panel-title">Submit New Reading</h3>
                        </div>
                        <div className="panel-body">
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                accept="image/*"
                            />
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
        </div>
    );
};

export default MeterReadings;
