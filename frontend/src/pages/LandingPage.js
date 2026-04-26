import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

// Shared nav + footer layout for all landing pages
const LandingLayout = ({ children }) => {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <div className="landing-page">
            {/* Background effects */}
            <div className="landing-bg">
                <div className="landing-orb landing-orb-1"></div>
                <div className="landing-orb landing-orb-2"></div>
                <div className="landing-orb landing-orb-3"></div>
            </div>

            {/* ═══ NAVBAR ═══ */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <Link to="/" className="landing-logo" style={{ textDecoration: 'none' }}>
                        <div className="landing-logo-icon">💧</div>
                        <span className="landing-logo-text">AquaBill AI</span>
                    </Link>
                    <div className="landing-nav-links">
                        <Link to="/features" style={{ color: isActive('/features') ? 'var(--primary-400)' : undefined }}>Features</Link>
                        <Link to="/how-it-works" style={{ color: isActive('/how-it-works') ? 'var(--primary-400)' : undefined }}>How It Works</Link>
                        <Link to="/why-us" style={{ color: isActive('/why-us') ? 'var(--primary-400)' : undefined }}>Why Us</Link>
                        <Link to="/about" style={{ color: isActive('/about') ? 'var(--primary-400)' : undefined }}>About Us</Link>
                    </div>
                    <div className="landing-nav-actions">
                        <ThemeToggle style={{ position: 'relative', top: 'auto', right: 'auto', zIndex: 1, boxShadow: 'none' }} />
                        <Link to="/login" className="landing-btn-ghost">Login</Link>
                        <Link to="/register" className="landing-btn-primary">Sign Up Free</Link>
                    </div>
                </div>
            </nav>

            {children}

            {/* ═══ CTA SECTION ═══ */}
            <section className="landing-section landing-visible" style={{ paddingBottom: '2rem' }}>
                <div className="landing-cta">
                    <div className="landing-cta-bg"></div>
                    <h2 className="landing-cta-title">Ready to Transform Your Water Billing?</h2>
                    <p className="landing-cta-subtitle">
                        Join thousands of utilities already using AI to streamline their operations.
                        Get started in minutes — no credit card required.
                    </p>
                    <div className="landing-cta-actions">
                        <Link to="/register" className="landing-btn-white landing-btn-lg">
                            Sign Up Free →
                        </Link>
                        <Link to="/login" className="landing-btn-ghost-white landing-btn-lg">
                            Login to Dashboard
                        </Link>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <div className="landing-footer-brand">
                        <Link to="/" className="landing-logo" style={{ textDecoration: 'none' }}>
                            <div className="landing-logo-icon">💧</div>
                            <span className="landing-logo-text">AquaBill AI</span>
                        </Link>
                        <p className="landing-footer-tagline">
                            AI-powered water billing for the modern utility.
                        </p>
                    </div>
                    <div className="landing-footer-links">
                        <div className="landing-footer-col">
                            <h4>Product</h4>
                            <Link to="/features">Features</Link>
                            <Link to="/how-it-works">How It Works</Link>
                            <Link to="/why-us">Why Us</Link>
                        </div>
                        <div className="landing-footer-col">
                            <h4>Company</h4>
                            <Link to="/about">About Us</Link>
                            <a href="mailto:support@aquabillai.com">Contact</a>
                        </div>
                        <div className="landing-footer-col">
                            <h4>Account</h4>
                            <Link to="/login">Login</Link>
                            <Link to="/register">Sign Up</Link>
                        </div>
                    </div>
                </div>
                <div className="landing-footer-bottom">
                    <span>© 2026 AquaBill AI. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// HOME PAGE (Hero only)
// ═══════════════════════════════════════════════════════════════════
const LandingPage = () => {
    return (
        <LandingLayout>
            <section className="landing-hero">
                <div className="landing-hero-content">
                    <div className="landing-hero-badge">🚀 AI-Powered Water Management</div>
                    <h1 className="landing-hero-title">
                        Smart Water Billing,{' '}
                        <span className="landing-gradient-text">Powered by AI</span>
                    </h1>
                    <p className="landing-hero-subtitle">
                        Automate meter readings with AI-powered OCR. Generate bills instantly.
                        Track usage in real-time. Transform your water utility operations.
                    </p>
                    <div className="landing-hero-actions">
                        <Link to="/register" className="landing-btn-primary landing-btn-lg">
                            Get Started Free →
                        </Link>
                        <Link to="/features" className="landing-btn-ghost landing-btn-lg">
                            Learn More
                        </Link>
                    </div>
                    <div className="landing-hero-trust">
                        <div className="landing-trust-avatars">
                            {['🧑‍💼', '👩‍💻', '👨‍🔧', '👩‍🔬'].map((emoji, i) => (
                                <div key={i} className="landing-trust-avatar" style={{ animationDelay: `${i * 0.1}s` }}>
                                    {emoji}
                                </div>
                            ))}
                        </div>
                        <span className="landing-trust-text">Trusted by water utilities across the nation</span>
                    </div>
                </div>
                <div className="landing-hero-visual">
                    <div className="landing-droplet">
                        <div className="landing-droplet-inner">
                            <div className="landing-droplet-icon">💧</div>
                            <div className="landing-droplet-ring landing-droplet-ring-1"></div>
                            <div className="landing-droplet-ring landing-droplet-ring-2"></div>
                            <div className="landing-droplet-ring landing-droplet-ring-3"></div>
                        </div>
                        <div className="landing-droplet-particles">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="landing-particle" style={{
                                    '--angle': `${i * 45}deg`,
                                    '--delay': `${i * 0.3}s`,
                                    '--distance': `${80 + Math.random() * 40}px`
                                }}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick preview cards linking to sub-pages */}
            <section className="landing-section landing-visible">
                <div className="landing-section-header">
                    <span className="landing-section-badge">Explore</span>
                    <h2 className="landing-section-title">Discover What We Offer</h2>
                </div>
                <div className="landing-steps">
                    {[
                        { icon: '✨', title: 'Features', desc: 'AI meter reading, automated billing, real-time analytics, and more.', path: '/features' },
                        { icon: '⚙️', title: 'How It Works', desc: 'From meter photo to generated bill in under a minute.', path: '/how-it-works' },
                        { icon: '🏆', title: 'Why Us', desc: '10,000+ customers, 99.5% accuracy, 24/7 uptime.', path: '/why-us' },
                    ].map((card, i) => (
                        <Link key={i} to={card.path} className="landing-step" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                            <div className="landing-step-icon">{card.icon}</div>
                            <h3 className="landing-step-title">{card.title}</h3>
                            <p className="landing-step-desc">{card.desc}</p>
                            <div style={{ marginTop: '1rem', color: 'var(--primary-400)', fontWeight: 600, fontSize: '0.9rem' }}>
                                Learn more →
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </LandingLayout>
    );
};

// ═══════════════════════════════════════════════════════════════════
// FEATURES PAGE
// ═══════════════════════════════════════════════════════════════════
const FeaturesPage = () => {
    return (
        <LandingLayout>
            <section className="landing-section landing-visible" style={{ paddingTop: '8rem' }}>
                <div className="landing-section-header">
                    <span className="landing-section-badge">Features</span>
                    <h2 className="landing-section-title">Everything You Need to Manage Water Billing</h2>
                    <p className="landing-section-subtitle">
                        Powerful tools that simplify every step of the water billing process
                    </p>
                </div>
                <div className="landing-features-grid">
                    {[
                        {
                            icon: '📸', title: 'AI Meter Reading',
                            desc: 'Upload a photo of any water meter — our AI extracts the reading in seconds with 99%+ accuracy. No manual entry needed.',
                            color: '#3478ff'
                        },
                        {
                            icon: '📄', title: 'Automated Billing',
                            desc: 'Bills are generated instantly from verified readings. Automatic consumption calculations, tiered pricing, and PDF generation.',
                            color: '#14b8a6'
                        },
                        {
                            icon: '📊', title: 'Real-Time Analytics',
                            desc: 'Track consumption trends, detect potential leaks, and predict future usage with AI-powered analytics dashboards.',
                            color: '#f59e0b'
                        },
                        {
                            icon: '💳', title: 'Online Payments',
                            desc: 'Customers can pay bills online via Chapa integration. Automatic payment reconciliation and receipt generation.',
                            color: '#8b5cf6'
                        },
                        {
                            icon: '⚖️', title: 'Dispute Management',
                            desc: 'Built-in dispute resolution system. Customers can flag incorrect bills, and admins can review and resolve efficiently.',
                            color: '#ef4444'
                        },
                        {
                            icon: '🔧', title: 'Field Maintenance',
                            desc: 'Dispatch technicians for meter inspections, track field tasks, and manage maintenance workflows all in one place.',
                            color: '#10b981'
                        },
                        {
                            icon: '👥', title: 'Role Management',
                            desc: 'Dedicated dashboards for Admins, Clerks, and Technicians. Each role sees only what they need.',
                            color: '#6366f1'
                        },
                        {
                            icon: '🔔', title: 'Smart Notifications',
                            desc: 'Automatic alerts for unpaid bills, usage spikes, possible leaks, and pending reviews. Stay informed in real-time.',
                            color: '#ec4899'
                        },
                        {
                            icon: '📱', title: 'Mobile Responsive',
                            desc: 'Fully responsive design works beautifully on desktops, tablets, and smartphones. Manage billing on the go.',
                            color: '#0ea5e9'
                        },
                    ].map((feature, i) => (
                        <div key={i} className="landing-feature-card" style={{ '--accent': feature.color }}>
                            <div className="landing-feature-icon">{feature.icon}</div>
                            <h3 className="landing-feature-title">{feature.title}</h3>
                            <p className="landing-feature-desc">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </LandingLayout>
    );
};

// ═══════════════════════════════════════════════════════════════════
// HOW IT WORKS PAGE
// ═══════════════════════════════════════════════════════════════════
const HowItWorksPage = () => {
    return (
        <LandingLayout>
            <section className="landing-section landing-visible" style={{ paddingTop: '8rem' }}>
                <div className="landing-section-header">
                    <span className="landing-section-badge">How It Works</span>
                    <h2 className="landing-section-title">From Meter Photo to Bill in Minutes</h2>
                    <p className="landing-section-subtitle">
                        Our streamlined process eliminates manual data entry and reduces errors
                    </p>
                </div>
                <div className="landing-steps">
                    {[
                        { num: '01', title: 'Upload Meter Photo', desc: 'Snap a photo of the water meter using any smartphone. Our system accepts JPG, PNG, and other common formats. No special equipment needed.', icon: '📷' },
                        { num: '02', title: 'AI Extracts Reading', desc: 'Our advanced OCR engine powered by AI analyzes the image, extracts the meter value, and validates it against historical data for accuracy.', icon: '🤖' },
                        { num: '03', title: 'Auto-Generate Bill', desc: 'A bill is automatically calculated based on consumption tiers, applied to the customer account, and a PDF is generated for download.', icon: '✅' },
                    ].map((step, i) => (
                        <div key={i} className="landing-step">
                            <div className="landing-step-num">{step.num}</div>
                            <div className="landing-step-icon">{step.icon}</div>
                            <h3 className="landing-step-title">{step.title}</h3>
                            <p className="landing-step-desc">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Additional detail section */}
            <section className="landing-section landing-visible">
                <div className="landing-section-header">
                    <span className="landing-section-badge">Behind the Scenes</span>
                    <h2 className="landing-section-title">What Happens at Each Stage</h2>
                </div>
                <div className="landing-features-grid">
                    {[
                        { icon: '🔍', title: 'Quality Check', desc: 'Images are checked for resolution and clarity before processing. Low-quality images are flagged for re-upload.', color: '#3478ff' },
                        { icon: '🧠', title: 'AI Confidence Score', desc: 'Each reading gets a confidence score. High-confidence readings are auto-verified; low ones go to manual review.', color: '#14b8a6' },
                        { icon: '👨‍💼', title: 'Clerk Review', desc: 'Readings needing manual review are batch-assigned to clerks who verify values and approve them.', color: '#f59e0b' },
                        { icon: '📊', title: 'Consumption Calculation', desc: 'The system computes consumption by comparing current and previous readings, applying tiered pricing automatically.', color: '#8b5cf6' },
                        { icon: '📧', title: 'Customer Notification', desc: 'Customers receive alerts about new bills, usage spikes, and possible leaks via the in-app notification system.', color: '#ef4444' },
                        { icon: '💳', title: 'Payment Processing', desc: 'Customers pay online via Chapa. Payments are reconciled automatically and receipts are generated.', color: '#10b981' },
                    ].map((item, i) => (
                        <div key={i} className="landing-feature-card" style={{ '--accent': item.color }}>
                            <div className="landing-feature-icon">{item.icon}</div>
                            <h3 className="landing-feature-title">{item.title}</h3>
                            <p className="landing-feature-desc">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </LandingLayout>
    );
};

// ═══════════════════════════════════════════════════════════════════
// WHY US PAGE
// ═══════════════════════════════════════════════════════════════════
const CountUp = ({ end, duration = 2000, suffix = '' }) => {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setStarted(true); },
            { threshold: 0.5 }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!started) return;
        let start = 0;
        const step = Math.ceil(end / (duration / 16));
        const timer = setInterval(() => {
            start += step;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 16);
        return () => clearInterval(timer);
    }, [started, end, duration]);

    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const WhyUsPage = () => {
    return (
        <LandingLayout>
            <section className="landing-section landing-visible" style={{ paddingTop: '8rem' }}>
                <div className="landing-section-header">
                    <span className="landing-section-badge">Why Us</span>
                    <h2 className="landing-section-title">Numbers That Speak for Themselves</h2>
                    <p className="landing-section-subtitle">
                        We deliver results that matter to water utilities of every size
                    </p>
                </div>
                <div className="landing-stats-grid">
                    {[
                        { value: 10000, suffix: '+', label: 'Customers Served', icon: '👥' },
                        { value: 99, suffix: '.5%', label: 'AI Accuracy Rate', icon: '🎯' },
                        { value: 50, suffix: '%', label: 'Faster Billing', icon: '⚡' },
                        { value: 24, suffix: '/7', label: 'System Uptime', icon: '🛡️' },
                    ].map((stat, i) => (
                        <div key={i} className="landing-stat">
                            <div className="landing-stat-icon">{stat.icon}</div>
                            <div className="landing-stat-value">
                                <CountUp end={stat.value} />{stat.suffix}
                            </div>
                            <div className="landing-stat-label">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section landing-visible">
                <div className="landing-section-header">
                    <span className="landing-section-badge">Advantages</span>
                    <h2 className="landing-section-title">Why Utilities Choose AquaBill AI</h2>
                </div>
                <div className="landing-features-grid">
                    {[
                        { icon: '🚀', title: 'Lightning Fast', desc: 'Process thousands of meter readings in minutes, not days. Our AI works 24/7 so your team can focus on what matters.', color: '#3478ff' },
                        { icon: '🎯', title: 'Incredibly Accurate', desc: '99.5% accuracy rate on meter reading extraction. Low-confidence reads are automatically flagged for human review.', color: '#14b8a6' },
                        { icon: '💡', title: 'Easy to Use', desc: 'Intuitive interface designed for every role. No training needed — your team can start using it on day one.', color: '#f59e0b' },
                        { icon: '🔒', title: 'Secure & Reliable', desc: 'JWT authentication, encrypted data, role-based access control, and 24/7 uptime monitoring.', color: '#8b5cf6' },
                        { icon: '📈', title: 'Leak Detection', desc: 'AI analyzes consumption patterns and alerts customers and admins about potential leaks before they become costly.', color: '#ef4444' },
                        { icon: '🌍', title: 'Built for Scale', desc: 'Whether you serve 100 or 100,000 customers, our platform scales effortlessly with your growing utility.', color: '#10b981' },
                    ].map((item, i) => (
                        <div key={i} className="landing-feature-card" style={{ '--accent': item.color }}>
                            <div className="landing-feature-icon">{item.icon}</div>
                            <h3 className="landing-feature-title">{item.title}</h3>
                            <p className="landing-feature-desc">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </LandingLayout>
    );
};

// ═══════════════════════════════════════════════════════════════════
// ABOUT US PAGE
// ═══════════════════════════════════════════════════════════════════
const AboutUsPage = () => {
    return (
        <LandingLayout>
            <section className="landing-section landing-visible" style={{ paddingTop: '8rem' }}>
                <div className="landing-section-header">
                    <span className="landing-section-badge">About Us</span>
                    <h2 className="landing-section-title">Built by Engineers Who Care About Water</h2>
                    <p className="landing-section-subtitle">
                        We're a team of software engineers and utility industry experts on a mission
                        to modernize water billing infrastructure across Africa and beyond.
                    </p>
                </div>

                {/* Mission & Vision */}
                <div className="landing-features-grid" style={{ marginBottom: '4rem' }}>
                    {[
                        {
                            icon: '🎯', title: 'Our Mission',
                            desc: 'To eliminate manual meter reading errors, reduce billing disputes, and make water billing seamless for utilities and customers alike.',
                            color: '#3478ff'
                        },
                        {
                            icon: '🔭', title: 'Our Vision',
                            desc: 'A future where every water utility — from small towns to major cities — has access to AI-powered billing that is accurate, affordable, and easy to use.',
                            color: '#14b8a6'
                        },
                        {
                            icon: '💡', title: 'Our Values',
                            desc: 'Transparency, accuracy, and customer-first design drive everything we build. We believe technology should serve people, not the other way around.',
                            color: '#f59e0b'
                        },
                    ].map((item, i) => (
                        <div key={i} className="landing-feature-card" style={{ '--accent': item.color }}>
                            <div className="landing-feature-icon">{item.icon}</div>
                            <h3 className="landing-feature-title">{item.title}</h3>
                            <p className="landing-feature-desc">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Team */}
                <div className="landing-section-header">
                    <span className="landing-section-badge">The Team</span>
                    <h2 className="landing-section-title">Meet the People Behind AquaBill AI</h2>
                </div>
                <div className="landing-features-grid" style={{ marginBottom: '4rem' }}>
                    {[
                        { icon: '👨‍💻', name: 'Kalab Berihun', role: 'Lead Developer & Founder', desc: 'Full-stack engineer with 8+ years in utility management systems and AI integration.', color: '#3478ff' },
                        { icon: '👩‍🔬', name: 'Betelhem Tadegegn', role: 'AI/ML Engineer', desc: 'Specialized in computer vision and OCR systems for real-world applications.', color: '#8b5cf6' },
                        { icon: '👨‍🔧', name: 'Mihretab Sleshi', role: 'Field Operations Lead', desc: 'Former utility technician bringing 12 years of hands-on industry experience.', color: '#10b981' },
                        { icon: '👨‍💼', name: 'Mesay Tsegaye', role: 'Backend Engineer', desc: 'Expert in scalable API design, database optimization, and cloud infrastructure.', color: '#f59e0b' },
                        { icon: '👩‍💼', name: 'Mekdes Addis', role: 'UI/UX Designer', desc: 'Passionate about creating intuitive, accessible interfaces that delight users.', color: '#ec4899' },
                    ].map((member, i) => (
                        <div key={i} className="landing-feature-card" style={{ '--accent': member.color, textAlign: 'center' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{member.icon}</div>
                            <h3 className="landing-feature-title">{member.name}</h3>
                            <div style={{ color: 'var(--primary-400)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>{member.role}</div>
                            <p className="landing-feature-desc">{member.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Contact Info */}
                <div className="landing-section-header">
                    <span className="landing-section-badge">Contact</span>
                    <h2 className="landing-section-title">Get in Touch</h2>
                    <p className="landing-section-subtitle">
                        Have questions? We'd love to hear from you.
                    </p>
                </div>
                <div className="landing-stats-grid">
                    {[
                        { icon: '📧', label: 'Email', value: 'support@aquabillai.com', href: 'mailto:support@aquabillai.com' },
                        { icon: '📞', label: 'Phone', value: '+251 912 345 678', href: 'tel:+251912345678' },
                        { icon: '𝕏', label: 'X (Twitter)', value: '@AquaBillAI', href: 'https://x.com/AquaBillAI' },
                        { icon: '✈️', label: 'Telegram', value: '@AquaBillAI_Bot', href: 'https://t.me/AquaBillAI_Bot' },
                    ].map((contact, i) => (
                        <a
                            key={i}
                            href={contact.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="landing-stat"
                            style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                        >
                            <div className="landing-stat-icon">{contact.icon}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                {contact.label}
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-400)' }}>
                                {contact.value}
                            </div>
                        </a>
                    ))}
                </div>
            </section>
        </LandingLayout>
    );
};

export default LandingPage;
export { FeaturesPage, HowItWorksPage, WhyUsPage, AboutUsPage };
