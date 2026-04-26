import React, { useEffect, useState } from 'react';

const ThemeToggle = ({ style: customStyle }) => {
    const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('appTheme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
    };

    return (
        <button
            onClick={toggleTheme}
            style={{
                position: 'fixed',
                top: '15px',
                right: '20px',
                zIndex: 1000,
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-default)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                boxShadow: 'var(--shadow-md)',
                color: 'var(--text-primary)',
                transition: 'all var(--transition-base)',
                ...customStyle
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-glass-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-glass)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {theme === 'dark' ? '☀️' : '🌙'}
        </button>
    );
};

export default ThemeToggle;
