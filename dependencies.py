from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User
from auth import decode_access_token
import yt_dlp, os

def download_audio_from_youtube(url: str, output_dir: str, filename_base: str) -> str:
    output_template = os.path.join(output_dir, f"{filename_base}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",   # download the best quality audio track available
        "outtmpl": output_template,   # save it using the filename pattern above
        "cookiesfrombrowser": ("firefox",),  # use the cookies of a browser where you're signed in
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",}],
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)

    # by now the mp3 file exists on disk at this path, so we return it
    return os.path.join(output_dir, f"{filename_base}.mp3")


security = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user