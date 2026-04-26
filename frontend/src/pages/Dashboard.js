import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const Dashboard = () => {
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const [dashboardData, setDashboardData] = useState({
        balance: "0.00",
        last_reading: "0",
        monthly_usage: "0",
        days_to_due: 0,
        usage_history: [],
        alerts: []
    });
    const [prediction, setPrediction] = useState(null);

    useEffect(() => {
        if (user && (user.is_staff || user.role === 'Admin' || user.role === 'ADMIN')) {
            navigate('/admin');
            return;
        }
        if (user && (user.role === 'Clerk' || user.role === 'CLERK')) {
            navigate('/clerk');
            return;
        }
        if (user && (user.role === 'Technician' || user.role === 'TECHNICIAN')) {
            navigate('/technician');
            return;
        }

        const fetchStats = async () => {
            try {
                const tokenObj = JSON.parse(localStorage.getItem('tokens'));
                const config = { headers: { Authorization: `Bearer ${tokenObj?.access}` } };

                const [statsRes, predictRes] = await Promise.all([
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/billing/customer-stats`, config),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/billing/prediction`, config).catch(() => ({ data: null }))
                ]);

                setDashboardData(statsRes.data);
                if (predictRes.data && !predictRes.data.message) {
                    setPrediction(predictRes.data);
                }
            } catch (err) {
                console.error('Failed to fetch dashboard stats', err);
            }
        };

        if (user) {
            fetchStats();
        }
    }, [user, navigate]);

    const stats = [
        { label: 'Current Balance', value: dashboardData.balance, currency: 'ETB', icon: '💰', color: 'blue' },
        { label: 'Last Reading', value: dashboardData.last_reading, unit: 'm³', icon: '🔍', color: 'teal' },
        { label: 'Monthly Usage', value: dashboardData.monthly_usage, unit: 'm³', icon: '📊', color: 'amber' },
        { label: 'Days to Due', value: dashboardData.days_to_due, unit: 'Days', icon: '📅', color: 'rose' },
    ];

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="content-header">
                    <div>
                        <h1 className="content-title">Welcome back, {user?.first_name || 'User'}!</h1>
                        <p className="content-subtitle">Here is a quick overview of your water consumption and billing status.</p>
                    </div>
                </div>

                <div className="content-body">
                    {/* Alerts Section */}
                    {dashboardData.alerts && dashboardData.alerts.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            {dashboardData.alerts.map(alert => (
                                <div key={alert.id} className={`alert alert-${alert.alert_type === 'LEAK' ? 'danger' : 'warning'}`} style={{
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    border: '1px solid currentColor',
                                    background: alert.alert_type === 'LEAK' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    color: alert.alert_type === 'LEAK' ? '#ef4444' : '#f59e0b',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ fontSize: '1.5rem' }}>{alert.alert_type === 'LEAK' ? '🚨' : '⚠️'}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                            {alert.alert_type === 'LEAK' ? 'Potential Water Leak Detected' : 'Unusual Usage Spike'}
                                        </div>
                                        <div style={{ opacity: 0.9 }}>{alert.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        {stats.map((stat, idx) => (
                            <div key={idx} className={`stat-card ${stat.color}`}>
                                <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
                                <div className="stat-value">
                                    {stat.currency && <span className="currency" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.currency} </span>}
                                    {stat.value}
                                    {stat.unit && <span className="unit" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}> {stat.unit}</span>}
                                </div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* AI Prediction Section */}
                    {prediction && (
                        <div className="panel" style={{
                            marginBottom: '2rem',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(52, 120, 255, 0.05))',
                            border: '1px solid rgba(139, 92, 246, 0.2)'
                        }}>
                            <div className="panel-header" style={{ borderBottomColor: 'rgba(139, 92, 246, 0.1)' }}>
                                <h3 className="panel-title" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>🪄</span> Smart AI Forecast
                                </h3>
                                <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
                                    AI Confidence: {prediction.confidence}%
                                </span>
                            </div>
                            <div className="panel-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Predicted for {prediction.next_month}
                                        </div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                            {prediction.predicted_consumption} <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)' }}>m³</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Estimated Next Bill
                                        </div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#2dd4bf', lineHeight: 1 }}>
                                            <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)' }}>ETB</span> {prediction.estimated_cost}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '12px',
                                            background: prediction.trend === 'UP' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.5rem'
                                        }}>
                                            {prediction.trend === 'UP' ? '📈' : prediction.trend === 'DOWN' ? '📉' : '↔️'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {prediction.trend === 'UP' ? 'Rising Trend' : prediction.trend === 'DOWN' ? 'Usage Dropping' : 'Stable Usage'}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Based on last 6 months</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chart Panel */}
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Consumption History (m³)</h3>
                        </div>
                        <div className="panel-body" style={{ height: '350px', paddingTop: 'var(--space-xl)' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dashboardData.usage_history}>
                                    <defs>
                                        <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--primary-500)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--primary-500)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)'
                                        }}
                                        itemStyle={{ color: 'var(--primary-400)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="usage"
                                        stroke="var(--primary-500)"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorUsage)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
