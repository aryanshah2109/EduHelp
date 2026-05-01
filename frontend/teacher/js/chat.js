// Teacher Chat Functions
let currentChatUser = null;
let ws = null;
let currentTab = 'alumni';
let currentUserId = null;

async function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.getElementById('tabAlumni').classList.remove('active');
    document.getElementById('tabStudents').classList.remove('active');
    if (tab === 'alumni') {
        document.getElementById('tabAlumni').classList.add('active');
        await loadAlumniForTeacher();
    } else {
        document.getElementById('tabStudents').classList.add('active');
        await loadStudentsForTeacher();
    }
}

async function loadAlumniForTeacher() {
    try {
        console.log('Loading alumni list for teacher...');
        const response = await API.get('/api/chat/alumni');
        console.log('Alumni loaded:', response);
        displayContactsList(response, 'alumni');
    } catch (error) {
        console.error('Failed to load alumni:', error);
        document.getElementById('usersList').innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
                <p>Failed to load alumni: ${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadAlumniForTeacher()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        `;
    }
}

async function loadStudentsForTeacher() {
    try {
        console.log('Loading students list for teacher...');
        const response = await API.get('/api/chat/students');
        console.log('Students loaded:', response);
        displayContactsList(response, 'student');
    } catch (error) {
        console.error('Failed to load students:', error);
        document.getElementById('usersList').innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
                <p>Failed to load students: ${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadStudentsForTeacher()">
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
                <p>No ${type}s available at the moment.</p>
            </div>
        `;
        return;
    }
    
    usersListDiv.innerHTML = users.map(user => `
        <div class="chat-user-item" onclick='selectContact(${JSON.stringify(user)}, "${type}")'>
            <div class="d-flex align-items-center">
                <div class="user-avatar me-3">
                    ${escapeHtml(user.full_name.charAt(0))}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">${escapeHtml(user.full_name)}</h6>
                        <span class="${type === 'alumni' ? 'alumni-badge' : 'student-badge'}">
                            ${type === 'alumni' ? '<i class="fas fa-graduation-cap me-1"></i>Alumni' : '<i class="fas fa-user-graduate me-1"></i>Student'}
                        </span>
                    </div>
                    <small class="text-muted">@${escapeHtml(user.username)}</small>
                    ${type === 'alumni' ? '<div class="small text-success"><i class="fas fa-briefcase me-1"></i>Industry Professional</div>' : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function selectContact(user, userType) {
    currentChatUser = { id: user.id, name: user.full_name, role: userType };
    
    // Update chat header
    document.getElementById('chatUserName').textContent = user.full_name;
    const roleText = userType === 'alumni' ? 'Alumni Mentor' : 'Student';
    const roleIcon = userType === 'alumni' ? '<i class="fas fa-graduation-cap me-1"></i>' : '<i class="fas fa-user-graduate me-1"></i>';
    document.getElementById('chatUserRole').innerHTML = roleIcon + roleText;
    document.getElementById('chatAvatar').textContent = user.full_name.charAt(0);
    
    // Enable input
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    // Load messages
    await loadMessages(user.id);
    
    // Connect WebSocket
    connectWebSocket();
    
    // Highlight selected user
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
        const welcomeMessage = currentChatUser.role === 'alumni' 
            ? 'Start a conversation with this alumni. They can provide valuable industry insights and mentorship!'
            : 'Start a conversation with this student to provide guidance and support.';
        
        messagesContainer.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-comments fa-3x mb-3 d-block"></i>
                <p>No messages yet. Start the conversation!</p>
                <small>${welcomeMessage}</small>
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
    
    // Scroll to bottom
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
            // If message is from current chat user, display it
            if (data.sender_id === currentChatUser?.id) {
                appendMessage(data);
            }
            // Update unread count
            loadUnreadCount();
            // Play notification sound for new messages
            if (data.sender_id !== currentUserId) {
                playNotificationSound();
            }
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
        await API.post(`/api/chat/send?receiver_id=${currentChatUser.id}&message=${encodeURIComponent(message)}`, {});
        
        // Clear input
        messageInput.value = '';
        
        // Append message to chat
        appendMessage({
            sender_id: currentUserId,
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

function playNotificationSound() {
    try {
        const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
        console.log('Notification sound not available');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    // Check if we're on chat page
    if (window.location.pathname.includes('chat.html')) {
        redirectIfNotLoggedIn();
        
        const userRole = Auth.getUserRole();
        if (userRole !== 'teacher') {
            showNotification('Access denied. Redirecting...', 'danger');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        // Get current user ID
        await getCurrentUserIdFromAPI();
        
        // Set up tab buttons
        document.getElementById('tabAlumni').addEventListener('click', () => switchTab('alumni'));
        document.getElementById('tabStudents').addEventListener('click', () => switchTab('students'));
        
        // Load initial tab
        await switchTab('alumni');
        
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
});