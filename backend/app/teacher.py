from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional

# Relative imports
from . import models
from . import schemas
from .auth import get_current_active_user
from .database import get_db
from .ml_models import performance_predictor
import shutil
import os
import numpy as np

router = APIRouter(prefix="/teacher", tags=["teacher"])

@router.get("/dashboard")
async def get_teacher_dashboard(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
        
    courses = db.query(models.Course).filter(models.Course.teacher_id == teacher.id).all()
    
    course_data = []
    for course in courses:
        enrollments = db.query(models.Enrollment).filter(models.Enrollment.course_id == course.id).all()
        assignments = db.query(models.Assignment).filter(models.Assignment.course_id == course.id).all()
        resources = db.query(models.Resource).filter(models.Resource.course_id == course.id).all()
        
        course_data.append({
            "course": {
                "id": course.id,
                "title": course.title,
                "description": course.description
            },
            "student_count": len(enrollments),
            "assignment_count": len(assignments),
            "resource_count": len(resources)
        })
    
    return {
        "teacher": {
            "id": teacher.id,
            "department": teacher.department,
            "qualifications": teacher.qualifications,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "role": current_user.role
            }
        },
        "courses": course_data
    }

@router.post("/courses")
async def create_course(
    course: schemas.CourseCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    
    db_course = models.Course(
        title=course.title,
        description=course.description,
        teacher_id=teacher.id
    )
    
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    return db_course

@router.post("/resources")
async def upload_resource(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    resource_type: str = Form("pdf"),
    course_id: int = Form(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create uploads directory if it doesn't exist
    os.makedirs("uploads/resources", exist_ok=True)
    
    file_location = f"uploads/resources/{file.filename}"
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    resource = models.Resource(
        title=title or file.filename,
        description=description,
        resource_type=resource_type,
        file_path=file_location,
        course_id=course_id
    )
    
    db.add(resource)
    db.commit()
    db.refresh(resource)
    
    return resource

@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Verify the teacher owns this course
    course = db.query(models.Course).filter(models.Course.id == resource.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first()
    if course.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this resource")
    
    # Delete the file from disk
    try:
        if os.path.exists(resource.file_path):
            os.remove(resource.file_path)
    except Exception as e:
        print(f"Warning: Could not delete file {resource.file_path}: {e}")
    
    # Delete from database
    db.delete(resource)
    db.commit()
    
    return {"message": "Resource deleted successfully"}

@router.get("/analytics/{course_id}")
async def get_course_analytics(
    course_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).all()
    
    analytics_data = []
    for enrollment in enrollments:
        student = enrollment.student
        
        # Mock data for demonstration
        student_data = {
            'attendance_rate': 0.85,
            'assignment_avg': 78.5,
            'participation_score': 6.0,
            'previous_grades': 80.0,
            'study_hours': 10.0
        }
        
        prediction = performance_predictor.predict_student_risk(student_data)
        
        analytics_data.append({
            "student": {
                "id": student.user.id,
                "username": student.user.username,
                "full_name": student.user.full_name,
                "email": student.user.email
            },
            "attendance_rate": student_data['attendance_rate'],
            "assignment_avg": student_data['assignment_avg'],
            "risk_prediction": prediction
        })
    
    return {
        "course": {
            "id": course.id,
            "title": course.title,
            "description": course.description
        },
        "analytics": analytics_data
    }

@router.post("/assignments")
async def create_assignment(
    assignment: schemas.AssignmentCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_assignment = models.Assignment(**assignment.dict())
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    
    return db_assignment

@router.get("/resources")
async def get_course_resources(
    course_id: int = Query(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Verify the teacher owns this course
    if course.teacher_id != db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first().id:
        raise HTTPException(status_code=403, detail="Not authorized to view this course's resources")
    
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

@router.get("/courses")
async def get_teacher_courses(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
        
    courses = db.query(models.Course).filter(models.Course.teacher_id == teacher.id).all()
    return [
        {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "created_at": course.created_at
        }
        for course in courses
    ]

@router.get("/all-students")
async def get_all_students(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    students = db.query(models.Student).all()
    return [
        {
            "id": student.id,
            "user_id": student.user_id,
            "full_name": student.user.full_name,
            "email": student.user.email,
            "username": student.user.username
        }
        for student in students
    ]

@router.post("/enroll-student")
async def enroll_student(
    course_id: int = Form(...),
    student_id: int = Form(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify teacher owns the course
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == current_user.id).first()
    if course.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized to enroll students in this course")
    
    # Check if student exists
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if already enrolled
    existing = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id,
        models.Enrollment.student_id == student_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this course")
    
    # Create enrollment
    enrollment = models.Enrollment(
        course_id=course_id,
        student_id=student_id
    )
    
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    
    return {"message": f"Student enrolled successfully", "enrollment_id": enrollment.id}