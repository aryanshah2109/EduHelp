let currentChatUser = null;
let ws = null;
let currentTab = 'students';
let currentUserId = null;
let studentsList = [];
let teachersList = [];

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
    const alumniName = document.getElementById('alumniName');
    if (alumniName && data.alumni && data.alumni.user) {
        alumniName.textContent = data.alumni.user.full_name;
    }
    
    const unreadCount = document.getElementById('unreadCount');
    if (unreadCount) {
        unreadCount.textContent = data.unread_messages || 0;
    }
    
    const connectionsCount = document.getElementById('connectionsCount');
    if (connectionsCount) {
        connectionsCount.textContent = data.connections_count || 0;
    }
    
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

async function switchTab(tab) {
    currentTab = tab;
    
    document.getElementById('tabStudents').classList.remove('active');
    document.getElementById('tabTeachers').classList.remove('active');
    if (tab === 'students') {
        document.getElementById('tabStudents').classList.add('active');
        await loadStudentsForAlumni();
    } else {
        document.getElementById('tabTeachers').classList.add('active');
        await loadTeachersForAlumni();
    }
}

async function loadStudentsForAlumni() {
    try {
        console.log('Loading students list for alumni...');
        const response = await API.get('/api/alumni/students');
        studentsList = response;
        displayContactsList(studentsList, 'student');
    } catch (error) {
        console.error('Failed to load students:', error);
        document.getElementById('usersList').innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
                <p>Failed to load students: ${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadStudentsForAlumni()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        `;
    }
}

async function loadTeachersForAlumni() {
    try {
        console.log('Loading teachers list for alumni...');
        const response = await API.get('/api/alumni/teachers');
        teachersList = response;
        displayContactsList(teachersList, 'teacher');
    } catch (error) {
        console.error('Failed to load teachers:', error);
        document.getElementById('usersList').innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
                <p>Failed to load teachers: ${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadTeachersForAlumni()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        `;
    }
}

function displayContactsList(users, type) {
    const usersListDiv = document.getElementById('usersList');
    
    if (!users || users.length === 0) {
        usersListDiv.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-users fa-3x mb-3 d-block"></i>
                <p>No ${type}s found</p>
            </div>
        `;
        return;
    }
    
    const badgeClass = type === 'student' ? 'student-badge' : 'teacher-badge';
    const badgeIcon = type === 'student' ? '<i class="fas fa-user-graduate me-1"></i>Student' : '<i class="fas fa-chalkboard-teacher me-1"></i>Teacher';
    
    usersListDiv.innerHTML = users.map(user => `
        <div class="chat-user-item" onclick='selectContact(${JSON.stringify(user)}, "${type}")'>
            <div class="d-flex align-items-center">
                <div class="user-avatar me-3">
                    ${escapeHtml(user.full_name.charAt(0))}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">${escapeHtml(user.full_name)}</h6>
                        <span class="${badgeClass}">
                            ${badgeIcon}
                        </span>
                    </div>
                    <small class="text-muted">@${escapeHtml(user.username)}</small>
                </div>
            </div>
        </div>
    `).join('');
}

async function selectContact(user, userType) {
    currentChatUser = { id: user.id, name: user.full_name, role: userType };
    
    document.getElementById('chatUserName').textContent = user.full_name;
    const roleText = userType === 'student' ? 'Student' : 'Teacher';
    const roleIcon = userType === 'student' ? '<i class="fas fa-user-graduate me-1"></i>' : '<i class="fas fa-chalkboard-teacher me-1"></i>';
    document.getElementById('chatUserRole').innerHTML = roleIcon + roleText;
    document.getElementById('chatAvatar').textContent = user.full_name.charAt(0);
    
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    await loadMessages(user.id);
    connectWebSocket();
    
    document.querySelectorAll('.chat-user-item').forEach(el => {
        el.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
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
                <button class="btn btn-primary btn-sm" onclick="loadMessages(${otherUserId})">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
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
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function connectWebSocket() {
    if (ws) {
        ws.close();
    }
    
    const token = Auth.getToken();
    if (!token) {
        console.error('No token available');
        return;
    }
    
    ws = new WebSocket(`ws://127.0.0.1:8000/api/chat/ws/${token}`);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'message' || data.type === 'new_message') {
            if (data.sender_id === currentChatUser?.id) {
                appendMessage(data);
            }
            loadUnreadCount();
        }
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        setTimeout(connectWebSocket, 5000);
    };
}

function appendMessage(messageData) {
    const messagesContainer = document.getElementById('messagesContainer');
    const isSent = messageData.sender_id === currentUserId;
    
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
        await API.post(`/api/chat/send?receiver_id=${currentChatUser.id}&message=${encodeURIComponent(message)}`, {});
        
        messageInput.value = '';
        
        appendMessage({
            sender_id: currentUserId,
            message: message,
            created_at: new Date().toISOString()
        });
        
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

async function getCurrentUserIdFromAPI() {
    try {
        const userInfo = await API.get('/auth/me');
        currentUserId = userInfo.id;
        localStorage.setItem('user_id', currentUserId);
        console.log('Current user ID:', currentUserId);
        return currentUserId;
    } catch (error) {
        console.error('Failed to get user ID:', error);
        return null;
    }
}

async function loadUnreadCount() {
    try {
        const response = await API.get('/api/chat/unread-count');
        const unreadCount = response.unread_count;
        const badge = document.getElementById('unreadBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to load unread count:', error);
    }
}

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
    const profileName = document.getElementById('profileName');
    if (profileName) {
        profileName.textContent = alumni.user.full_name;
    }
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) {
        profileEmail.textContent = alumni.user.email;
    }
    
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
    
    const bioSection = document.getElementById('bioSection');
    bioSection.innerHTML = `
        <div>
            <p id="displayBio">${alumni.bio || 'No bio provided yet.'}</p>
            <textarea class="form-control edit-field" id="editBio" rows="4" style="display: none;">${alumni.bio || ''}</textarea>
        </div>
    `;
    
    originalProfileData = alumni;
}

let isEditing = false;
let originalProfileData = null;

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
        loadAlumniProfile();
    } catch (error) {
        console.error('Failed to update profile:', error);
        showNotification('Failed to update profile: ' + error.message, 'danger');
    }
}

function cancelEdit() {
    toggleEditMode();
    loadAlumniProfile();
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

document.addEventListener('DOMContentLoaded', async function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    if (window.location.pathname.includes('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        
        await getCurrentUserIdFromAPI();
        
        document.getElementById('tabStudents').addEventListener('click', () => switchTab('students'));
        document.getElementById('tabTeachers').addEventListener('click', () => switchTab('teachers'));
        
        if (tab === 'teachers') {
            await switchTab('teachers');
        } else {
            await switchTab('students');
        }
        
        const selectedUser = urlParams.get('user');
        if (selectedUser) {
            setTimeout(() => {
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
        
        setInterval(loadUnreadCount, 30000);
        loadUnreadCount();
    }
    
    if (window.location.pathname.includes('profile.html')) {
        loadAlumniProfile();
    }
    
    if (window.location.pathname.includes('dashboard.html')) {
        loadAlumniDashboard();
    }
});