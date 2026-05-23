import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/authSlice';

const setupAxiosInterceptors = () => {
    // Request interceptor: attach fresh token to every request
    axios.interceptors.request.use(
        (config) => {
            const tokenStr = localStorage.getItem('tokens');
            if (tokenStr) {
                const tokens = JSON.parse(tokenStr);
                if (tokens && tokens.access) {
                    config.headers['Authorization'] = `Bearer ${tokens.access}`;
                }
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401 and refresh
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            
            // Only attempt refresh if error is 401 and we haven't retried yet
            if (error.response && error.response.status === 401 && !originalRequest._retry) {
                // Do not intercept 401 from login requests
                if (originalRequest.url.includes('/api/auth/login')) {
                    return Promise.reject(error);
                }

                // Prevent infinite loop if the refresh endpoint itself fails with 401
                if (originalRequest.url.includes('/api/auth/refresh')) {
                    store.dispatch(logout());
                    window.location.href = '/';
                    return Promise.reject(error);
                }

                originalRequest._retry = true;
                
                try {
                    const tokenStr = localStorage.getItem('tokens');
                    if (!tokenStr) throw new Error('No tokens found');
                    
                    const tokens = JSON.parse(tokenStr);
                    if (!tokens.refresh) throw new Error('No refresh token');
                    
                    // Call the refresh endpoint (clean axios instance to avoid interceptor loop)
                    const apiURL = process.env.REACT_APP_API_URL || 
                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                            ? 'http://localhost:8000' 
                            : 'https://water-billing-api-k6qs.onrender.com');
                    const res = await axios.post(`${apiURL}/api/auth/refresh`, {
                        refresh: tokens.refresh
                    }, {
                        // Skip request interceptor for this specific call by passing custom headers if needed
                    });
                    
                    // Update tokens in local storage
                    const newTokens = {
                        ...tokens,
                        access: res.data.access
                    };
                    localStorage.setItem('tokens', JSON.stringify(newTokens));
                    
                    // Update auth header for the failed request and retry
                    originalRequest.headers['Authorization'] = `Bearer ${newTokens.access}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    console.error("Session expired. Logging out.");
                    store.dispatch(logout());
                    window.location.href = '/';
                    return Promise.reject(refreshError);
                }
            }
            
            return Promise.reject(error);
        }
    );
};

export default setupAxiosInterceptors;
