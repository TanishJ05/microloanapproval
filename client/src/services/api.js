import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Remove Content-Type for FormData - let axios set it automatically with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/register', data),
  login: (data) => api.post('/login', data),
};

export const loanAPI = {
  uploadStatement: (file) => {
    const formData = new FormData();
    formData.append('statement', file);
    return api.post('/upload', formData, {
      // Don't set Content-Type - let axios set it automatically with boundary
      timeout: 60000, // 60 second timeout for file uploads
    });
  },
  checkEligibility: (data) => api.post('/check-eligibility', data),
  getHistory: () => api.get('/history'),
  getApplicationDetails: (id) => api.get(`/history/${id}`),
};

export default api;

