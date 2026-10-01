from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import Base, User, Song, Loop
from schemas import UserCreate, UserLogin, SongCreate, LoopCreate
from auth import hash_password, verify_password, create_access_token
from dependencies import get_current_user, download_audio_from_youtube, decode_access_token
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os


SONGS_DIR = "songs_storage"
app = FastAPI()
Base.metadata.create_all(bind=engine)
app.mount("/static", StaticFiles(directory="static"), name="static")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")

@app.get("/library")
def serve_library():
    return FileResponse("static/library.html")

@app.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}
    

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pw = hash_password(user.password)
    new_user = User(username=user.username, password_hash=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    token = create_access_token({"user_id": new_user.id})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()

    if db_user is None or not verify_password(user.password, db_user.password_hash):
        return {"error": "invalid username or password"}
    
    token = create_access_token({"user_id": db_user.id})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/songs")
def upload_song(song: SongCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_song = db.query(Song).filter(Song.source_url == song.source_url).first()
    if existing_song is not None:
        return {"id": existing_song.id, "title": existing_song.title, "file_path": existing_song.file_path}

    file_path = download_audio_from_youtube(song.source_url, SONGS_DIR, song.title)

    new_song = Song(title=song.title, file_path=file_path, source_url=song.source_url)
    db.add(new_song)
    db.commit()
    db.refresh(new_song)

    return {"id": new_song.id, "title": new_song.title, "file_path": new_song.file_path}



@app.get("/songs")
def list_songs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    songs = db.query(Song).all()
    return [{"id": s.id, "title": s.title} for s in songs]



@app.post("/song_delete")
def Delete(song_name ,current_user : User = Depends(get_current_user), db: Session = Depends(get_db)):
    song_to_delete = db.query(Song).filter(Song.title == song_name).first()

    if song_to_delete:
        file_path = song_to_delete.file_path

        # delete the actual file from disk
        if os.path.exists(file_path):
            os.remove(file_path)
            # print("Deleted file:", file_path)
        else:
            return{"File not found on disk": file_path}

        # delete the row from the database
        db.delete(song_to_delete)
        db.commit()
        return{"message":"Deleted from DB:"+ song_to_delete.title}
    else:
        return{"error":"Not found in DB"}



@app.get("/songs/{song_id}/play")
def play_song(song_id: str, token: str, db: Session = Depends(get_db)):
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    song = db.query(Song).filter(Song.id == song_id).first()

    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")

    if not os.path.exists(song.file_path):
        raise HTTPException(status_code=404, detail="Audio file missing from disk")

    return FileResponse(
        path=song.file_path,
        media_type="audio/mpeg",
        headers={"Content-Disposition": f'inline; filename="{song.title}.mp3"'}
    )
    

@app.post("/loops")
def create_loop(loop: LoopCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_loop = Loop(
        user_id=current_user.id,
        song_id=loop.song_id,
        start_time=loop.start_time,
        end_time=loop.end_time,
        name=loop.name
    )
    db.add(new_loop)
    db.commit()
    db.refresh(new_loop)
    return {
        "id": new_loop.id,
        "song_id": new_loop.song_id,
        "start_time": new_loop.start_time,
        "end_time": new_loop.end_time,
        "name": new_loop.name
    }

@app.get("/loops/{song_id}")
def get_loops_for_song(song_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    loops = db.query(Loop).filter(Loop.song_id == song_id, Loop.user_id == current_user.id).all()
    return [
        {"id": l.id, "start_time": l.start_time, "end_time": l.end_time, "name": l.name}
        for l in loops
    ]