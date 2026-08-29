import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models
from models.user import User, UserRole
from services.auth_service import hash_password, verify_password

def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Total users found: {len(users)}")
        
        target = db.query(User).filter(User.email == "admin@projectportal.com").first()
        if not target:
            print("Creating superadmin user...")
            target = User(
                name="Super Admin",
                email="admin@projectportal.com",
                hashed_password=hash_password("Admin@1234"),
                role=UserRole.superadmin,
                is_active=True
            )
            db.add(target)
            db.commit()
            print("Superadmin created successfully!")
        else:
            print(f"Superadmin exists. Updating password to Admin@1234...")
            target.hashed_password = hash_password("Admin@1234")
            target.is_active = True
            db.commit()
            print("Password updated!")
            
        print(f"Verification test: {verify_password('Admin@1234', target.hashed_password)}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
