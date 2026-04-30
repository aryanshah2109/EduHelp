async function loadStudentName() {
    try {
        const userInfo = await API.get('/auth/me');
        const studentNameElements = document.querySelectorAll('#studentName');
        studentNameElements.forEach(el => {
            el.textContent = userInfo.full_name || 'Student';
        });
    } catch (error) {
        console.error('Error loading student name:', error);
    }
}

async function loadStudentDashboard() {
    try {
        console.log('Loading student dashboard...');
        const dashboardData = await API.get('/api/student/dashboard');
        console.log('Dashboard data received:', dashboardData);
        displayDashboardData(dashboardData);
    } catch (error) {
        console.error('Dashboard error:', error);
        const coursesList = document.getElementById('coursesList');
        if (coursesList) {
            coursesList.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load dashboard data: ${error.message}
                </div>
            `;
        }
        loadStudentName();
    }
}

function displayDashboardData(data) {
    // Update basic info
    const studentNameEl = document.getElementById('studentName');
    if (studentNameEl && data.student && data.student.user) {
        studentNameEl.textContent = data.student.user.full_name;
    }
    
    const courseCountEl = document.getElementById('courseCount');
    if (courseCountEl) {
        courseCountEl.textContent = data.enrollments ? data.enrollments.length : 0;
    }
    
    // Calculate average attendance
    let avgAttendance = 0;
    if (data.attendance && data.attendance.length > 0) {
        avgAttendance = data.attendance.reduce((sum, item) => sum + item.attendance_rate, 0) / data.attendance.length;
    }
    const attendanceRateEl = document.getElementById('attendanceRate');
    if (attendanceRateEl) {
        attendanceRateEl.textContent = `${(avgAttendance * 100).toFixed(1)}%`;
    }
    
    // Display courses
    const coursesList = document.getElementById('coursesList');
    if (coursesList) {
        if (!data.enrollments || data.enrollments.length === 0) {
            coursesList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-book fa-3x mb-3 d-block"></i>
                    <p>No courses enrolled yet.</p>
                </div>
            `;
        } else {
            coursesList.innerHTML = data.enrollments.map(enrollment => `
                <div class="d-flex align-items-center mb-3">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${escapeHtml(enrollment.course.title)}</h6>
                        <small class="text-muted">${escapeHtml(enrollment.course.description || 'No description')}</small>
                    </div>
                    <span class="badge bg-primary">Enrolled</span>
                </div>
            `).join('');
        }
    }
    
    // Load AI insights
    if (data.enrollments && data.enrollments.length > 0 && data.student) {
        loadAIInsights(data.student.id);
    }
}

async function loadAIInsights(studentId) {
    try {
        const performanceData = await API.get(`/api/student/performance/1`);
        displayAIInsights(performanceData);
    } catch (error) {
        console.error('Failed to load AI insights:', error);
        const aiInsights = document.getElementById('aiInsights');
        if (aiInsights) {
            aiInsights.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Unable to load AI insights at this time.
                </div>
            `;
        }
    }
}

function displayAIInsights(performanceData) {
    const aiInsights = document.getElementById('aiInsights');
    const riskLevelEl = document.getElementById('riskLevel');
    
    if (!performanceData || !performanceData.prediction) {
        if (aiInsights) {
            aiInsights.innerHTML = '<div class="alert alert-info">No performance data available yet.</div>';
        }
        return;
    }
    
    const prediction = performanceData.prediction;
    
    // Update risk level
    if (riskLevelEl) {
        const riskLevelText = prediction.risk_level.charAt(0).toUpperCase() + prediction.risk_level.slice(1);
        riskLevelEl.textContent = riskLevelText;
        riskLevelEl.className = `h5 mb-0 font-weight-bold risk-${prediction.risk_level}`;
    }
    
    if (aiInsights) {
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
                        ${prediction.recommendations.map(rec => `<li><i class="fas fa-check text-success me-2"></i>${escapeHtml(rec)}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-lightbulb me-2"></i>
                        <strong>AI Insight:</strong> Based on your current performance metrics, our AI suggests focusing on 
                        ${escapeHtml(prediction.recommendations[0]?.toLowerCase() || 'maintaining your current study habits')}.
                    </div>
                </div>
            </div>
        `;
    }
}

async function loadStudentCourses() {
    try {
        console.log('Loading student courses...');
        const courses = await API.get('/api/student/courses');
        console.log('Courses received:', courses);
        displayStudentCourses(courses);
    } catch (error) {
        console.error('Failed to load courses:', error);
        const container = document.getElementById('coursesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <i class="fas fa-exclamation-triangle fa-3x text-muted mb-3"></i>
                    <h4 class="text-muted">Unable to Load Courses</h4>
                    <p class="text-muted">${escapeHtml(error.message)}</p>
                    <button class="btn btn-primary" onclick="loadStudentCourses()">
                        <i class="fas fa-redo me-2"></i>Retry
                    </button>
                </div>
            `;
        }
        const noCoursesMessage = document.getElementById('noCoursesMessage');
        if (noCoursesMessage) {
            noCoursesMessage.style.display = 'none';
        }
    }
}

function displayStudentCourses(courses) {
    const container = document.getElementById('coursesContainer');
    const noCoursesMessage = document.getElementById('noCoursesMessage');

    if (!courses || courses.length === 0) {
        if (container) container.style.display = 'none';
        if (noCoursesMessage) noCoursesMessage.style.display = 'block';
        return;
    }

    if (container) {
        container.style.display = 'flex';
        container.innerHTML = courses.map(courseData => `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="dashboard-card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(courseData.course.title)}</h5>
                        <p class="card-text">${escapeHtml(courseData.course.description || 'No description')}</p>
                        
                        <div class="mb-3">
                            <small class="text-muted">
                                <i class="fas fa-chalkboard-teacher me-1"></i>
                                ${courseData.course.teacher && courseData.course.teacher.user ? escapeHtml(courseData.course.teacher.user.full_name) : 'Teacher'}
                            </small>
                        </div>
                        
                        <div class="mb-3">
                            <small class="text-muted">
                                <i class="fas fa-book me-1"></i>
                                ${courseData.resources ? courseData.resources.length : 0} resources
                            </small>
                            <br>
                            <small class="text-muted">
                                <i class="fas fa-tasks me-1"></i>
                                ${courseData.assignments ? courseData.assignments.length : 0} assignments
                            </small>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewCourseResources(${courseData.course.id}, '${escapeHtml(courseData.course.title)}')">
                                <i class="fas fa-folder-open me-1"></i>View Resources
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    if (noCoursesMessage) {
        noCoursesMessage.style.display = 'none';
    }
}

function viewCourseResources(courseId, courseName) {
    sessionStorage.setItem('viewingCourseId', courseId);
    sessionStorage.setItem('viewingCourseName', courseName);
    window.location.href = `resources.html`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadStudentProfile() {
    try {
        const dashboardData = await API.get('/api/student/dashboard');
        displayStudentProfile(dashboardData);
    } catch (error) {
        console.error('Profile error:', error);
        const academicInfo = document.getElementById('academicInfo');
        if (academicInfo) {
            academicInfo.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load profile: ${escapeHtml(error.message)}
                </div>
            `;
        }
    }
}

function displayStudentProfile(data) {
    const profileName = document.getElementById('profileName');
    if (profileName && data.student && data.student.user) {
        profileName.textContent = data.student.user.full_name;
    }
    
    const profileRole = document.getElementById('profileRole');
    if (profileRole && data.student && data.student.user) {
        profileRole.textContent = data.student.user.role.charAt(0).toUpperCase() + data.student.user.role.slice(1);
    }
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail && data.student && data.student.user) {
        profileEmail.textContent = data.student.user.email;
    }
    
    const academicInfo = document.getElementById('academicInfo');
    if (academicInfo) {
        academicInfo.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Grade Level:</strong> ${escapeHtml(data.student.grade_level || 'Not set')}</p>
                    <p><strong>Department:</strong> ${escapeHtml(data.student.department || 'Not set')}</p>
                    <p><strong>Student ID:</strong> ${data.student.id}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Username:</strong> ${escapeHtml(data.student.user.username)}</p>
                    <p><strong>Member Since:</strong> ${new Date(data.student.user.created_at).toLocaleDateString()}</p>
                </div>
            </div>
        `;
    }
    
    const coursesCount = document.getElementById('coursesCount');
    if (coursesCount && data.enrollments) {
        coursesCount.textContent = data.enrollments.length;
    }
    
    if (data.attendance && data.attendance.length > 0) {
        const avgAttendance = data.attendance.reduce((sum, item) => sum + item.attendance_rate, 0) / data.attendance.length;
        const attendanceRate = document.getElementById('attendanceRate');
        if (attendanceRate) {
            attendanceRate.textContent = `${(avgAttendance * 100).toFixed(1)}%`;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    redirectIfNotLoggedIn();
    loadStudentName();
    
    if (document.getElementById('coursesList')) {
        loadStudentDashboard();
    }
    
    if (document.getElementById('coursesContainer')) {
        loadStudentCourses();
    }
    
    if (document.getElementById('profileName')) {
        loadStudentProfile();
    }
});