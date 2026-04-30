import uvicorn
import os
import subprocess
import sys

if __name__ == "__main__":
    # Set environment variables to avoid encoding issues
    os.environ["PYTHONUTF8"] = "1"
    os.environ["PYTHONIOENCODING"] = "utf-8"

    subprocess.run([sys.executable, "update_db.py"])
    
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        reload_dirs=["app"]  # Only watch the app directory
    )