async function loadStudentDashboard() {
    try {
        const dashboardData = await API.get('/api/student/dashboard');
        displayDashboardData(dashboardData);
    } catch (error) {
        showNotification('Failed to load dashboard data', 'danger');
    }
}

function displayDashboardData(data) {
    // Update basic info
    document.getElementById('studentName').textContent = data.student.user.full_name;
    document.getElementById('courseCount').textContent = data.enrollments.length;
    
    // Calculate average attendance
    const avgAttendance = data.attendance.reduce((sum, item) => sum + item.attendance_rate, 0) / data.attendance.length;
    document.getElementById('attendanceRate').textContent = `${(avgAttendance * 100).toFixed(1)}%`;
    
    // Update pending assignments (simplified)
    document.getElementById('pendingAssignments').textContent = data.recent_assignments.length;
    
    // Display courses
    const coursesList = document.getElementById('coursesList');
    coursesList.innerHTML = data.enrollments.map(enrollment => `
        <div class="d-flex align-items-center mb-3">
            <div class="flex-grow-1">
                <h6 class="mb-1">${enrollment.course.title}</h6>
                <small class="text-muted">${enrollment.course.description}</small>
            </div>
            <span class="badge bg-primary">Enrolled</span>
        </div>
    `).join('');
    
    // Display assignments
    const assignmentsList = document.getElementById('assignmentsList');
    assignmentsList.innerHTML = data.recent_assignments.map(assignment => `
        <div class="d-flex align-items-center mb-3">
            <div class="flex-grow-1">
                <h6 class="mb-1">${assignment.title}</h6>
                <small class="text-muted">Due: ${formatDate(assignment.due_date)}</small>
            </div>
            <span class="badge bg-warning">Pending</span>
        </div>
    `).join('');
    
    // Load AI insights
    loadAIInsights(data.student.id);
}

async function loadAIInsights(studentId) {
    try {
        // For demo, we'll use the first course
        const performanceData = await API.get(`/api/student/performance/1`);
        displayAIInsights(performanceData);
    } catch (error) {
        console.error('Failed to load AI insights:', error);
    }
}

function displayAIInsights(performanceData) {
    const aiInsights = document.getElementById('aiInsights');
    const prediction = performanceData.prediction;
    
    // Update risk level
    document.getElementById('riskLevel').textContent = prediction.risk_level.charAt(0).toUpperCase() + prediction.risk_level.slice(1);
    document.getElementById('riskLevel').className = `h5 mb-0 font-weight-bold risk-${prediction.risk_level}`;
    
    aiInsights.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Performance Analysis</h6>
                <div class="mb-3">
                    <small class="text-muted">Risk Probability: ${(prediction.risk_probability * 100).toFixed(1)}%</small>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar bg-${prediction.risk_level === 'high' ? 'danger' : prediction.risk_level === 'medium' ? 'warning' : 'success'}" 
                             style="width: ${prediction.risk_probability * 100}%"></div>
                    </div>
                </div>
                <p class="mb-2"><strong>Status:</strong> 
                    <span class="risk-${prediction.risk_level}">
                        ${prediction.at_risk ? 'At Risk - Needs Attention' : 'On Track'}
                    </span>
                </p>
            </div>
            <div class="col-md-6">
                <h6>Recommendations</h6>
                <ul class="list-unstyled">
                    ${prediction.recommendations.map(rec => `<li><i class="fas fa-check text-success me-2"></i>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="fas fa-lightbulb me-2"></i>
                    <strong>AI Insight:</strong> Based on your current performance metrics, our AI suggests focusing on 
                    ${prediction.recommendations[0]?.toLowerCase() || 'maintaining your current study habits'}.
                </div>
            </div>
        </div>
    `;
}

// Course management
// Student-specific functionality

async function loadStudentCourses() {
    try {
        const courses = await API.get('/api/student/courses');
        displayStudentCourses(courses);
    } catch (error) {
        console.error('Failed to load courses:', error);
        showNotification('Failed to load courses. Please try again.', 'danger');
        document.getElementById('coursesContainer').innerHTML = `
            <div class="col-12 text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-muted mb-3"></i>
                <h4 class="text-muted">Unable to Load Courses</h4>
                <p class="text-muted">Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadStudentCourses()">
                    <i class="fas fa-redo me-2"></i>Retry
                </button>
            </div>
        `;
    }
}

function displayStudentCourses(courses) {
    const container = document.getElementById('coursesContainer');
    const noCoursesMessage = document.getElementById('noCoursesMessage');

    if (!courses || courses.length === 0) {
        container.style.display = 'none';
        noCoursesMessage.style.display = 'block';
        return;
    }

    container.innerHTML = courses.map(courseData => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="dashboard-card h-100">
                <div class="card-body">
                    <h5 class="card-title">${courseData.course.title}</h5>
                    <p class="card-text">${courseData.course.description}</p>
                    
                    <div class="mb-3">
                        <small class="text-muted">
                            <i class="fas fa-chalkboard-teacher me-1"></i>
                            ${courseData.course.teacher.user.full_name}
                        </small>
                    </div>
                    
                    <div class="mb-3">
                        <small class="text-muted">
                            <i class="fas fa-book me-1"></i>
                            ${courseData.resources.length} resources
                        </small>
                        <br>
                        <small class="text-muted">
                            <i class="fas fa-tasks me-1"></i>
                            ${courseData.assignments.length} assignments
                        </small>
                    </div>
                    
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="viewCourseResources(${courseData.course.id})">
                            <i class="fas fa-folder-open me-1"></i>Resources
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="viewCourseAssignments(${courseData.course.id})">
                            <i class="fas fa-tasks me-1"></i>Assignments
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function viewCourseResources(courseId) {
    showNotification(`Loading resources for course ${courseId}...`, 'info');
    // Implementation for viewing course resources
    setTimeout(() => {
        showNotification('Resource viewing feature coming soon!', 'info');
    }, 1000);
}

function viewCourseAssignments(courseId) {
    showNotification(`Loading assignments for course ${courseId}...`, 'info');
    // Implementation for viewing course assignments
    setTimeout(() => {
        showNotification('Assignment viewing feature coming soon!', 'info');
    }, 1000);
}

function exploreCourses() {
    showNotification('Course exploration feature coming soon!', 'info');
}

// Setup logout button
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    // Load initial dashboard data
    redirectIfNotLoggedIn();
    loadStudentDashboard();
});