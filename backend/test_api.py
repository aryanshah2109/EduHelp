import requests
import json

def test_backend():
    base_url = "http://127.0.0.1:8000"
    
    try:
        print("🧪 Testing backend endpoints...")
        
        # Test root endpoint
        response = requests.get(f"{base_url}/")
        print(f"📍 Root endpoint: {response.status_code} - {response.json()}")
        
        # Test health endpoint
        response = requests.get(f"{base_url}/health")
        print(f"❤️ Health endpoint: {response.status_code} - {response.json()}")
        
        # Test registration
        test_user = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "testpass123",
            "full_name": "Test User",
            "role": "student"
        }
        
        response = requests.post(
            f"{base_url}/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"}
        )
        print(f"📝 Registration endpoint: {response.status_code} - {response.text}")
        
        print("✅ Backend is running correctly!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running. Please start the server first.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_backend()