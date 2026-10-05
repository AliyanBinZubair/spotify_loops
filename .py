from sqlalchemy import text
from database import engine
from models import Base

with engine.begin() as conn:
    conn.execute(text("DROP TABLE IF EXISTS songs CASCADE"))

Base.metadata.create_all(bind=engine)   # recreates songs with the user_id column
print("songs table recreated")