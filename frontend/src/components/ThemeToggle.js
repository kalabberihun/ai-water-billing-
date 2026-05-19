import React, { useEffect, useState } from 'react';

const ThemeToggle = ({ style: customStyle }) => {
    const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');

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
                background: 'var(--color-accent-subtle)',
                border: '1.5px solid var(--color-border)',
                borderRadius: '999px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: 'var(--color-text)',
                transition: 'all 200ms ease',
                ...customStyle
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-subtle)';
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {theme === 'dark' ? '☀️' : '🌙'}
        </button>
    );
};

export default ThemeToggle;
