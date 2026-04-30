from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    email: str
    username: str
    full_name: str
    role: str

class UserCreate(BaseModel):
    email: str
    username: str
    password: str
    full_name: str
    role: str

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    grade_level: str
    department: str

class StudentCreate(StudentBase):
    user_id: int

class Student(StudentBase):
    id: int
    user: User
    
    class Config:
        from_attributes = True

class TeacherBase(BaseModel):
    department: str
    qualifications: str

class TeacherCreate(TeacherBase):
    user_id: int

class Teacher(TeacherBase):
    id: int
    user: User
    
    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    title: str
    description: str

class CourseCreate(CourseBase):
    teacher_id: int

class Course(CourseBase):
    id: int
    teacher: Teacher
    created_at: datetime
    
    class Config:
        from_attributes = True

class ResourceBase(BaseModel):
    title: str
    description: str
    resource_type: str

class ResourceCreate(ResourceBase):
    course_id: int

class Resource(ResourceBase):
    id: int
    course: Course
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

class AssignmentBase(BaseModel):
    title: str
    description: str
    due_date: datetime
    max_points: int

class AssignmentCreate(AssignmentBase):
    course_id: int

class Assignment(AssignmentBase):
    id: int
    course: Course
    
    class Config:
        from_attributes = True

class AssignmentSubmissionBase(BaseModel):
    submission_file: str

class AssignmentSubmissionCreate(AssignmentSubmissionBase):
    assignment_id: int
    student_id: int

class AssignmentSubmission(AssignmentSubmissionBase):
    id: int
    assignment: Assignment
    student: Student
    submitted_at: datetime
    grade: Optional[float] = None
    feedback: Optional[str] = None
    
    class Config:
        from_attributes = True

class PerformancePrediction(BaseModel):
    student_id: int
    course_id: int
    predicted_grade: float
    confidence: float
    risk_level: str
    recommendations: List[str]

# Add these to your existing schemas.py

class AlumniBase(BaseModel):
    graduation_year: int
    degree: str
    current_company: str
    job_title: str
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None

class AlumniCreate(AlumniBase):
    user_id: int

class AlumniUpdate(BaseModel):
    graduation_year: Optional[int] = None
    degree: Optional[str] = None
    current_company: Optional[str] = None
    job_title: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None

class Alumni(AlumniBase):
    id: int
    user_id: int
    profile_picture: Optional[str] = None
    user: User
    
    class Config:
        from_attributes = True

class ChatMessageBase(BaseModel):
    message: str

class ChatMessageCreate(ChatMessageBase):
    sender_id: int
    receiver_id: int
    conversation_id: int

class ChatMessage(ChatMessageBase):
    id: int
    sender_id: int
    receiver_id: int
    conversation_id: int
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True