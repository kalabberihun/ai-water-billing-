import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PrivateRoute = ({ children }) => {
    const tokens = useSelector((state) => state.auth.tokens);
    return tokens ? children : <Navigate to="/" />;
};

export default PrivateRoute;
