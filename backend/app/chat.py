from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime
import json

from . import models
from .auth import get_current_active_user
from .database import get_db

router = APIRouter(prefix="/chat", tags=["chat"])

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()


@router.get("/conversations")
async def get_conversations(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    conversations = db.query(models.ChatConversation).filter(
        (models.ChatConversation.user1_id == current_user.id) | 
        (models.ChatConversation.user2_id == current_user.id)
    ).order_by(models.ChatConversation.last_message_time.desc()).all()
    
    result = []
    for conv in conversations:
        other_user_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
        other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
        
        unread_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.conversation_id == conv.id,
            models.ChatMessage.receiver_id == current_user.id,
            models.ChatMessage.is_read == False
        ).count()
        
        result.append({
            "id": conv.id,
            "other_user": {
                "id": other_user.id,
                "full_name": other_user.full_name,
                "username": other_user.username,
                "role": other_user.role
            },
            "last_message": conv.last_message,
            "last_message_time": conv.last_message_time,
            "unread_count": unread_count
        })
    
    return result


# ✅ NEW ENDPOINT: GET ALL ALUMNI
@router.get("/alumni")
async def get_all_alumni(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all alumni users for chatting"""
    alumni_users = db.query(models.User).filter(models.User.role == "alumni").all()
    
    if current_user.role == "alumni":
        alumni_users = [u for u in alumni_users if u.id != current_user.id]
    
    return [
        {
            "id": alumni.id,
            "full_name": alumni.full_name,
            "username": alumni.username,
            "email": alumni.email,
            "role": alumni.role
        }
        for alumni in alumni_users
    ]


# ✅ NEW ENDPOINT: GET STUDENTS FOR CHAT
@router.get("/students")
async def get_all_students_for_chat(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all students for teachers/alumni to chat with"""
    if current_user.role not in ["teacher", "alumni"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    students = db.query(models.User).filter(models.User.role == "student").all()
    
    return [
        {
            "id": student.id,
            "full_name": student.full_name,
            "username": student.username,
            "email": student.email,
            "role": student.role
        }
        for student in students
    ]


@router.get("/messages/{other_user_id}")
async def get_messages(
    other_user_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    conversation = db.query(models.ChatConversation).filter(
        (models.ChatConversation.user1_id == current_user.id) & (models.ChatConversation.user2_id == other_user_id) |
        (models.ChatConversation.user1_id == other_user_id) & (models.ChatConversation.user2_id == current_user.id)
    ).first()
    
    if not conversation:
        conversation = models.ChatConversation(
            user1_id=current_user.id,
            user2_id=other_user_id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_id == conversation.id
    ).order_by(models.ChatMessage.created_at).all()
    
    db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_id == conversation.id,
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    return {
        "conversation_id": conversation.id,
        "messages": [
            {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "message": msg.message,
                "created_at": msg.created_at,
                "is_read": msg.is_read
            }
            for msg in messages
        ]
    }


@router.post("/send")
async def send_message(
    receiver_id: int,
    message: str,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    conversation = db.query(models.ChatConversation).filter(
        ((models.ChatConversation.user1_id == current_user.id) & (models.ChatConversation.user2_id == receiver_id)) |
        ((models.ChatConversation.user1_id == receiver_id) & (models.ChatConversation.user2_id == current_user.id))
    ).first()
    
    if not conversation:
        conversation = models.ChatConversation(
            user1_id=min(current_user.id, receiver_id),
            user2_id=max(current_user.id, receiver_id)
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    chat_message = models.ChatMessage(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=message
    )
    db.add(chat_message)
    
    conversation.last_message = message[:100]
    conversation.last_message_time = datetime.utcnow()
    
    db.commit()
    db.refresh(chat_message)
    
    await manager.send_message(receiver_id, {
        "type": "new_message",
        "message": {
            "id": chat_message.id,
            "sender_id": chat_message.sender_id,
            "receiver_id": chat_message.receiver_id,
            "message": chat_message.message,
            "created_at": str(chat_message.created_at)
        },
        "sender_name": current_user.full_name,
        "sender_role": current_user.role
    })
    
    return {
        "id": chat_message.id,
        "sender_id": chat_message.sender_id,
        "receiver_id": chat_message.receiver_id,
        "message": chat_message.message,
        "created_at": chat_message.created_at
    }


@router.get("/unread-count")
async def get_unread_count(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    count = db.query(models.ChatMessage).filter(
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.is_read == False
    ).count()
    return {"unread_count": count}


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from .auth import get_current_user
    from .database import SessionLocal
    
    db = SessionLocal()
    try:
        from jose import jwt
        from .auth import SECRET_KEY, ALGORITHM
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=1008)
            return
        
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            await websocket.close(code=1008)
            return
        
        await manager.connect(user.id, websocket)
        
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message":
                receiver_id = message_data.get("receiver_id")
                message_text = message_data.get("message")
                
                conversation = db.query(models.ChatConversation).filter(
                    ((models.ChatConversation.user1_id == user.id) & (models.ChatConversation.user2_id == receiver_id)) |
                    ((models.ChatConversation.user1_id == receiver_id) & (models.ChatConversation.user2_id == user.id))
                ).first()
                
                if not conversation:
                    conversation = models.ChatConversation(
                        user1_id=min(user.id, receiver_id),
                        user2_id=max(user.id, receiver_id)
                    )
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)
                
                chat_message = models.ChatMessage(
                    conversation_id=conversation.id,
                    sender_id=user.id,
                    receiver_id=receiver_id,
                    message=message_text
                )
                db.add(chat_message)
                
                conversation.last_message = message_text[:100]
                conversation.last_message_time = datetime.utcnow()
                
                db.commit()
                
                await manager.send_message(receiver_id, {
                    "type": "message",
                    "id": chat_message.id,
                    "sender_id": user.id,
                    "sender_name": user.full_name,
                    "sender_role": user.role,
                    "message": message_text,
                    "created_at": str(chat_message.created_at)
                })
                
                await websocket.send_json({
                    "type": "sent",
                    "id": chat_message.id,
                    "created_at": str(chat_message.created_at)
                })
                
    except WebSocketDisconnect:
        manager.disconnect(user.id)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        db.close()