import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './store';
import setupAxiosInterceptors from './utils/axiosSetup';

// Initialize Axios Interceptors
setupAxiosInterceptors();

// Apply Theme on load to prevent flashes
const currentTheme = localStorage.getItem('appTheme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>
);
