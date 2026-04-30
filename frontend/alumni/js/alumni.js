// Alumni Dashboard Functions
async function loadAlumniDashboard() {
    try {
        const dashboardData = await API.get('/api/alumni/dashboard');
        console.log('Dashboard data:', dashboardData);
        displayAlumniDashboard(dashboardData);
    } catch (error) {
        console.error('Dashboard error:', error);
        showNotification('Failed to load dashboard: ' + error.message, 'danger');
    }
}

function displayAlumniDashboard(data) {
    // Update welcome name
    const alumniName = document.getElementById('alumniName');
    if (alumniName && data.alumni && data.alumni.user) {
        alumniName.textContent = data.alumni.user.full_name;
    }
    
    // Update stats
    const unreadCount = document.getElementById('unreadCount');
    if (unreadCount) {
        unreadCount.textContent = data.unread_messages || 0;
    }
    
    const connectionsCount = document.getElementById('connectionsCount');
    if (connectionsCount) {
        connectionsCount.textContent = data.connections_count || 0;
    }
    
    // Display recent conversations
    const recentConversations = document.getElementById('recentConversations');
    if (recentConversations) {
        if (!data.recent_conversations || data.recent_conversations.length === 0) {
            recentConversations.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-comments fa-3x mb-3 d-block"></i>
                    <p>No conversations yet. Start chatting with students or teachers!</p>
                </div>
            `;
        } else {
            recentConversations.innerHTML = data.recent_conversations.map(conv => `
                <div class="recent-chat-item p-3 border-bottom" onclick="window.location.href='chat.html?user=${conv.other_user.id}'">
                    <div class="d-flex align-items-center">
                        <div class="user-avatar me-3" style="width: 50px; height: 50px;">
                            ${conv.other_user.full_name.charAt(0)}
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(conv.other_user.full_name)}</h6>
                            <small class="text-muted">${escapeHtml(conv.other_user.role)}</small>
                            <p class="mb-0 small text-muted">${escapeHtml(conv.last_message || 'No messages yet')}</p>
                        </div>
                        <small class="text-muted">${formatRelativeTime(conv.last_message_time)}</small>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Chat Functions
let currentChatUser = null;
let ws = null;
let currentTab = 'students';
let studentsList = [];
let teachersList = [];

async function loadUsers() {
    try {
        if (currentTab === 'students') {
            const response = await API.get('/api/alumni/students');
            studentsList = response;
            displayUsersList(studentsList);
        } else {
            const response = await API.get('/api/alumni/teachers');
            teachersList = response;
            displayUsersList(teachersList);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        showNotification('Failed to load users: ' + error.message, 'danger');
    }
}

function displayUsersList(users) {
    const usersListDiv = document.getElementById('usersList');
    
    if (!users || users.length === 0) {
        usersListDiv.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-users fa-3x mb-3 d-block"></i>
                <p>No ${currentTab} found</p>
            </div>
        `;
        return;
    }
    
    usersListDiv.innerHTML = users.map(user => `
        <div class="chat-user-item" onclick="selectUser(${user.id}, '${escapeHtml(user.full_name)}', '${user.role}')">
            <div class="d-flex align-items-center">
                <div class="user-avatar me-3">
                    ${user.full_name.charAt(0)}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">${escapeHtml(user.full_name)}</h6>
                        <small class="text-muted" id="lastSeen_${user.id}"></small>
                    </div>
                    <small class="text-muted">@${escapeHtml(user.username)}</small>
                </div>
            </div>
        </div>
    `).join('');
}

async function selectUser(userId, userName, userRole) {
    currentChatUser = { id: userId, name: userName, role: userRole };
    
    // Update chat header
    document.getElementById('chatUserName').textContent = userName;
    document.getElementById('chatUserRole').textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    document.getElementById('chatAvatar').textContent = userName.charAt(0);
    
    // Enable input
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    // Load messages
    await loadMessages(userId);
    
    // Connect WebSocket
    connectWebSocket();
}

async function loadMessages(otherUserId) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading messages...</span>
            </div>
            <p class="mt-2">Loading messages...</p>
        </div>
    `;
    
    try {
        const response = await API.get(`/api/chat/messages/${otherUserId}`);
        displayMessages(response.messages);
    } catch (error) {
        console.error('Failed to load messages:', error);
        messagesContainer.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
                <p>Failed to load messages: ${error.message}</p>
            </div>
        `;
    }
}

function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-comments fa-3x mb-3 d-block"></i>
                <p>No messages yet. Start the conversation!</p>
            </div>
        `;
        return;
    }
    
    const currentUserId = getCurrentUserId();
    
    messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === currentUserId;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-bubble">
                    ${escapeHtml(msg.message)}
                    <div class="message-time">
                        ${new Date(msg.created_at).toLocaleTimeString()}
                        ${isSent ? (msg.is_read ? '<i class="fas fa-check-double ms-1"></i>' : '<i class="fas fa-check ms-1"></i>') : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function connectWebSocket() {
    if (ws) {
        ws.close();
    }
    
    const token = Auth.getToken();
    ws = new WebSocket(`ws://127.0.0.1:8000/api/chat/ws/${token}`);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message' || data.type === 'new_message') {
            // If message is from current chat user, display it
            if (data.sender_id === currentChatUser?.id) {
                appendMessage(data);
            }
            // Update unread count
            loadUnreadCount();
        }
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
    };
}

function appendMessage(messageData) {
    const messagesContainer = document.getElementById('messagesContainer');
    const currentUserId = getCurrentUserId();
    const isSent = messageData.sender_id === currentUserId;
    
    // Remove empty state if present
    if (messagesContainer.querySelector('.text-center.text-muted')) {
        messagesContainer.innerHTML = '';
    }
    
    const messageHtml = `
        <div class="message ${isSent ? 'sent' : 'received'}">
            <div class="message-bubble">
                ${escapeHtml(messageData.message)}
                <div class="message-time">
                    ${new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentChatUser) return;
    
    try {
        const response = await API.post(`/api/chat/send?receiver_id=${currentChatUser.id}&message=${encodeURIComponent(message)}`, {});
        
        // Clear input
        messageInput.value = '';
        
        // Append message to chat
        appendMessage({
            sender_id: getCurrentUserId(),
            message: message,
            created_at: new Date().toISOString()
        });
        
        // Send via WebSocket for real-time
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'message',
                receiver_id: currentChatUser.id,
                message: message
            }));
        }
        
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Failed to send message: ' + error.message, 'danger');
    }
}

function getCurrentUserId() {
    const token = Auth.getToken();
    // Decode JWT to get user ID (simplified - in production, use proper JWT decoding)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ? 1 : 1; // Fallback for demo
}

async function loadUnreadCount() {
    try {
        const response = await API.get('/api/chat/unread-count');
        const unreadCount = response.unread_count;
        const badge = document.getElementById('unreadBadge');
        if (unreadCount > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load unread count:', error);
    }
}

// Profile Functions
let isEditing = false;
let originalProfileData = null;

async function loadAlumniProfile() {
    try {
        const response = await API.get('/api/alumni/profile');
        displayAlumniProfile(response.alumni);
    } catch (error) {
        console.error('Failed to load profile:', error);
        showNotification('Failed to load profile: ' + error.message, 'danger');
    }
}

function displayAlumniProfile(alumni) {
    // Update basic info
    const profileName = document.getElementById('profileName');
    if (profileName) {
        profileName.textContent = alumni.user.full_name;
    }
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) {
        profileEmail.textContent = alumni.user.email;
    }
    
    // Display professional info
    const profileInfo = document.getElementById('profileInfo');
    profileInfo.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="text-muted mb-1">Graduation Year</label>
                <p class="fw-bold" id="displayGraduationYear">${alumni.graduation_year || 'Not set'}</p>
                <input type="number" class="form-control edit-field" id="editGraduationYear" value="${alumni.graduation_year || ''}" style="display: none;">
            </div>
            <div class="col-md-6 mb-3">
                <label class="text-muted mb-1">Degree</label>
                <p class="fw-bold" id="displayDegree">${alumni.degree || 'Not set'}</p>
                <input type="text" class="form-control edit-field" id="editDegree" value="${alumni.degree || ''}" style="display: none;">
            </div>
            <div class="col-md-6 mb-3">
                <label class="text-muted mb-1">Current Company</label>
                <p class="fw-bold" id="displayCompany">${alumni.current_company || 'Not set'}</p>
                <input type="text" class="form-control edit-field" id="editCompany" value="${alumni.current_company || ''}" style="display: none;">
            </div>
            <div class="col-md-6 mb-3">
                <label class="text-muted mb-1">Job Title</label>
                <p class="fw-bold" id="displayJobTitle">${alumni.job_title || 'Not set'}</p>
                <input type="text" class="form-control edit-field" id="editJobTitle" value="${alumni.job_title || ''}" style="display: none;">
            </div>
            <div class="col-12 mb-3">
                <label class="text-muted mb-1">LinkedIn URL</label>
                <p class="fw-bold" id="displayLinkedIn">${alumni.linkedin_url || 'Not set'}</p>
                <input type="url" class="form-control edit-field" id="editLinkedIn" value="${alumni.linkedin_url || ''}" style="display: none;">
            </div>
        </div>
    `;
    
    // Display bio
    const bioSection = document.getElementById('bioSection');
    bioSection.innerHTML = `
        <div>
            <p id="displayBio">${alumni.bio || 'No bio provided yet.'}</p>
            <textarea class="form-control edit-field" id="editBio" rows="4" style="display: none;">${alumni.bio || ''}</textarea>
        </div>
    `;
    
    // Store original data for cancel
    originalProfileData = alumni;
}

function toggleEditMode() {
    isEditing = !isEditing;
    
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const displayFields = document.querySelectorAll('[id^="display"]');
    const editFields = document.querySelectorAll('.edit-field');
    
    if (isEditing) {
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        displayFields.forEach(field => field.style.display = 'none');
        editFields.forEach(field => field.style.display = 'block');
    } else {
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        displayFields.forEach(field => field.style.display = 'block');
        editFields.forEach(field => field.style.display = 'none');
    }
}

async function saveProfile() {
    const updatedData = {
        graduation_year: parseInt(document.getElementById('editGraduationYear').value),
        degree: document.getElementById('editDegree').value,
        current_company: document.getElementById('editCompany').value,
        job_title: document.getElementById('editJobTitle').value,
        bio: document.getElementById('editBio').value,
        linkedin_url: document.getElementById('editLinkedIn').value
    };
    
    try {
        const response = await API.put('/api/alumni/profile', updatedData);
        showNotification('Profile updated successfully!', 'success');
        toggleEditMode();
        loadAlumniProfile(); // Reload profile
    } catch (error) {
        console.error('Failed to update profile:', error);
        showNotification('Failed to update profile: ' + error.message, 'danger');
    }
}

function cancelEdit() {
    toggleEditMode();
    loadAlumniProfile(); // Reload original data
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners for Chat page
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    // Handle chat page specific initialization
    if (window.location.pathname.includes('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        if (tab === 'students') {
            currentTab = 'students';
            document.getElementById('tabStudents').classList.add('active');
            document.getElementById('tabTeachers').classList.remove('active');
        } else if (tab === 'teachers') {
            currentTab = 'teachers';
            document.getElementById('tabTeachers').classList.add('active');
            document.getElementById('tabStudents').classList.remove('active');
        }
        
        document.getElementById('tabStudents').addEventListener('click', () => {
            currentTab = 'students';
            document.getElementById('tabStudents').classList.add('active');
            document.getElementById('tabTeachers').classList.remove('active');
            loadUsers();
        });
        
        document.getElementById('tabTeachers').addEventListener('click', () => {
            currentTab = 'teachers';
            document.getElementById('tabTeachers').classList.add('active');
            document.getElementById('tabStudents').classList.remove('active');
            loadUsers();
        });
        
        loadUsers();
        
        const selectedUser = urlParams.get('user');
        if (selectedUser) {
            setTimeout(() => {
                // Find user in list and select
                const userElement = document.querySelector(`.chat-user-item[onclick*="${selectedUser}"]`);
                if (userElement) {
                    userElement.click();
                }
            }, 1000);
        }
        
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        // Load unread count periodically
        setInterval(loadUnreadCount, 30000);
        loadUnreadCount();
    }
    
    // Handle profile page
    if (window.location.pathname.includes('profile.html')) {
        loadAlumniProfile();
    }
});