from PIL import Image

src = Image.open("static/music_player_icon.png").convert("RGBA")
for size in (192, 512):
    src.resize((size, size), Image.LANCZOS).save(f"static/icon-{size}.png")
print("icons created")