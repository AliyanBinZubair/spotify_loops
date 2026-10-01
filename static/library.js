const token = localStorage.getItem("token");
const audioPlayer = document.getElementById("player");
const miniPlayer = document.getElementById("mini-player");
const nowPlayingTitle = document.getElementById("now-playing-title");
const playPauseBtn = document.getElementById("play-pause-btn");
const progressFill = document.getElementById("progress-fill");
const progressBar = document.getElementById("progress-bar");
const totalDurationText = document.getElementById("total-duration-text"); 
const currentTimeText = document.getElementById("current-time-text"); 
let currentSongId = null;
let loopStart = null;
let loopEnd = null;
let loopingEnabled = false;

if (!token) {
    window.location.href = "/";
}


// Helper function to convert seconds to clean M:SS strings (e.g. 65 -> "1:05")
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

document.getElementById("set-start-btn").addEventListener("click", () => {
    loopStart = audioPlayer.currentTime;
    console.log("Loop start set to", loopStart);
});

document.getElementById("set-end-btn").addEventListener("click", () => {
    loopEnd = audioPlayer.currentTime;
    console.log("Loop end set to", loopEnd);
});

document.getElementById("toggle-loop-btn").addEventListener("click", (e) => {
    loopingEnabled = !loopingEnabled;
    e.currentTarget.classList.toggle("active", loopingEnabled);
});

document.getElementById("save-loop-btn").addEventListener("click", async () => {
    if (loopStart === null || loopEnd === null || currentSongId === null) {
        alert("Set both a start and end point first");
        return;
    }

    await fetch("/loops", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            song_id: currentSongId,
            start_time: loopStart,
            end_time: loopEnd
        })
    });

    alert("Loop saved!");
});



function playSong(songId, title) {
    if (currentSongId === songId) {
        togglePlayPause();
        return;
    }
    currentSongId = songId;
    audioPlayer.src = "/songs/" + songId + "/play?token=" + token;
    audioPlayer.play();
    
    nowPlayingTitle.textContent = title;
    miniPlayer.classList.remove("hidden");
    playPauseBtn.textContent = "⏸";

    highlightPlayingRow(songId);
}

function togglePlayPause() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.textContent = "⏸";
        activeRow.querySelector(".track-number").innerHTML =
            '<span class="playing-icon"><span></span><span></span><span></span></span>';
    } else {
        audioPlayer.pause();
        playPauseBtn.textContent = "▶";
        activeRow.querySelector(".track-number").innerHTML = "▶"
    }
}

function highlightPlayingRow(songId) {
    document.querySelectorAll(".track-row").forEach(row => {
        row.classList.remove("playing");
        row.querySelector(".track-number").innerHTML = row.dataset.index;
    });

    const activeRow = document.querySelector(`[data-song-id="${songId}"]`);
    globalThis.activeRow = activeRow
    if (activeRow) {
        activeRow.classList.add("playing");
        activeRow.querySelector(".track-number").innerHTML =
        '<span class="playing-icon"><span></span><span></span><span></span></span>';
    }
}

playPauseBtn.addEventListener("click", togglePlayPause);

// Update full duration stamp once song metadata handles loading
audioPlayer.addEventListener("loadedmetadata", () => {
    totalDurationText.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener("timeupdate", () => {
    // Continuous numerical text tracker updates
    currentTimeText.textContent = formatTime(audioPlayer.currentTime);

    if (audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = percent + "%";
    }
    if (loopingEnabled && loopStart !== null && loopEnd !== null) {
        if (audioPlayer.currentTime >= loopEnd) {
            audioPlayer.currentTime = loopStart;
        }
    }
});



progressBar.addEventListener("click", (e) => {
    if (!audioPlayer.duration) return; // nothing loaded yet

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;

    audioPlayer.currentTime = percent * audioPlayer.duration;
    progressFill.style.width = (percent * 100) + "%";

    // Instantly sync text string layout upon scrubbing timeline track
    currentTimeText.textContent = formatTime(audioPlayer.currentTime);
});


async function loadSongs() {
    const response = await fetch("/songs", {
        headers: { "Authorization": "Bearer " + token }
    });

    if (!response.ok) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
    }

    const songs = await response.json();
    const listEl = document.getElementById("song-list");
    listEl.innerHTML = "";

    songs.forEach((song, index) => {
        const row = document.createElement("div");
        row.className = "track-row";
        row.dataset.songId = song.id;
        row.dataset.index = index + 1;
        row.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <div class="track-title">${song.title}</div>
                <div class="track-artist">Unknown Artist</div>
            </div>
            <button class="track-heart">➕</button>`;
        row.addEventListener("click", () => playSong(song.id, song.title));
        listEl.appendChild(row);
    });

    const listSpacer = document.createElement("div");
    listSpacer.style.height = "120px"; // Gives enough clearance over the mini-player
    listEl.appendChild(listSpacer);
}


document.getElementById("add-song-btn").addEventListener("click", async () => {
    const title = document.getElementById("song-title").value;
    const url = document.getElementById("song-url").value;

    const response = await fetch("/songs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ title, source_url: url })
    });

    const data = await response.json();

    if (response.ok) {
        document.getElementById("add-message").textContent = "Added!";
        loadSongs();
    } else {
        document.getElementById("add-message").textContent = data.detail || "Failed to add song";
    }
});

loadSongs();