from app.database import SessionLocal, engine
from app.models import Base, User, Student, Teacher, Course, Enrollment
from app.auth import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)

def create_demo_data():
    db = SessionLocal()
    try:
        print("🗂️ Creating demo data...")
        
        # Create demo teacher
        teacher_user = User(
            email="teacher@eduhub.com",
            username="teacher1",
            hashed_password=get_password_hash("password"),
            full_name="Demo Teacher",
            role="teacher"
        )
        db.add(teacher_user)
        db.flush()
        
        teacher = Teacher(
            user_id=teacher_user.id,
            department="Computer Science",
            qualifications="PhD in Computer Science"
        )
        db.add(teacher)
        db.flush()
        
        # Create demo student
        student_user = User(
            email="student@eduhub.com",
            username="student1",
            hashed_password=get_password_hash("password"),
            full_name="Demo Student",
            role="student"
        )
        db.add(student_user)
        db.flush()
        
        student = Student(
            user_id=student_user.id,
            grade_level="Undergraduate",
            department="Computer Science"
        )
        db.add(student)
        db.flush()
        
        # Create demo courses
        course1 = Course(
            title="Introduction to Python",
            description="Learn the basics of Python programming language",
            teacher_id=teacher.id
        )
        course2 = Course(
            title="Web Development with Django",
            description="Build web applications using Django framework",
            teacher_id=teacher.id
        )
        db.add(course1)
        db.add(course2)
        db.flush()
        
        # Enroll student in courses
        enrollment1 = Enrollment(
            student_id=student.id,
            course_id=course1.id
        )
        enrollment2 = Enrollment(
            student_id=student.id,
            course_id=course2.id
        )
        db.add(enrollment1)
        db.add(enrollment2)
        
        db.commit()
        print("✅ Demo data created successfully!")
        print("👨‍🏫 Teacher: teacher1 / password")
        print("👨‍🎓 Student: student1 / password")
        print("📚 Courses: Introduction to Python, Web Development with Django")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating demo data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_data()