import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os

class StudentPerformancePredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        
    def generate_sample_data(self, n_samples=1000):
        """Generate sample data for demonstration"""
        np.random.seed(42)
        
        data = {
            'attendance_rate': np.random.uniform(0.5, 1.0, n_samples),
            'assignment_avg': np.random.uniform(50, 100, n_samples),
            'participation_score': np.random.uniform(0, 10, n_samples),
            'previous_grades': np.random.uniform(60, 100, n_samples),
            'study_hours': np.random.uniform(1, 20, n_samples),
        }
        
        # Create target variable (1 = at risk, 0 = not at risk)
        risk_factors = (
            (data['attendance_rate'] < 0.7) * 3 +
            (data['assignment_avg'] < 70) * 2 +
            (data['participation_score'] < 5) * 2 +
            (data['previous_grades'] < 75) * 2 +
            (data['study_hours'] < 5) * 1
        )
        
        data['at_risk'] = (risk_factors >= 5).astype(int)
        
        return pd.DataFrame(data)
    
    def train_model(self):
        """Train the ML model"""
        try:
            # Generate sample data
            df = self.generate_sample_data()
            
            # Prepare features and target
            features = ['attendance_rate', 'assignment_avg', 'participation_score', 
                       'previous_grades', 'study_hours']
            X = df[features]
            y = df['at_risk']
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train model
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
            self.model.fit(X_train_scaled, y_train)
            
            self.is_trained = True
            
            # Save model
            os.makedirs('models', exist_ok=True)
            joblib.dump(self.model, 'models/student_performance_model.pkl')
            joblib.dump(self.scaler, 'models/scaler.pkl')
            
            accuracy = self.model.score(X_test_scaled, y_test)
            print(f"✅ Model trained with accuracy: {accuracy:.2f}")
            
            return accuracy
        except Exception as e:
            print(f"❌ Model training failed: {e}")
            return 0.0
    
    def predict_student_risk(self, student_data):
        """Predict if a student is at risk"""
        if not self.is_trained:
            self.load_model()
            
        if self.model is None:
            # Return default prediction if model not available
            return {
                "at_risk": False,
                "risk_probability": 0.2,
                "risk_level": "low",
                "recommendations": ["Maintain current study habits"]
            }
        
        try:
            # Prepare input data
            features = ['attendance_rate', 'assignment_avg', 'participation_score', 
                       'previous_grades', 'study_hours']
            
            input_data = np.array([[student_data.get(feature, 0) for feature in features]])
            input_scaled = self.scaler.transform(input_data)
            
            prediction = self.model.predict(input_scaled)[0]
            probability = self.model.predict_proba(input_scaled)[0][1]
            
            # Determine risk level
            if probability < 0.3:
                risk_level = "low"
            elif probability < 0.7:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            # Generate recommendations
            recommendations = self._generate_recommendations(student_data, risk_level)
            
            return {
                "at_risk": bool(prediction),
                "risk_probability": float(probability),
                "risk_level": risk_level,
                "recommendations": recommendations
            }
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return {
                "at_risk": False,
                "risk_probability": 0.2,
                "risk_level": "low",
                "recommendations": ["Error in prediction - using default recommendations"]
            }
    
    def _generate_recommendations(self, student_data, risk_level):
        """Generate personalized recommendations"""
        recommendations = []
        
        if student_data.get('attendance_rate', 1) < 0.8:
            recommendations.append("Improve class attendance rate")
        
        if student_data.get('assignment_avg', 100) < 70:
            recommendations.append("Focus on completing assignments on time")
        
        if student_data.get('study_hours', 20) < 10:
            recommendations.append("Increase weekly study hours")
        
        if student_data.get('participation_score', 10) < 6:
            recommendations.append("Participate more in class discussions")
        
        if risk_level == "high":
            recommendations.append("Schedule a meeting with your instructor")
            recommendations.append("Utilize tutoring services")
        
        if not recommendations:
            recommendations.append("Maintain current study habits")
        
        return recommendations
    
    def load_model(self):
        """Load trained model"""
        try:
            self.model = joblib.load('models/student_performance_model.pkl')
            self.scaler = joblib.load('models/scaler.pkl')
            self.is_trained = True
            print("✅ Model loaded successfully")
        except FileNotFoundError:
            print("❌ Model files not found. Training new model...")
            self.train_model()

# Global instance
performance_predictor = StudentPerformancePredictor()

# Train model on startup
performance_predictor.train_model()