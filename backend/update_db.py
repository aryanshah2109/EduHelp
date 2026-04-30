#!/usr/bin/env python3
"""
Database update script to add Alumni and Chat tables
Run this script to update your existing database
"""

import sys
import os

# Add the current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, SessionLocal
from app import models
from sqlalchemy import inspect

def drop_all_tables():
    """Drop all existing tables (use with caution!)"""
    print("⚠️ WARNING: This will delete all existing data!")
    confirm = input("Type 'yes' to continue: ")
    if confirm.lower() != 'yes':
        print("Operation cancelled.")
        return False
    
    print("🗑️ Dropping all tables...")
    models.Base.metadata.drop_all(bind=engine)
    print("✅ All tables dropped successfully!")
    return True

def create_all_tables():
    """Create all tables fresh"""
    print("📊 Creating all tables...")
    models.Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully!")

def verify_tables():
    """Verify tables were created"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("\n📋 Created tables:")
    for table in sorted(tables):
        print(f"   - {table}")
    
    required_tables = ['users', 'students', 'teachers', 'alumni', 'chat_conversations', 'chat_messages']
    missing = [t for t in required_tables if t not in tables]
    
    if missing:
        print(f"\n⚠️ Missing tables: {missing}")
        return False
    else:
        print("\n✅ All required tables created successfully!")
        return True

def add_demo_data():
    """Add demo users including alumni"""
    db = SessionLocal()
    
    try:
        from app.auth import get_password_hash
        
        # Check if users already exist
        existing_users = db.query(models.User).first()
        if existing_users:
            print("\n📌 Demo users already exist. Skipping...")
            return
        
        print("\n👤 Creating demo users...")
        
        # Create teacher
        teacher_user = models.User(
            email="teacher@eduhub.com",
            username="teacher1",
            hashed_password=get_password_hash("password"),
            full_name="Dr. Sarah Johnson",
            role="teacher"
        )
        db.add(teacher_user)
        db.flush()
        
        teacher = models.Teacher(
            user_id=teacher_user.id,
            department="Computer Science",
            qualifications="PhD in Computer Science, MIT"
        )
        db.add(teacher)
        
        # Create student
        student_user = models.User(
            email="student@eduhub.com",
            username="student1",
            hashed_password=get_password_hash("password"),
            full_name="Alex Thompson",
            role="student"
        )
        db.add(student_user)
        db.flush()
        
        student = models.Student(
            user_id=student_user.id,
            grade_level="Senior",
            department="Computer Science"
        )
        db.add(student)
        
        # Create alumni
        alumni_user = models.User(
            email="alumni@eduhub.com",
            username="alumni1",
            hashed_password=get_password_hash("password"),
            full_name="John Smith",
            role="alumni"
        )
        db.add(alumni_user)
        db.flush()
        
        alumni = models.Alumni(
            user_id=alumni_user.id,
            graduation_year=2020,
            degree="Bachelor of Science in Computer Science",
            current_company="Google",
            job_title="Senior Software Engineer",
            bio="I'm passionate about helping students transition from academia to industry. Feel free to reach out for career advice or tech discussions!",
            linkedin_url="https://linkedin.com/in/johnsmith"
        )
        db.add(alumni)
        
        # Create second alumni
        alumni2_user = models.User(
            email="alumni2@eduhub.com",
            username="alumni2",
            hashed_password=get_password_hash("password"),
            full_name="Emily Chen",
            role="alumni"
        )
        db.add(alumni2_user)
        db.flush()
        
        alumni2 = models.Alumni(
            user_id=alumni2_user.id,
            graduation_year=2019,
            degree="Master of Science in Data Science",
            current_company="Microsoft",
            job_title="Data Scientist",
            bio="Former student now working in AI/ML. Happy to mentor current students!",
            linkedin_url="https://linkedin.com/in/emilychen"
        )
        db.add(alumni2)
        
        # Create courses
        course1 = models.Course(
            title="Introduction to Python Programming",
            description="Learn the fundamentals of Python programming including data types, loops, functions, and object-oriented programming.",
            teacher_id=teacher.id
        )
        course2 = models.Course(
            title="Web Development with Django",
            description="Build powerful web applications using the Django framework. Learn about models, views, templates, and REST APIs.",
            teacher_id=teacher.id
        )
        course3 = models.Course(
            title="Data Structures and Algorithms",
            description="Master essential data structures and algorithms for technical interviews and efficient programming.",
            teacher_id=teacher.id
        )
        db.add_all([course1, course2, course3])
        db.flush()
        
        # Enroll student in courses
        enrollments = [
            models.Enrollment(student_id=student.id, course_id=course1.id),
            models.Enrollment(student_id=student.id, course_id=course2.id),
            models.Enrollment(student_id=student.id, course_id=course3.id)
        ]
        db.add_all(enrollments)
        
        db.commit()
        
        print("✅ Demo users created successfully!")
        print("\n📋 Demo Accounts:")
        print("   Teacher:  teacher1 / password")
        print("   Student:  student1 / password")
        print("   Alumni:   alumni1 / password")
        print("   Alumni:   alumni2 / password")
        
    except Exception as e:
        print(f"❌ Error creating demo data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    print("=" * 60)
    print("EduHelp Database Setup Tool")
    print("=" * 60)
    
    # Ask user what they want to do
    print("\nOptions:")
    print("1. Fresh install (delete all existing data and create new)")
    print("2. Update existing database (add missing tables only)")
    print("3. Exit")
    
    choice = input("\nSelect option (1-3): ").strip()
    
    if choice == '1':
        if drop_all_tables():
            create_all_tables()
            if verify_tables():
                add_demo_data()
    elif choice == '2':
        print("\n🔄 Adding missing tables...")
        create_all_tables()
        verify_tables()
        
        # Check if we need to add demo data
        db = SessionLocal()
        try:
            user_count = db.query(models.User).count()
            if user_count == 0:
                print("\n📌 No users found. Adding demo data...")
                add_demo_data()
            else:
                print(f"\n📌 Found {user_count} existing users. Skipping demo data.")
        finally:
            db.close()
    else:
        print("Exiting...")
        return
    
    print("\n" + "=" * 60)
    print("🎉 Database setup complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Start your backend: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
    print("2. Login with demo accounts:")
    print("   - Student: student1 / password")
    print("   - Teacher: teacher1 / password")
    print("   - Alumni:  alumni1 / password")

if __name__ == "__main__":
    main()