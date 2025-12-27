const API_BASE_URL = 'http://127.0.0.1:8000';

class Auth {
    static getToken() {
        return localStorage.getItem('access_token');
    }

    static setToken(token) {
        localStorage.setItem('access_token', token);
    }

    static removeToken() {
        localStorage.removeItem('access_token');
    }

    static isLoggedIn() {
        return !!this.getToken();
    }

    static getUserRole() {
        return localStorage.getItem('user_role');
    }

    static setUserRole(role) {
        localStorage.setItem('user_role', role);
    }

    static logout() {
        this.removeToken();
        localStorage.removeItem('user_role');
        // Redirect to home page
        window.location.href = '../index.html';
    }
}

class API {
    static async request(endpoint, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            console.log(`🌐 Making request to: ${API_BASE_URL}${endpoint}`);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            
            if (response.status === 401) {
                Auth.logout();
                throw new Error('Authentication required');
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HTTP error! status: ${response.status}, response: ${errorText}`);
                let errorDetail = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = JSON.parse(errorText);
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    // If not JSON, use the text as is
                }
                throw new Error(errorDetail);
            }

            const data = await response.json();
            console.log(`✅ Request successful:`, data);
            return data;
        } catch (error) {
            console.error('❌ API request failed:', error);
            throw error;
        }
    }

    static async get(endpoint) {
        return this.request(endpoint);
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async upload(endpoint, formData) {
        const token = Auth.getToken();
        const headers = {
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    // Remove any existing alerts first
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function redirectIfNotLoggedIn() {
    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
    }
}

function redirectBasedOnRole() {
    const role = Auth.getUserRole();
    console.log('📍 Redirecting based on role:', role);
    
    if (role === 'teacher') {
        window.location.href = 'teacher/dashboard.html';
    } else if (role === 'student') {
        window.location.href = 'student/dashboard.html';
    } else {
        // Default to login page if role not determined
        console.warn('Role not determined, redirecting to login');
        window.location.href = 'login.html';
    }
}

// Add this to help with CORS issues
function handleCorsError(error) {
    console.error('CORS or network error:', error);
    showNotification('Cannot connect to server. Please make sure the backend is running on port 8000.', 'danger');
}