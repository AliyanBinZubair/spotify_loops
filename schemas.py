from pydantic import BaseModel

class AccountDelete(BaseModel):
    password: str
    
class LoopCreate(BaseModel):
    song_id: int
    start_time: float
    end_time: float
    name: str | None = None
class SongCreate(BaseModel):
    title: str
    source_url: str

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str