import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SupportWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('support'); // 'support' | 'chat'
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Hi! I'm AI WATER BILLING SYSTEM Assistant 💧\nAsk me anything about your bills, payments, or water usage!" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    const tokens = useSelector((state) => state.auth.tokens);
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const location = useLocation();

    // Don't show on auth pages
    const hiddenPaths = ['/login', '/register', '/verify-email', '/forgot-password'];
    if (hiddenPaths.some(p => location.pathname.startsWith(p)) || location.pathname.startsWith('/reset-password')) {
        return null;
    }

    const isCustomer = tokens && user && !user.is_staff && !['Admin', 'ADMIN', 'Clerk', 'CLERK', 'Technician', 'TECHNICIAN'].includes(user?.role);

    const supportOptions = [
        {
            icon: '📧',
            label: 'Email Support',
            desc: 'Support.aiwaterbillingsystem@gmail.com',
            action: () => window.location.href = 'mailto:Support.aiwaterbillingsystem@gmail.com'
        },
        {
            icon: '📞',
            label: 'Call Us',
            desc: '+251 993 140 988',
            action: () => window.location.href = 'tel:+251993140988'
        },
        {
            icon: '✈️',
            label: 'Telegram',
            desc: '@AIWaterBilling_Bot',
            action: () => window.open('https://t.me/AIWaterBilling_Bot', '_blank')
        },
    ];

    // Add report leakage option for logged-in customers
    if (isCustomer) {
        supportOptions.unshift({
            icon: '🚰',
            label: 'Report Leakage',
            desc: 'Report a water leak',
            action: () => { navigate('/report-leakage'); setIsOpen(false); },
            highlight: true,
        });
    }

    const sendMessage = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsTyping(true);

        try {
            const res = await axios.post(`${API_URL}/api/billing/chatbot/`, {
                message: userMsg
            });
            setMessages(prev => [...prev, { role: 'bot', text: res.data.response }]);
        } catch (err) {
            console.error('Chatbot error:', err.response?.status, err.response?.data || err.message);
            const errMsg = err.response?.data?.response || err.response?.data?.error 
                || "Sorry, I couldn't process your request. Please try again or contact support.";
            setMessages(prev => [...prev, {
                role: 'bot',
                text: errMsg
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const quickQuestions = [
        "What's my current balance?",
        "When is my bill due?",
        "Show my recent payments",
        "Why is my bill high?",
    ];

    return (
        <>
            {/* Floating Button */}
            <button
                className={`support-fab ${isOpen ? 'support-fab--open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Support"
            >
                {isOpen ? '✕' : '💬'}
            </button>

            {/* Support Panel */}
            {isOpen && (
                <>
                    <div className="support-overlay" onClick={() => setIsOpen(false)} />
                    <div className="support-panel support-panel--with-chat">
                        {/* Header with Tabs */}
                        <div className="support-panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>💧</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {activeTab === 'chat' ? 'AI Assistant' : 'Need Help?'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        {activeTab === 'chat' ? 'Powered by Gemini AI' : "We're here for you"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: 'none', border: 'none', fontSize: '1.2rem',
                                    cursor: 'pointer', color: 'var(--text-tertiary)',
                                    padding: '0.25rem'
                                }}
                            >✕</button>
                        </div>

                        {/* Tab Switcher */}
                        {tokens && (
                            <div className="chat-tabs">
                                <button
                                    className={`chat-tab ${activeTab === 'support' ? 'chat-tab--active' : ''}`}
                                    onClick={() => setActiveTab('support')}
                                >
                                    📋 Support
                                </button>
                                <button
                                    className={`chat-tab ${activeTab === 'chat' ? 'chat-tab--active' : ''}`}
                                    onClick={() => setActiveTab('chat')}
                                >
                                    🤖 AI Chat
                                </button>
                            </div>
                        )}

                        {/* Support Tab */}
                        {activeTab === 'support' && (
                            <>
                                <div className="support-panel-body">
                                    {supportOptions.map((option, i) => (
                                        <button
                                            key={i}
                                            className={`support-option ${option.highlight ? 'support-option--highlight' : ''}`}
                                            onClick={option.action}
                                        >
                                            <span className="support-option-icon">{option.icon}</span>
                                            <div className="support-option-text">
                                                <div className="support-option-label">{option.label}</div>
                                                <div className="support-option-desc">{option.desc}</div>
                                            </div>
                                            <span className="support-option-arrow">→</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="support-panel-footer">
                                    <p>Available Mon–Sat, 8AM – 6PM EAT</p>
                                </div>
                            </>
                        )}

                        {/* AI Chat Tab */}
                        {activeTab === 'chat' && (
                            <>
                                <div className="chat-messages">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                                            {msg.role === 'bot' && <span className="chat-msg-avatar">🤖</span>}
                                            <div className={`chat-msg-bubble chat-msg-bubble--${msg.role}`}>
                                                {msg.text.split('\n').map((line, j) => (
                                                    <React.Fragment key={j}>
                                                        {line}
                                                        {j < msg.text.split('\n').length - 1 && <br />}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {isTyping && (
                                        <div className="chat-msg chat-msg--bot">
                                            <span className="chat-msg-avatar">🤖</span>
                                            <div className="chat-msg-bubble chat-msg-bubble--bot chat-typing">
                                                <span className="typing-dot"></span>
                                                <span className="typing-dot"></span>
                                                <span className="typing-dot"></span>
                                            </div>
                                        </div>
                                    )}
                                    <ChatScrollAnchor messages={messages} isTyping={isTyping} chatEndRef={chatEndRef} />
                                </div>

                                {/* Quick Questions */}
                                {messages.length <= 1 && (
                                    <div className="chat-quick-questions">
                                        {quickQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                className="chat-quick-btn"
                                                onClick={() => { setInput(q); }}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Chat Input */}
                                <div className="chat-input-area">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="chat-input"
                                        placeholder="Ask me anything..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isTyping}
                                    />
                                    <button
                                        className="chat-send-btn"
                                        onClick={sendMessage}
                                        disabled={!input.trim() || isTyping}
                                    >
                                        ➤
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </>
    );
};

// Scroll helper component
const ChatScrollAnchor = ({ messages, isTyping, chatEndRef }) => {
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, chatEndRef]);
    return <div ref={chatEndRef} />;
};

export default SupportWidget;
