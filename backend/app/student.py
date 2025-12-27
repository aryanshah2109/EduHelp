from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

# Relative imports
from . import models
from .auth import get_current_active_user
from .database import get_db
from .ml_models import performance_predictor
import numpy as np

router = APIRouter(prefix="/student", tags=["student"])

@router.get("/dashboard")
async def get_student_dashboard(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get student profile
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Get enrollments
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == student.id).all()
    
    # Get recent assignments
    recent_assignments = []
    for enrollment in enrollments:
        assignments = db.query(models.Assignment).filter(
            models.Assignment.course_id == enrollment.course_id
        ).all()
        recent_assignments.extend(assignments)
    
    # Calculate attendance
    attendance_data = []
    for enrollment in enrollments:
        attendance_records = db.query(models.Attendance).filter(
            models.Attendance.enrollment_id == enrollment.id
        ).all()
        if attendance_records:
            present_count = sum(1 for record in attendance_records if record.status == "present")
            attendance_rate = present_count / len(attendance_records)
            attendance_data.append({
                "course_id": enrollment.course_id,
                "course_title": enrollment.course.title,
                "attendance_rate": attendance_rate
            })
    
    return {
        "student": {
            "id": student.id,
            "user_id": student.user_id,
            "grade_level": student.grade_level,
            "department": student.department,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "role": current_user.role
            }
        },
        "enrollments": [
            {
                "id": enrollment.id,
                "course": {
                    "id": enrollment.course.id,
                    "title": enrollment.course.title,
                    "description": enrollment.course.description,
                    "teacher": {
                        "id": enrollment.course.teacher.id,
                        "user": {
                            "full_name": enrollment.course.teacher.user.full_name
                        }
                    }
                }
            }
            for enrollment in enrollments
        ],
        "recent_assignments": [
            {
                "id": assignment.id,
                "title": assignment.title,
                "description": assignment.description,
                "due_date": assignment.due_date,
                "max_points": assignment.max_points
            }
            for assignment in recent_assignments[:5]
        ],
        "attendance": attendance_data
    }

@router.get("/courses")
async def get_student_courses(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == student.id).all()
    
    courses = []
    for enrollment in enrollments:
        course = enrollment.course
        resources = db.query(models.Resource).filter(models.Resource.course_id == course.id).all()
        assignments = db.query(models.Assignment).filter(models.Assignment.course_id == course.id).all()
        
        courses.append({
            "course": {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "teacher": {
                    "user": {
                        "full_name": course.teacher.user.full_name
                    }
                }
            },
            "resources": [
                {
                    "id": resource.id,
                    "title": resource.title,
                    "description": resource.description,
                    "resource_type": resource.resource_type
                }
                for resource in resources
            ],
            "assignments": [
                {
                    "id": assignment.id,
                    "title": assignment.title,
                    "description": assignment.description,
                    "due_date": assignment.due_date
                }
                for assignment in assignments
            ]
        })
    
    return courses

@router.get("/performance/{course_id}")
async def get_student_performance(
    course_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == student.id,
        models.Enrollment.course_id == course_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Mock data for demonstration
    student_data = {
        'attendance_rate': 0.85,
        'assignment_avg': 78.5,
        'participation_score': 7.5,
        'previous_grades': 85.0,
        'study_hours': 12.0
    }
    
    # Get prediction
    prediction = performance_predictor.predict_student_risk(student_data)
    
    return {
        "student_data": student_data,
        "prediction": prediction
    }

@router.get("/assignments")
async def get_student_assignments(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    submissions = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == student.id
    ).all()
    
    return [
        {
            "id": submission.id,
            "assignment": {
                "title": submission.assignment.title,
                "due_date": submission.assignment.due_date
            },
            "submitted_at": submission.submitted_at,
            "grade": submission.grade
        }
        for submission in submissions
    ]

@router.get("/course-resources")
async def get_course_resources(
    course_id: int = Query(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify student is enrolled in this course
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == student.id,
        models.Enrollment.course_id == course_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Get course and resources
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    resources = db.query(models.Resource).filter(models.Resource.course_id == course_id).all()
    
    return {
        "course": {
            "id": course.id,
            "title": course.title,
            "description": course.description
        },
        "resources": [
            {
                "id": resource.id,
                "title": resource.title,
                "description": resource.description,
                "resource_type": resource.resource_type,
                "file_path": resource.file_path,
                "created_at": resource.uploaded_at
            }
            for resource in resources
        ]
    }