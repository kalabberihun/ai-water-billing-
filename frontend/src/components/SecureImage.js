import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SecureImage = ({ src, alt, style, className }) => {
    const [imgSrc, setImgSrc] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl = null;

        const fetchImage = async () => {
            try {
                const tokenStr = localStorage.getItem('tokens');
                const tokenObj = tokenStr ? JSON.parse(tokenStr) : null;
                
                const response = await axios.get(src, {
                    headers: tokenObj?.access ? { Authorization: `Bearer ${tokenObj.access}` } : {},
                    responseType: 'blob'
                });
                
                objectUrl = URL.createObjectURL(response.data);
                setImgSrc(objectUrl);
            } catch (err) {
                console.error("Failed to load secure image", err);
                setError(true);
            }
        };

        if (src) {
            // If it's already an absolute data/blob URL, just use it directly
            if (src.startsWith('data:') || src.startsWith('blob:')) {
                setImgSrc(src);
            } else {
                fetchImage();
            }
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    if (error || !src) {
        return (
            <div style={{...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
                Image unavailable
            </div>
        );
    }

    if (!imgSrc) {
        return (
            <div style={{...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)'}}>
                <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-400)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    return <img src={imgSrc} alt={alt} style={style} className={className} />;
};

export default SecureImage;
