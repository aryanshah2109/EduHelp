from app.database import SessionLocal, engine
from app.models import Base, User, Student, Teacher, Course, Enrollment, Alumni
from app.auth import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)


def get_or_create_user(db, username, email, full_name, role, password="password"):
    user = db.query(User).filter(User.username == username).first()
    if user:
        return user

    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role
    )
    db.add(user)
    db.flush()
    return user


def create_demo_data():
    db = SessionLocal()
    try:
        print("🗂️ Creating demo data...")

        # ------------------ TEACHER ------------------
        teacher_user = get_or_create_user(
            db,
            username="teacher1",
            email="teacher@eduhub.com",
            full_name="Demo Teacher",
            role="teacher"
        )

        teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user.id).first()
        if not teacher:
            teacher = Teacher(
                user_id=teacher_user.id,
                department="Computer Science",
                qualifications="PhD in Computer Science"
            )
            db.add(teacher)
            db.flush()

        # ------------------ STUDENT ------------------
        student_user = get_or_create_user(
            db,
            username="student1",
            email="student@eduhub.com",
            full_name="Demo Student",
            role="student"
        )

        student = db.query(Student).filter(Student.user_id == student_user.id).first()
        if not student:
            student = Student(
                user_id=student_user.id,
                grade_level="Undergraduate",
                department="Computer Science"
            )
            db.add(student)
            db.flush()

        # ------------------ ALUMNI ------------------
        alumni_user = get_or_create_user(
            db,
            username="alumni1",
            email="alumni@eduhub.com",
            full_name="Demo Alumni",
            role="alumni"
        )

        alumni = db.query(Alumni).filter(Alumni.user_id == alumni_user.id).first()
        if not alumni:
            alumni = Alumni(
                user_id=alumni_user.id,
                graduation_year=2020,
                degree="Computer Science",
                current_company="Tech Corp",
                job_title="Senior Developer",
                bio="Passionate about mentoring students and sharing industry experience."
            )
            db.add(alumni)
            db.flush()

        # ------------------ COURSES ------------------
        course1 = db.query(Course).filter(Course.title == "Introduction to Python").first()
        if not course1:
            course1 = Course(
                title="Introduction to Python",
                description="Learn the basics of Python programming language",
                teacher_id=teacher.id
            )
            db.add(course1)

        course2 = db.query(Course).filter(Course.title == "Web Development with Django").first()
        if not course2:
            course2 = Course(
                title="Web Development with Django",
                description="Build web applications using Django framework",
                teacher_id=teacher.id
            )
            db.add(course2)

        db.flush()

        # ------------------ ENROLLMENTS ------------------
        enrollment1 = db.query(Enrollment).filter(
            Enrollment.student_id == student.id,
            Enrollment.course_id == course1.id
        ).first()

        if not enrollment1:
            db.add(Enrollment(student_id=student.id, course_id=course1.id))

        enrollment2 = db.query(Enrollment).filter(
            Enrollment.student_id == student.id,
            Enrollment.course_id == course2.id
        ).first()

        if not enrollment2:
            db.add(Enrollment(student_id=student.id, course_id=course2.id))

        db.commit()

        print("✅ Demo data created successfully!")
        print("👨‍🏫 Teacher: teacher1 / password")
        print("👨‍🎓 Student: student1 / password")
        print("🎓 Alumni: alumni1 / password")
        print("📚 Courses: Introduction to Python, Web Development with Django")

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating demo data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    create_demo_data()