import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

// Attach Authorization Bearer token and active workspace header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('worknest_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const activeWorkspaceId = localStorage.getItem('worknest_workspace_id');
  if (activeWorkspaceId) {
    config.headers['x-workspace-id'] = activeWorkspaceId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if expired or unauthorized
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/public')) {
        localStorage.removeItem('worknest_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
