from sqlalchemy import Column, Integer, String, Float, ForeignKey
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, )
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)

class Song(Base):
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    source_url = Column(String)
    duration = Column(Integer)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
class Loop(Base):
    __tablename__ = "loops"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_id = Column(Integer, ForeignKey("songs.id"))
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    name = Column(String)