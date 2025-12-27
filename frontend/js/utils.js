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
    // Remove any existing notification first
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) notif.remove();
    });
    
    // Create notification container
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'custom-notification';
    
    // Style the notification
    const bgColor = {
        'success': '#d4edda',
        'danger': '#f8d7da',
        'warning': '#fff3cd',
        'info': '#d1ecf1',
        'primary': '#cfe2ff'
    }[type] || '#d1ecf1';
    
    const borderColor = {
        'success': '#c3e6cb',
        'danger': '#f5c6cb',
        'warning': '#ffeaa7',
        'info': '#bee5eb',
        'primary': '#b6d4fe'
    }[type] || '#bee5eb';
    
    const textColor = {
        'success': '#155724',
        'danger': '#721c24',
        'warning': '#856404',
        'info': '#0c5460',
        'primary': '#084298'
    }[type] || '#0c5460';
    
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 350px;
        padding: 15px 20px;
        background-color: ${bgColor};
        border: 1px solid ${borderColor};
        border-radius: 4px;
        color: ${textColor};
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
    `;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: ${textColor};
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        margin-left: 15px;
        line-height: 1;
    `;
    
    // Create message span
    const messageSpan = document.createElement('span');
    messageSpan.innerHTML = message;
    messageSpan.style.flex = '1';
    
    // Add elements to notification
    notificationDiv.appendChild(messageSpan);
    notificationDiv.appendChild(closeBtn);
    document.body.appendChild(notificationDiv);
    
    // Function to remove notification with animation
    const removeNotification = () => {
        if (notificationDiv._timeoutId) {
            clearTimeout(notificationDiv._timeoutId);
        }
        notificationDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 300);
    };
    
    
    // Auto remove after 15 seconds
    notificationDiv._timeoutId = setTimeout(removeNotification, 15000);
    
    // Close button click handler ONLY
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNotification();
    });
    
    // Add CSS animations if not already in document
    if (!document.getElementById('notification-animations')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'notification-animations';
        styleEl.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(styleEl);
    }
    
    // Store reference for debugging
    window.__lastNotification = notificationDiv;
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