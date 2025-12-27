// Add this function at the top of the file
function redirectBasedOnRole() {
    const role = Auth.getUserRole();
    console.log('📍 Redirecting based on role:', role);
    
    if (role === 'teacher') {
        window.location.href = 'teacher/dashboard.html';
    } else if (role === 'student') {
        window.location.href = 'student/dashboard.html';
    } else {
        // Default to student if role not determined
        console.warn('Role not determined, defaulting to student');
        window.location.href = 'student/dashboard.html';
    }
}

// Add show password function
function togglePasswordVisibility(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleId);
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Setup password toggle buttons
    setupPasswordToggles();
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const username = formData.get('username');
            const password = formData.get('password');

            try {
                // Use URLSearchParams for form data as required by OAuth2
                const params = new URLSearchParams();
                params.append('username', username);
                params.append('password', password);
                params.append('grant_type', 'password');

                console.log('🔐 Attempting login for user:', username);

                const response = await fetch('http://127.0.0.1:8000/auth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Login failed with status ${response.status}`);
                }

                const data = await response.json();
                console.log('✅ Login successful, token received');

                Auth.setToken(data.access_token);
                console.log('📍 Token stored');

                // Get user info to determine role
                try {
                    const userInfo = await API.get('/auth/me');
                    Auth.setUserRole(userInfo.role);
                    console.log('✅ User role determined:', userInfo.role);
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    console.log('📍 About to redirect with role:', userInfo.role);
                    setTimeout(() => {
                        if (userInfo.role === 'teacher') {
                            window.location.href = 'teacher/dashboard.html';
                        } else if (userInfo.role === 'student') {
                            window.location.href = 'student/dashboard.html';
                        } else {
                            window.location.href = 'student/dashboard.html';
                        }
                    }, 1000);
                    
                } catch (error) {
                    console.warn('Could not get user info, using default role');
                    // If we can't get user info, determine based on username pattern
                    const role = username.includes('teacher') ? 'teacher' : 'student';
                    Auth.setUserRole(role);
                    console.log('📍 Default role assigned:', role);
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        if (role === 'teacher') {
                            window.location.href = 'teacher/dashboard.html';
                        } else {
                            window.location.href = 'student/dashboard.html';
                        }
                    }, 1000);
                }

            } catch (error) {
                console.error('❌ Login error:', error);
                showNotification(`Login failed: ${error.message}`, 'danger');
            }
        });
    }

    // Signup form handler - UPDATED WITH BETTER ERROR HANDLING
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const userData = {
                email: formData.get('email'),
                username: formData.get('username'),
                password: formData.get('password'),
                full_name: formData.get('full_name'),
                role: formData.get('role')
            };

            console.log('📝 Registration attempt with data:', userData);

            // Add password length validation (72 characters max for bcrypt)
            if (userData.password.length > 72) {
                showNotification("Password too long. Maximum 72 characters allowed.", "danger");
                return;
            }

            // Add basic validation
            if (!userData.email || !userData.username || !userData.password || !userData.full_name || !userData.role) {
                showNotification("Please fill in all fields.", "danger");
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                showNotification("Please enter a valid email address.", "danger");
                return;
            }

            // Validate username (alphanumeric and underscores)
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(userData.username)) {
                showNotification("Username can only contain letters, numbers, and underscores.", "danger");
                return;
            }

            // Validate password strength
            if (userData.password.length < 6) {
                showNotification("Password must be at least 6 characters long.", "danger");
                return;
            }

            try {
                console.log('📝 Making POST request to: http://127.0.0.1:8000/auth/register');
                console.log('📝 Request data:', JSON.stringify(userData, null, 2));
                
                const response = await fetch('http://127.0.0.1:8000/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData)
                });

                console.log('📊 Response status:', response.status);
                console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
                
                const responseText = await response.text();
                console.log('📊 Response text:', responseText);

                if (!response.ok) {
                    let errorDetail = `Registration failed with status ${response.status}`;
                    try {
                        const errorData = JSON.parse(responseText);
                        errorDetail = errorData.detail || errorDetail;
                        console.error('❌ Error details:', errorData);
                    } catch (e) {
                        console.error('❌ Non-JSON error response:', responseText);
                        errorDetail = responseText || errorDetail;
                    }
                    
                    if (response.status === 405) {
                        errorDetail = "Method Not Allowed. The /auth/register endpoint might not exist. Check if backend is running.";
                    }
                    
                    throw new Error(errorDetail);
                }

                const result = JSON.parse(responseText);
                console.log('✅ Registration success:', result);
                
                // Store role from registration response
                Auth.setUserRole(userData.role);
                console.log('📍 Role stored from registration:', userData.role);
                
                showNotification('Registration successful! Logging in...', 'success');
                
                // Automatically login after registration
                await autoLoginAfterSignup(userData.username, userData.password, userData.role);
                
            } catch (error) {
                console.error('❌ Registration error:', error);
                console.error('❌ Error stack:', error.stack);
                showNotification(`Registration failed: ${error.message}`, 'danger');
            }
        });
    }

    // Logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            Auth.logout();
            window.location.href = '/index.html'; // Redirect to home page
        });
    }
});

async function autoLoginAfterSignup(username, password, role) {
    try {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);
        params.append('grant_type', 'password');

        console.log('🔐 Auto-login attempt with username:', username);

        const loginResponse = await fetch('http://127.0.0.1:8000/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
        });

        console.log('📊 Login response status:', loginResponse.status);

        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            Auth.setToken(loginData.access_token);
            Auth.setUserRole(role);
            console.log('✅ Auto-login successful after registration');
            console.log('📍 About to redirect based on role:', role);
            
            // Show success message and redirect
            showNotification('Registration complete! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                if (role === 'teacher') {
                    window.location.href = '/teacher/dashboard.html';
                } else if (role === 'student') {
                    window.location.href = '/student/dashboard.html';
                } else {
                    window.location.href = '/student/dashboard.html';
                }
            }, 1500);
        } else {
            console.error('❌ Login response not ok:', loginResponse.status);
            const errorText = await loginResponse.text();
            console.error('❌ Login error response:', errorText);
            
            // If auto-login fails, redirect to login page
            showNotification('Registration complete! Please login with your credentials.', 'info');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Auto-login error:', error);
        showNotification('Registration complete! Please login with your credentials.', 'info');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }
}

function setupPasswordToggles() {
    // Setup password toggle for login page
    const passwordInputLogin = document.getElementById('password');
    const togglePasswordLogin = document.getElementById('togglePassword');
    
    if (passwordInputLogin && togglePasswordLogin) {
        togglePasswordLogin.addEventListener('click', function() {
            togglePasswordVisibility('password', 'togglePassword');
        });
    }
    
    // Setup password toggle for signup page
    const passwordInputSignup = document.getElementById('password');
    const togglePasswordSignup = document.getElementById('togglePasswordSignup');
    
    if (passwordInputSignup && togglePasswordSignup) {
        togglePasswordSignup.addEventListener('click', function() {
            togglePasswordVisibility('password', 'togglePasswordSignup');
        });
    }
}

// Add a test function to check if API is reachable
async function testApiConnection() {
    try {
        console.log('🔌 Testing API connection...');
        const response = await fetch('http://127.0.0.1:8000/health');
        if (response.ok) {
            console.log('✅ API is reachable');
            return true;
        } else {
            console.error('❌ API health check failed:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Cannot connect to API:', error.message);
        showNotification('Cannot connect to server. Make sure backend is running on port 8000.', 'danger');
        return false;
    }
}

// Test connection on page load if we're on login or signup page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('signup.html')) {
        testApiConnection();
    }
});