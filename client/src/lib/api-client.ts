const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

const PUBLIC_GET_RETRY_PATTERNS = [
  /^\/products(?:\/\d+)?(?:\/click)?$/,
  /^\/promotions(?:\/\d+)?$/,
  /^\/news(?:\/\d+)?$/,
  /^\/tracks(?:\/\d+)?$/,
  /^\/shows(?:\/\d+)?$/,
  /^\/talks(?:\/\d+)?$/,
  /^\/advertisements(?:\/\d+)?$/,
  /^\/host-commentaries(?:\/\d+)?$/,
  /^\/advertisement-host-audios(?:\/\d+)?$/,
  /^\/timeline-items$/,
  /^\/schedule-items$/,
  /^\/listeners\/current$/,
];

function normalizeEndpointPath(endpoint: string): string {
  const withoutOrigin = endpoint.replace(/^https?:\/\/[^/]+/i, "");
  const withLeadingSlash = withoutOrigin.startsWith("/") ? withoutOrigin : `/${withoutOrigin}`;
  return withLeadingSlash.split("?")[0];
}

function canRetryPublicGetWithoutAuth(endpoint: string): boolean {
  const path = normalizeEndpointPath(endpoint);
  return PUBLIC_GET_RETRY_PATTERNS.some((pattern) => pattern.test(path));
}

// Helper function to get auth token from localStorage
function getAuthToken(): string | null {
  const token = localStorage.getItem('auth_token');
  if (!token || token === 'admin-token') {
    if (token === 'admin-token') {
      localStorage.removeItem('auth_token');
    }
    return null;
  }
  return token;
}

// Helper function to set auth token
function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// Helper function to remove auth token
function removeAuthToken(): void {
  localStorage.removeItem('auth_token');
}

// Generic fetch wrapper with authentication
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const method = options.method || 'GET';

  const buildHeaders = (includeAuth: boolean): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (includeAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  };

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: buildHeaders(true),
    });

    // Handle network errors (connection refused, etc.)
    if (!response.ok) {
      if (response.status === 401 && token && method === 'GET' && canRetryPublicGetWithoutAuth(endpoint)) {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: buildHeaders(false),
        });
      }

      if (response.ok) {
        return response.json();
      }

      // Try to parse error response
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP error! status: ${response.status}` };
      }
      
      // Handle specific error codes
      if (response.status === 401) {
        const errorMessage = String(errorData.error || '').toLowerCase();
        if (
          token &&
          (
            errorData.code === 'TOKEN_EXPIRED' ||
            errorData.code === 'INVALID_TOKEN' ||
            errorMessage.includes('token expired') ||
            errorMessage.includes('invalid token')
          )
        ) {
          removeAuthToken();
        }
        throw new Error(errorData.error || 'Authentication failed');
      }
      
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors gracefully
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('Backend server is not running. Please start it with: npm run dev:server');
    }
    throw error;
  }
}

// Auth API
export const authApi = {
  async signUp(email: string, password: string, username?: string, fullName?: string) {
    const data = await apiRequest<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullName }),
    });
    setAuthToken(data.token);
    return data;
  },

  async signIn(email: string, password: string) {
    const data = await apiRequest<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async getCurrentUser() {
    return apiRequest<{ user: any }>('/auth/me');
  },

  async resetPassword(email: string) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async updatePassword(password: string) {
    return apiRequest('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  signOut() {
    removeAuthToken();
  },
};

// Generic API methods
export const api = {
  get: <T>(endpoint: string, options?: { params?: Record<string, any> }) => {
    let url = endpoint;
    if (options?.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      url += (endpoint.includes('?') ? '&' : '?') + params.toString();
    }
    return apiRequest<T>(url, { method: 'GET' });
  },
  post: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  put: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};

// Export token management functions
export { getAuthToken, setAuthToken, removeAuthToken };

