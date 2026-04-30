from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import os

# Import from current directory
from . import models
from . import alumni, chat
from .database import engine, get_db
from .schemas import UserCreate, Token
from .auth import get_password_hash, authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="EduHelp API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from . import auth, student, teacher

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(student.router, prefix="/api", tags=["student"])
app.include_router(teacher.router, prefix="/api", tags=["teacher"])
app.include_router(alumni.router, prefix="/api", tags=["alumni"])
app.include_router(chat.router, prefix="/api", tags=["chat"])

# Static files
os.makedirs("uploads/resources", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ------------------ REGISTER ------------------
@app.post("/auth/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    print(f"🔐 Registration attempt for: {user.username}, role: {user.role}")

    try:
        if len(user.password) < 6:
            raise HTTPException(status_code=400, detail="Password too short")

        if len(user.password) > 72:
            raise HTTPException(status_code=400, detail="Password too long")

        # Check duplicates
        if db.query(models.User).filter(models.User.username == user.username).first():
            raise HTTPException(status_code=400, detail="Username already registered")

        if db.query(models.User).filter(models.User.email == user.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

        # ✅ FIXED ROLE VALIDATION
        if user.role not in ["student", "teacher", "alumni"]:
            raise HTTPException(
                status_code=400,
                detail="Role must be 'student', 'teacher', or 'alumni'"
            )

        hashed_password = get_password_hash(user.password)

        db_user = models.User(
            email=user.email,
            username=user.username,
            hashed_password=hashed_password,
            full_name=user.full_name,
            role=user.role
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # Create role profile
        if user.role == "student":
            db.add(models.Student(user_id=db_user.id, grade_level="Undergraduate", department="General"))

        elif user.role == "teacher":
            db.add(models.Teacher(user_id=db_user.id, department="General", qualifications="Masters"))

        elif user.role == "alumni":
            db.add(models.Alumni(
                user_id=db_user.id,
                graduation_year=2020,
                degree="Not Specified"
            ))

        db.commit()

        return {
            "message": "User created successfully",
            "user": {
                "id": db_user.id,
                "username": db_user.username,
                "role": db_user.role
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ LOGIN ------------------
@app.post("/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}


# ------------------ BASIC ROUTES ------------------
@app.get("/")
async def root():
    return {"message": "Welcome to EduHelp API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/test")
async def test_endpoint():
    return {"message": "API working"}


# ------------------ SEED DEMO DATA ------------------
@app.post("/seed-demo-data")
async def seed_demo_data(db: Session = Depends(get_db)):
    """Create demo data for testing - teacher, student, and alumni"""
    try:
        # Prevent duplicate seeding
        if db.query(models.User).filter(models.User.username == "teacher1").first():
            return {"message": "Demo data already exists"}

        # ---------- TEACHER ----------
        teacher_user = models.User(
            email="teacher@eduhub.com",
            username="teacher1",
            hashed_password=get_password_hash("password"),
            full_name="Demo Teacher",
            role="teacher"
        )
        db.add(teacher_user)
        db.flush()

        teacher = models.Teacher(
            user_id=teacher_user.id,
            department="Computer Science",
            qualifications="PhD"
        )
        db.add(teacher)
        db.flush()

        # ---------- STUDENT ----------
        student_user = models.User(
            email="student@eduhub.com",
            username="student1",
            hashed_password=get_password_hash("password"),
            full_name="Demo Student",
            role="student"
        )
        db.add(student_user)
        db.flush()

        student = models.Student(
            user_id=student_user.id,
            grade_level="Undergraduate",
            department="Computer Science"
        )
        db.add(student)
        db.flush()

        # ---------- ALUMNI ----------
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
            degree="BSc Computer Science",
            current_company="Google",
            job_title="Senior Software Engineer",
            bio="Happy to mentor students",
            linkedin_url="https://linkedin.com/in/johnsmith"
        )
        db.add(alumni)
        db.flush()

        # ---------- COURSES ----------
        course1 = models.Course(
            title="Introduction to Python",
            description="Basics of Python",
            teacher_id=teacher.id
        )
        course2 = models.Course(
            title="Django Web Development",
            description="Build web apps",
            teacher_id=teacher.id
        )
        db.add(course1)
        db.add(course2)
        db.flush()

        # ---------- ENROLLMENTS ----------
        db.add(models.Enrollment(student_id=student.id, course_id=course1.id))
        db.add(models.Enrollment(student_id=student.id, course_id=course2.id))

        db.commit()

        return {
            "message": "Demo data created successfully",
            "login": {
                "teacher": "teacher1 / password",
                "student": "student1 / password",
                "alumni": "alumni1 / password"
            }
        }

    except Exception as e:
        db.rollback()
        return {"error": str(e)}


# ------------------ RUN ------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)