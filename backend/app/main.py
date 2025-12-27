from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import os

# Import from current directory
from . import models
from .database import engine, get_db
from .schemas import UserCreate, Token
from .auth import get_password_hash, authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="EduHelp API", version="1.0.0")

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers after app creation
from . import auth, student, teacher

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(student.router, prefix="/api", tags=["student"])
app.include_router(teacher.router, prefix="/api", tags=["teacher"])

# Create uploads directory if it doesn't exist
os.makedirs("uploads/resources", exist_ok=True)

# Mount static files for uploaded resources
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Serve frontend static files - REMOVE THIS FOR NOW to test
# app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")

@app.post("/auth/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    print(f"🔐 Registration attempt for: {user.username}, {user.email}, role: {user.role}")
    
    try:
        # Add reasonable password length validation
        if len(user.password) < 6:
            raise HTTPException(
                status_code=400, 
                detail="Password too short. Minimum 6 characters required."
            )

        if len(user.password) > 72:
            raise HTTPException(
                status_code=400, 
                detail="Password too long. Maximum 72 characters allowed."
            )
        
        # Check if user exists
        db_user = db.query(models.User).filter(models.User.username == user.username).first()
        if db_user:
            print(f"❌ Username {user.username} already exists")
            raise HTTPException(status_code=400, detail="Username already registered")
        
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            print(f"❌ Email {user.email} already exists")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Validate role
        if user.role not in ["student", "teacher"]:
            raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")
        
        # Create user with password hashing
        try:
            hashed_password = get_password_hash(user.password)
        except Exception as hash_error:
            print(f"❌ Password hashing error: {hash_error}")
            raise HTTPException(status_code=500, detail="Password processing error")
        
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
        
        print(f"✅ User created with ID: {db_user.id}")
        
        # Create profile based on role
        if user.role == "student":
            student_profile = models.Student(
                user_id=db_user.id,
                grade_level="Undergraduate",
                department="General"
            )
            db.add(student_profile)
            print("✅ Student profile created")
        elif user.role == "teacher":
            teacher_profile = models.Teacher(
                user_id=db_user.id,
                department="General",
                qualifications="Masters Degree"
            )
            db.add(teacher_profile)
            print("✅ Teacher profile created")
        
        db.commit()
        
        # After successful registration, also return user info
        user_info = {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email,
            "full_name": db_user.full_name,
            "role": db_user.role
        }
        
        return {
            "message": "User created successfully", 
            "user_id": db_user.id,
            "username": db_user.username,
            "role": user.role,
            "user": user_info,
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    print(f"🔐 Login attempt for user: {form_data.username}")
    
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        print(f"❌ Authentication failed for user: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    print(f"✅ Login successful for user: {form_data.username}, role: {user.role}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
async def root():
    return {"message": "Welcome to EduHelp API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Add a test endpoint to verify the API is working
@app.get("/test")
async def test_endpoint():
    return {"message": "API is working!", "timestamp": str(__import__('datetime').datetime.now())}

# Demo data creation endpoint
@app.post("/seed-demo-data")
async def seed_demo_data(db: Session = Depends(get_db)):
    """Create demo data for testing - teacher with courses"""
    try:
        # Check if demo data already exists
        existing_teacher = db.query(models.User).filter(models.User.username == "teacher1").first()
        if existing_teacher:
            return {"message": "Demo data already exists"}
        
        # Create demo teacher
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
            qualifications="PhD in Computer Science"
        )
        db.add(teacher)
        db.flush()
        
        # Create demo student
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
        
        # Create demo courses
        course1 = models.Course(
            title="Introduction to Python",
            description="Learn the basics of Python programming language",
            teacher_id=teacher.id
        )
        course2 = models.Course(
            title="Web Development with Django",
            description="Build web applications using Django framework",
            teacher_id=teacher.id
        )
        db.add(course1)
        db.add(course2)
        db.flush()
        
        # Enroll student in courses
        enrollment1 = models.Enrollment(
            student_id=student.id,
            course_id=course1.id
        )
        enrollment2 = models.Enrollment(
            student_id=student.id,
            course_id=course2.id
        )
        db.add(enrollment1)
        db.add(enrollment2)
        
        db.commit()
        return {"message": "Demo data created successfully!", "teacher": "teacher1", "student": "student1"}
    
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)