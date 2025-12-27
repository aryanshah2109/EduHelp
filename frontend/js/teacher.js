async function loadTeacherName() {
    try {
        const userInfo = await API.get('/auth/me');
        const teacherNameElements = document.querySelectorAll('#teacherName');
        teacherNameElements.forEach(el => {
            el.textContent = userInfo.full_name || 'Teacher';
        });
    } catch (error) {
        console.error('Error loading teacher name:', error);
    }
}

async function loadCoursesForDropdown() {
    try {
        const courses = await API.get('/api/teacher/courses');
        const courseSelect = document.getElementById('course_id');
        
        if (courseSelect && courses && courses.length > 0) {
            // Clear existing options except the first one
            courseSelect.innerHTML = '<option value="">Select course</option>';
            
            // Add course options
            courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.title;
                courseSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading courses for dropdown:', error);
    }
}

async function loadTeacherDashboard() {
    try {
        const dashboardData = await API.get('/api/teacher/dashboard');
        displayTeacherDashboard(dashboardData);
    } catch (error) {
        console.error('Dashboard error:', error);
        // Only show error if we're on the dashboard page
        const coursesList = document.getElementById('teacherCoursesList');
        if (coursesList) {
            showNotification('Failed to load dashboard data', 'danger');
        }
        // Still allow page to display without data
        loadTeacherName();
    }
}

function displayTeacherDashboard(data) {
    // Update basic info
    document.getElementById('teacherName').textContent = data.teacher.user.full_name;
    document.getElementById('totalCourses').textContent = data.courses.length;
    
    // Calculate totals
    const totalStudents = data.courses.reduce((sum, course) => sum + course.student_count, 0);
    const totalResources = data.courses.reduce((sum, course) => sum + course.resource_count, 0);
    
    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('totalResources').textContent = totalResources;
    
    // Display courses
    const coursesList = document.getElementById('teacherCoursesList');
    if (data.courses.length === 0) {
        coursesList.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-book fa-3x mb-3 d-block"></i>
                <p>No courses yet. Create your first course to get started!</p>
            </div>
        `;
    } else {
        coursesList.innerHTML = data.courses.map(course => `
            <div class="d-flex align-items-center mb-3">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${course.course.title}</h6>
                    <small class="text-muted">
                        ${course.student_count} students • ${course.assignment_count} assignments • ${course.resource_count} resources
                    </small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="viewCourseAnalytics(${course.course.id})">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="manageCourse(${course.course.id})">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // Load teacher insights if there are courses
    if (data.courses.length > 0) {
        loadTeacherInsights(data.courses[0]?.course.id);
    }
}

async function loadTeacherInsights(courseId) {
    if (!courseId) return;
    
    try {
        const analytics = await API.get(`/api/teacher/analytics/${courseId}`);
        displayTeacherInsights(analytics);
    } catch (error) {
        console.error('Failed to load teacher insights:', error);
    }
}

function displayTeacherInsights(analytics) {
    const teacherInsights = document.getElementById('teacherInsights');
    
    const atRiskCount = analytics.analytics.filter(a => a.risk_prediction.risk_level === 'high').length;
    document.getElementById('atRiskStudents').textContent = atRiskCount;
    
    teacherInsights.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Class Overview - ${analytics.course.title}</h6>
                <p><strong>Total Students:</strong> ${analytics.analytics.length}</p>
                <p><strong>At-Risk Students:</strong> <span class="risk-high">${atRiskCount}</span></p>
                <p><strong>Average Performance:</strong> 
                    ${(analytics.analytics.reduce((sum, a) => sum + a.assignment_avg, 0) / analytics.analytics.length).toFixed(1)}%
                </p>
            </div>
            <div class="col-md-6">
                <h6>Top Recommendations</h6>
                <ul class="list-unstyled">
                    <li><i class="fas fa-bullhorn text-warning me-2"></i>Reach out to ${atRiskCount} at-risk students</li>
                    <li><i class="fas fa-video text-info me-2"></i>Create additional video resources</li>
                    <li><i class="fas fa-users text-success me-2"></i>Schedule group study sessions</li>
                </ul>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>AI Alert:</strong> ${atRiskCount} students in this course are identified as high-risk. 
                    Consider providing additional support and resources.
                </div>
            </div>
        </div>
    `;
}

// Teacher-specific functionality

async function createCourse() {
    const title = document.getElementById('courseTitle').value;
    const description = document.getElementById('courseDescription').value;
    
    if (!title || !description) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        await API.post('/api/teacher/courses', {
            title: title,
            description: description,
            teacher_id: 1 // This would come from backend in real app
        });
        
        showNotification('Course created successfully!', 'success');
        document.getElementById('createCourseForm').reset();
        bootstrap.Modal.getInstance(document.getElementById('createCourseModal')).hide();
        
        // Reload courses
        loadTeacherCourses();
    } catch (error) {
        console.error('Failed to create course:', error);
        showNotification('Failed to create course. Please try again.', 'danger');
    }
}

async function loadTeacherCourses() {
    try {
        const courses = await API.get('/api/teacher/courses');
        displayTeacherCourses(courses);
    } catch (error) {
        console.error('Failed to load courses:', error);
        // Don't show error notification, just display empty state
        const container = document.getElementById('teacherCoursesContainer');
        const noCoursesMessage = document.getElementById('noCoursesMessage');
        
        if (container) container.style.display = 'none';
        if (noCoursesMessage) {
            noCoursesMessage.style.display = 'block';
            noCoursesMessage.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-book fa-4x mb-3 d-block"></i>
                    <h4>No Courses Yet</h4>
                    <p>Create your first course to get started!</p>
                    <button class="btn btn-primary" onclick="document.getElementById('createCourseModal') && bootstrap.Modal.getOrCreateInstance(document.getElementById('createCourseModal')).show()">
                        <i class="fas fa-plus me-2"></i>Create Course
                    </button>
                </div>
            `;
        }
    }
}

function displayTeacherCourses(courses) {
    const container = document.getElementById('teacherCoursesContainer');
    const noCoursesMessage = document.getElementById('noCoursesMessage');

    if (!courses || courses.length === 0) {
        container.style.display = 'none';
        noCoursesMessage.style.display = 'block';
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="dashboard-card h-100">
                <div class="card-body">
                    <h5 class="card-title">${course.title}</h5>
                    <p class="card-text">${course.description}</p>
                    <div class="mb-3">
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            Created: ${new Date(course.created_at).toLocaleDateString()}
                        </small>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="viewCourseAnalytics(${course.id})">
                            <i class="fas fa-chart-bar me-1"></i>Analytics
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="manageCourse(${course.id})">
                            <i class="fas fa-cog me-1"></i>Manage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function viewCourseAnalytics(courseId) {
    window.location.href = `analytics.html?course_id=${courseId}`;
}

function manageCourse(courseId) {
    showNotification(`Managing course ${courseId} - feature coming soon!`, 'info');
}

// Resource upload functionality
// Resource upload functionality - FIXED VERSION
async function uploadResource(event) {
    // ADD THIS LINE to prevent page reload
    if (event) {
        event.preventDefault();
        event.stopPropagation(); // Also prevent event bubbling
    }
    
    const form = document.getElementById('uploadResourceForm');
    if (!form) return;
    
    const formData = new FormData(form);
    
    try {
        console.log('Uploading resource...');
        const response = await API.upload('/api/teacher/resources', formData);
        console.log('Upload response:', response);
        showNotification('✅ Resource uploaded successfully!', 'success');
        form.reset();
        loadCoursesForDropdown(); // Refresh the dropdown
    } catch (error) {
        console.error('Upload error:', error);
        showNotification(`❌ Failed to upload resource: ${error.message}`, 'danger');
    }
}

// Setup logout button and load teacher name on all pages
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    // Setup upload form submit handler
    const uploadForm = document.getElementById('uploadResourceForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', uploadResource);
    }
    
    // Load initial setup
    redirectIfNotLoggedIn();
    // Load teacher name on all pages
    loadTeacherName();
    // Load courses for dropdown if on upload page
    if (document.getElementById('course_id')) {
        loadCoursesForDropdown();
    }
    // Load dashboard data only if dashboard elements exist
    if (document.getElementById('teacherCoursesList')) {
        loadTeacherDashboard();
    }
});