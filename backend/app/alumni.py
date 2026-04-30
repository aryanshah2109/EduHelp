from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os

from . import models
from .auth import get_current_active_user
from .database import get_db
from .schemas import AlumniCreate, AlumniUpdate

router = APIRouter(prefix="/alumni", tags=["alumni"])

@router.get("/dashboard")
async def get_alumni_dashboard(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    alumni = db.query(models.Alumni).filter(models.Alumni.user_id == current_user.id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni profile not found")
    
    # Get recent conversations
    conversations = db.query(models.ChatConversation).filter(
        (models.ChatConversation.user1_id == current_user.id) | 
        (models.ChatConversation.user2_id == current_user.id)
    ).order_by(models.ChatConversation.last_message_time.desc()).limit(10).all()
    
    # Get unread message count
    unread_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.is_read == False
    ).count()
    
    # Get total connections (unique people chatted with)
    connections = set()
    for conv in conversations:
        if conv.user1_id == current_user.id:
            connections.add(conv.user2_id)
        else:
            connections.add(conv.user1_id)
    
    return {
        "alumni": {
            "id": alumni.id,
            "user_id": alumni.user_id,
            "graduation_year": alumni.graduation_year,
            "degree": alumni.degree,
            "current_company": alumni.current_company,
            "job_title": alumni.job_title,
            "bio": alumni.bio,
            "profile_picture": alumni.profile_picture,
            "linkedin_url": alumni.linkedin_url,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "role": current_user.role,
                "created_at": current_user.created_at
            }
        },
        "unread_messages": unread_count,
        "connections_count": len(connections),
        "recent_conversations": [
            {
                "id": conv.id,
                "other_user": {
                    "id": conv.user2_id if conv.user1_id == current_user.id else conv.user1_id,
                    "full_name": (conv.user2 if conv.user1_id == current_user.id else conv.user1).full_name,
                    "role": (conv.user2 if conv.user1_id == current_user.id else conv.user1).role,
                    "username": (conv.user2 if conv.user1_id == current_user.id else conv.user1).username
                },
                "last_message": conv.last_message,
                "last_message_time": conv.last_message_time
            }
            for conv in conversations
        ]
    }

@router.get("/profile")
async def get_alumni_profile(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    alumni = db.query(models.Alumni).filter(models.Alumni.user_id == current_user.id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni profile not found")
    
    return {
        "alumni": {
            "id": alumni.id,
            "graduation_year": alumni.graduation_year,
            "degree": alumni.degree,
            "current_company": alumni.current_company,
            "job_title": alumni.job_title,
            "bio": alumni.bio,
            "profile_picture": alumni.profile_picture,
            "linkedin_url": alumni.linkedin_url,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "role": current_user.role,
                "created_at": current_user.created_at
            }
        }
    }

@router.put("/profile")
async def update_alumni_profile(
    alumni_data: AlumniUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    alumni = db.query(models.Alumni).filter(models.Alumni.user_id == current_user.id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni profile not found")
    
    # Update fields
    for field, value in alumni_data.dict(exclude_unset=True).items():
        setattr(alumni, field, value)
    
    db.commit()
    db.refresh(alumni)
    
    return {"message": "Profile updated successfully", "alumni": alumni}

@router.post("/upload-profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create directory if it doesn't exist
    os.makedirs("uploads/profile_pictures", exist_ok=True)
    
    # Save file
    file_extension = file.filename.split('.')[-1]
    filename = f"alumni_{current_user.id}.{file_extension}"
    file_path = f"uploads/profile_pictures/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update alumni profile
    alumni = db.query(models.Alumni).filter(models.Alumni.user_id == current_user.id).first()
    if alumni:
        alumni.profile_picture = file_path
        db.commit()
    
    return {"message": "Profile picture uploaded", "file_path": file_path}

@router.get("/students")
async def get_all_students(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    students = db.query(models.User).filter(models.User.role == "student").all()
    return [
        {
            "id": student.id,
            "full_name": student.full_name,
            "username": student.username,
            "email": student.email,
            "role": student.role
        }
        for student in students
    ]

@router.get("/teachers")
async def get_all_teachers(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "alumni":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teachers = db.query(models.User).filter(models.User.role == "teacher").all()
    return [
        {
            "id": teacher.id,
            "full_name": teacher.full_name,
            "username": teacher.username,
            "email": teacher.email,
            "role": teacher.role
        }
        for teacher in teachers
    ]