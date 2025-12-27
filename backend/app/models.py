from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # "student" or "teacher"
    full_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    teacher_profile = relationship("Teacher", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    grade_level = Column(String)
    department = Column(String)
    
    user = relationship("User", back_populates="student_profile")
    enrollments = relationship("Enrollment", back_populates="student")
    submissions = relationship("AssignmentSubmission", back_populates="student")

class Teacher(Base):
    __tablename__ = "teachers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    department = Column(String)
    qualifications = Column(String)
    
    user = relationship("User", back_populates="teacher_profile")
    courses = relationship("Course", back_populates="teacher")

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    teacher = relationship("Teacher", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course")
    resources = relationship("Resource", back_populates="course")
    assignments = relationship("Assignment", back_populates="course")

class Enrollment(Base):
    __tablename__ = "enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    
    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    attendance = relationship("Attendance", back_populates="enrollment")

class Resource(Base):
    __tablename__ = "resources"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    file_path = Column(String)
    resource_type = Column(String)  # pdf, video, note
    course_id = Column(Integer, ForeignKey("courses.id"))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    course = relationship("Course", back_populates="resources")

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    due_date = Column(DateTime)
    course_id = Column(Integer, ForeignKey("courses.id"))
    max_points = Column(Integer)
    
    course = relationship("Course", back_populates="assignments")
    submissions = relationship("AssignmentSubmission", back_populates="assignment")

class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"))
    student_id = Column(Integer, ForeignKey("students.id"))
    submission_file = Column(String)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"))
    date = Column(DateTime)
    status = Column(String)  # present, absent, late
    
    enrollment = relationship("Enrollment", back_populates="attendance")