import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LandingPage, { FeaturesPage, HowItWorksPage, WhyUsPage, AboutUsPage } from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MeterReadings from './pages/MeterReadings';
import Bills from './pages/Bills';
import AdminDashboard from './pages/AdminDashboard';
import ClerkDashboard from './pages/ClerkDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import AdminLeakageReports from './pages/AdminLeakageReports';
import ReportLeakage from './pages/ReportLeakage';
import PaymentSuccess from './pages/PaymentSuccess';
import PrivateRoute from './components/PrivateRoute';
import SupportWidget from './components/SupportWidget';
import DemoOCR from './pages/DemoOCR';

// Shows landing page if not logged in, redirects to dashboard if logged in
const HomeRedirect = () => {
    const tokens = useSelector((state) => state.auth.tokens);
    const user = useSelector((state) => state.auth.user);
    if (!tokens) return <LandingPage />;
    // Redirect based on role
    if (user?.is_staff || user?.role === 'Admin' || user?.role === 'ADMIN') return <Navigate to="/admin" />;
    if (user?.role === 'Clerk' || user?.role === 'CLERK') return <Navigate to="/clerk" />;
    if (user?.role === 'Technician' || user?.role === 'TECHNICIAN') return <Navigate to="/technician" />;
    return <Navigate to="/dashboard" />;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:uidb64/:token" element={<ResetPassword />} />
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/why-us" element={<WhyUsPage />} />
                <Route path="/about" element={<AboutUsPage />} />
                <Route path="/demo-ocr" element={<DemoOCR />} />
                <Route path="/dashboard" element={
                    <PrivateRoute>
                        <Dashboard />
                    </PrivateRoute>
                } />
                <Route path="/readings" element={
                    <PrivateRoute>
                        <MeterReadings />
                    </PrivateRoute>
                } />
                <Route path="/bills" element={
                    <PrivateRoute>
                        <Bills />
                    </PrivateRoute>
                } />
                <Route path="/payment/callback" element={
                    <PrivateRoute>
                        <PaymentSuccess />
                    </PrivateRoute>
                } />
                <Route path="/clerk" element={
                    <PrivateRoute>
                        <ClerkDashboard />
                    </PrivateRoute>
                } />
                <Route path="/admin" element={
                    <PrivateRoute>
                        <AdminDashboard section="dashboard" />
                    </PrivateRoute>
                } />
                <Route path="/admin/revenue" element={
                    <PrivateRoute>
                        <AdminDashboard section="revenue" />
                    </PrivateRoute>
                } />
                <Route path="/admin/disputes" element={
                    <PrivateRoute>
                        <AdminDashboard section="disputes" />
                    </PrivateRoute>
                } />
                <Route path="/admin/readings" element={
                    <PrivateRoute>
                        <AdminDashboard section="readings" />
                    </PrivateRoute>
                } />
                <Route path="/admin/maintenance" element={
                    <PrivateRoute>
                        <AdminDashboard section="maintenance" />
                    </PrivateRoute>
                } />
                <Route path="/admin/roles" element={
                    <PrivateRoute>
                        <AdminDashboard section="roles" />
                    </PrivateRoute>
                } />
                <Route path="/admin/system" element={
                    <PrivateRoute>
                        <AdminDashboard section="system" />
                    </PrivateRoute>
                } />
                <Route path="/technician" element={
                    <PrivateRoute>
                        <TechnicianDashboard />
                    </PrivateRoute>
                } />
                <Route path="/admin/leakage-reports" element={
                    <PrivateRoute>
                        <AdminLeakageReports />
                    </PrivateRoute>
                } />
                <Route path="/report-leakage" element={
                    <PrivateRoute>
                        <ReportLeakage />
                    </PrivateRoute>
                } />
            </Routes>
            <SupportWidget />
        </Router>
    );
}

export default App;

