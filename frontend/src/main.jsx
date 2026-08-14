import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import axios from 'axios';
import App from './App';
import './index.css';

// Set global API base URL for Render deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://medicine-price-app.onrender.com';
axios.defaults.baseURL = API_BASE_URL;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0d9488',
          borderRadius: 8,
          fontFamily: "'Inter', sans-serif",
          colorBgContainer: '#ffffff',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
