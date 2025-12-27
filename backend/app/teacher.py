from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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