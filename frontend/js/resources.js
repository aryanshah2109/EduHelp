// Resources page functionality

async function loadCourseResources() {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('course_id');
    
    if (!courseId) {
        showNotification('No course selected. Redirecting...', 'warning');
        setTimeout(() => {
            window.location.href = 'courses.html';
        }, 2000);
        return;
    }
    
    try {
        console.log('Loading resources for course:', courseId);
        const response = await API.get(`/api/teacher/resources?course_id=${courseId}`);
        console.log('Resources response:', response);
        displayCourseResources(response);
    } catch (error) {
        console.error('Failed to load resources:', error);
        showNotification('Failed to load resources. Please try again.', 'danger');
    }
}

function displayCourseResources(data) {
    const container = document.getElementById('resourcesContainer');
    const courseTitle = document.getElementById('courseTitle');
    
    if (data && data.course) {
        courseTitle.textContent = data.course.title;
    }
    
    if (!data || !data.resources || data.resources.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="mt-5">
                    <i class="fas fa-folder-open fa-4x text-muted mb-3 d-block"></i>
                    <h4 class="text-muted">No Resources Yet</h4>
                    <p class="text-muted">This course doesn't have any resources uploaded yet.</p>
                    <a href="upload.html" class="btn btn-primary">
                        <i class="fas fa-upload me-2"></i>Upload First Resource
                    </a>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.resources.map(resource => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="dashboard-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-start mb-3">
                        <div class="flex-grow-1">
                            <h5 class="card-title">${resource.title}</h5>
                            <small class="text-muted d-block mb-2">
                                <i class="fas fa-file me-1"></i>
                                ${getFileTypeIcon(resource.resource_type)} ${resource.resource_type.toUpperCase()}
                            </small>
                        </div>
                    </div>
                    
                    <p class="card-text text-muted">${resource.description || 'No description'}</p>
                    
                    <div class="mb-3">
                        <small class="text-muted d-block">
                            <i class="fas fa-calendar me-1"></i>
                            ${formatDate(resource.created_at)}
                        </small>
                    </div>
                    
                    <div class="d-grid gap-2">
                        <button class="btn btn-sm btn-primary" onclick="downloadResource('${resource.file_path}', '${resource.title}')">
                            <i class="fas fa-download me-1"></i>Download
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="deleteResource(${resource.id})">
                            <i class="fas fa-trash me-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function getFileTypeIcon(type) {
    const icons = {
        'pdf': '<i class="fas fa-file-pdf text-danger"></i>',
        'video': '<i class="fas fa-video text-primary"></i>',
        'note': '<i class="fas fa-sticky-note text-warning"></i>',
        'slide': '<i class="fas fa-presentation text-info"></i>',
        'assignment': '<i class="fas fa-tasks text-success"></i>'
    };
    return icons[type] || '<i class="fas fa-file"></i>';
}

function downloadResource(filePath, title) {
    try {
        // Open file in new tab
        const fileUrl = `http://127.0.0.1:8000/${filePath}`;
        window.open(fileUrl, '_blank');
        showNotification('Opening resource in new tab...', 'info');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to open resource', 'danger');
    }
}

async function deleteResource(resourceId) {
    if (!confirm('Are you sure you want to delete this resource?')) {
        return;
    }
    
    try {
        // Note: You may need to add a DELETE endpoint to your backend
        await API.request(`/api/teacher/resources/${resourceId}`, {
            method: 'DELETE'
        });
        showNotification('Resource deleted successfully!', 'success');
        // Reload the resources list
        loadCourseResources();
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete resource', 'danger');
    }
}

function viewAllResources() {
    // Get the currently selected course from the form, or redirect to courses
    const courseSelect = document.getElementById('course_id');
    if (courseSelect && courseSelect.value) {
        window.location.href = `resources.html?course_id=${courseSelect.value}`;
    } else {
        showNotification('Please select a course first', 'warning');
    }
}

// Setup on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only load resources if we're on the resources.html page
    if (window.location.pathname.includes('resources.html')) {
        redirectIfNotLoggedIn();
        loadTeacherName();
        loadCourseResources();
        
        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.logout();
            });
        }
    }
});
