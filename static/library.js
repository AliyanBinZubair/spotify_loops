const token = localStorage.getItem("token");
const audioPlayer = document.getElementById("player");
const miniPlayer = document.getElementById("mini-player");
const nowPlayingTitle = document.getElementById("now-playing-title");
const playPauseBtn = document.getElementById("play-pause-btn");
const progressFill = document.getElementById("progress-fill");
const loopCenterFill = document.getElementById("center-fill");
const addSongBtn = document.getElementById("add-song-btn")
const addSongCard = document.getElementById("add-song-card");
const totalDurationText = document.getElementById("total-duration-text"); 
const currentTimeText = document.getElementById("current-time-text"); 
const progressBar = document.getElementById("progress-bar");
const loopRegionEl = document.getElementById("loop-region");
const leftHandle = document.getElementById("loop-handle-left");
const rightHandle = document.getElementById("loop-handle-right");
const toggelSegmentButton = document.getElementById("toggle-segment-btn");
const previousSong = document.getElementById("Previous-song");
const nextSong = document.getElementById("Next-song");
const loopEl = document.getElementById("loop");
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const Home = document.getElementById("home-btn");
const Downloads = document.getElementById("download-btn");
const pageTitle = document.getElementById("page-title");
const offlineMessage = document.getElementById("offline-message");
const MIN_LOOP_LENGTH =8;
const DEFAULT_LOOP_LENGTH = 30;
const SETTINGS_CLOSE_MS = 250;     // must match the animation duration in CSS
let settingsCloseTimer = null;
let pressStartedOnHandle = false;
let currentSongId = null;
let currentSongTitle = null;
let loopStart = null;
let loopEnd = null;
let segmentLoopActive = false;
let wasPlayingBeforeDrag = false;
let songs = [];
let currentSong = null;
let loop = false;
let deviceDB = null;
let inDownloads = false;      // true while the Downloads tab is open
let currentObjectUrl = null;  // the temporary address of the song being played



//  SECURITY CHECK
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




// opens the browser database (creates it the first time)
function openDeviceDB() {
    return new Promise((resolve, reject) => {
        const userId = localStorage.getItem("userId");
        if (!userId) {
            reject(new Error("user id is not saved yet"));
            return;
        }
        const request = indexedDB.open("music-db-" + userId, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("songs", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


// stores one song (its id, title and the audio file) in that database
function saveSongToDevice(song, blob) {
    return new Promise((resolve, reject) => {
        const tx = deviceDB.transaction("songs", "readwrite");
        tx.objectStore("songs").put({ id: song.id, title: song.title, blob: blob });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}


// reads all the songs saved on this device
function getDownloadedSongs() {
    return new Promise((resolve, reject) => {
        const tx = deviceDB.transaction("songs", "readonly");
        const request = tx.objectStore("songs").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// deletes one saved song from the device (the server copy is not touched)
function deleteSavedSong(id) {
    return new Promise((resolve, reject) => {
        const tx = deviceDB.transaction("songs", "readwrite");
        tx.objectStore("songs").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// reads only the ids of the saved songs (not the audio files)
function getDownloadedIds() {
    return new Promise((resolve, reject) => {
        const tx = deviceDB.transaction("songs", "readonly");
        const request = tx.objectStore("songs").getAllKeys();
        request.onsuccess = () => resolve(new Set(request.result));
        request.onerror = () => reject(request.error);
    });
}


// reads ONE saved song by its id
function getSavedSong(id) {
    return new Promise((resolve, reject) => {
        const tx = deviceDB.transaction("songs", "readonly");
        const request = tx.objectStore("songs").get(id);
        request.onsuccess = () => resolve(request.result);   // undefined if not found
        request.onerror = () => reject(request.error);
    });
}


// shows them in the song list area
async function showDownloads() {
    if (!deviceDB) deviceDB = await openDeviceDB();
    const downloaded = await getDownloadedSongs();
    songs = downloaded;

    const listEl = document.getElementById("song-list");
    listEl.innerHTML = "";

    if (downloaded.length === 0) {
        listEl.textContent = "No downloaded songs yet.";
        return;
    }

    downloaded.forEach((song, index) => {
        const row = document.createElement("div");
        row.className = "track-row";
        row.dataset.songId = song.id;
        row.dataset.index = index + 1;
        row.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <div class="track-title"></div>
                <div class="track-artist">Unknown Artist</div>
            </div>
            <button class="track-remove" title="Remove from device">
                <svg class="track-remove-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 7h16"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M6 7l1 13h10l1-13"/>
                    <path d="M9 7V4h6v3"/>
                </svg>
            </button>`;
        row.querySelector(".track-title").textContent = song.title;

        row.querySelector(".track-remove").addEventListener("click", async (e) => {
            e.stopPropagation();           // don't also start playing the song
            await deleteSavedSong(song.id);
            showDownloads();               // redraw the list without it
        });
        
        row.addEventListener("click", () => playSong(song.id, song.title));
        listEl.appendChild(row);
    });
    const listSpacer = document.createElement("div");
    listSpacer.style.height = "120px"; // Gives enough clearance over the mini-player
    listEl.appendChild(listSpacer);

    highlightPlayingRow(currentSongId);
}

// to move to download seciton
function openDownloads() {
    inDownloads = true;
    showDownloads();
    Home.classList.remove("active");
    Downloads.classList.add("active");
    addSongCard.classList.add("hidden");
    pageTitle.textContent = "Downloads";
}
Downloads.addEventListener("click", openDownloads);

Home.addEventListener("click", () =>{
    inDownloads = false;
    loadSongs();
    Home.classList.add("active");
    Downloads.classList.remove("active");
    addSongCard.classList.remove("hidden");
    pageTitle.textContent = "Your Library";
    });





//   SHORT LOOP REGION SETUP
function updateLoopRegionDisplay() {
    if (loopStart === null || loopEnd === null || !audioPlayer.duration) return;
    const startPercent = (loopStart / audioPlayer.duration) * 100;
    const endPercent = (loopEnd / audioPlayer.duration) * 100;
    loopRegionEl.style.left = startPercent + "%";
    loopRegionEl.style.width = (endPercent - startPercent) + "%";
}

function enterSegmentMode() {
    if (!audioPlayer.duration) return;

    segmentLoopActive = true;
    toggelSegmentButton.classList.add("active");
    progressBar.classList.add("segment-active");
    loopRegionEl.classList.remove("hidden");

    let start = audioPlayer.currentTime;
    let end = start + DEFAULT_LOOP_LENGTH;
    if (end > audioPlayer.duration) {
        end = audioPlayer.duration;
        start = Math.max(0, end - DEFAULT_LOOP_LENGTH);
    }
    loopStart = start;
    loopEnd = end;
    updateLoopRegionDisplay();

    audioPlayer.currentTime = loopStart;
    audioPlayer.loop = false;
}

function exitSegmentMode() {
    segmentLoopActive = false;
    progressBar.classList.remove("segment-active");
    loopRegionEl.classList.add("hidden");
    toggelSegmentButton.classList.remove("active");
}



// ADDING EVENTLISTENER FOR SHORT LOOP

toggelSegmentButton.addEventListener("click", (e) => {
    if (segmentLoopActive) {
        exitSegmentMode();
        e.currentTarget.classList.remove("active");
    } else {
        enterSegmentMode();
        e.currentTarget.classList.add("active");
    }
});




// HANDLING START AND END OF THE SHORT LOOP
function startDrag(handleType) {
    return function (e) {
        e.preventDefault();
        wasPlayingBeforeDrag = !audioPlayer.paused;
        audioPlayer.pause();

        function onMove(moveEvent) {
            const rect = progressBar.getBoundingClientRect();
            let percent = (moveEvent.clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            const time = percent * audioPlayer.duration;

            if (handleType === "left") {
                loopStart = Math.max(0, Math.min(time, loopEnd - MIN_LOOP_LENGTH));
            } else {
                loopEnd = Math.min(audioPlayer.duration, Math.max(time, loopStart + MIN_LOOP_LENGTH));
            }
            updateLoopRegionDisplay();
        }

        function onUp() {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            if (wasPlayingBeforeDrag) audioPlayer.play();
        }

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
    };
}

leftHandle.addEventListener("pointerdown", startDrag("left"));
rightHandle.addEventListener("pointerdown", startDrag("right"));



// // ADDING EVENTLISTENER FOR LOOP
loopEl.addEventListener("click", e => {
    if(!loop){
        loop = true;
        e.currentTarget.classList.add("active")
    }else{
        e.currentTarget.classList.remove("active")
        loop = false;
    };
})



//    PLAYING THE SONG THAT USER HAS SELECTED

async function playSong(songId, title) {
    // 1. Guard against undefined or missing ID
    if (!songId || songId === "undefined") {
        console.error("Cannot play song: invalid songId", songId);
        return;
    }

    if (currentSongId === songId) {
        togglePlayPause();
        return;
    }

    let newObjectUrl = null;
    let source;
    if (inDownloads) {
        const saved = await getSavedSong(songId);
        if (!saved) {
            alert("This song is not saved on this device.");
            return;
        }
        newObjectUrl = URL.createObjectURL(saved.blob);   // temporary address for the saved file
        source = newObjectUrl;
    } else {
        source = "/songs/" + songId + "/play?token=" + token;
    }

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);   // free the previous one
    currentObjectUrl = newObjectUrl;

    currentSongId = songId;
    currentSong = songs.findIndex(song => song.id === songId) /* give index of the current song */
    audioPlayer.src = source;
    audioPlayer.play();
    
    nowPlayingTitle.textContent = title;
    miniPlayer.classList.remove("hidden");
    playPauseBtn.textContent = "⏸";

    highlightPlayingRow(songId);
    exitSegmentMode()
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
playPauseBtn.addEventListener("click", togglePlayPause);


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



// TAKING THE FULL DURATION OF THE SONG
audioPlayer.addEventListener("loadedmetadata", () => {
    totalDurationText.textContent = formatTime(audioPlayer.duration);
});



//   SHOWING THE CURRENT TIME AND UPDATING THE PREGRESS BAR FILL 

audioPlayer.addEventListener("timeupdate", () => {
    // Continuous numerical text tracker updates
    currentTimeText.textContent = formatTime(audioPlayer.currentTime);

    if (audioPlayer.duration ) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = percent + "%";
    }
    if (segmentLoopActive && loopStart !== null && loopEnd !== null) {
        if (audioPlayer.currentTime >= loopEnd || audioPlayer.currentTime < loopStart) {
            audioPlayer.currentTime = loopStart;
        }
        const loopDuration = loopEnd - loopStart;
        const loopPercent = ((audioPlayer.currentTime - loopStart) / loopDuration)*100;
        loopCenterFill.style.width = loopPercent + "%";
    }
});



// SHOWING AND UPDATING THE PROGRESS BAR BASED ON USER INPUT 


// capture phase, so it runs before anything else on the bar
progressBar.addEventListener("pointerdown", (e) => {
    pressStartedOnHandle = !!e.target.closest(".loop-handle");
}, true);

progressBar.addEventListener("click", (e) => {
    if (pressStartedOnHandle) return; 
    if (!audioPlayer.duration) return; // nothing loaded yet
    
    // Main progress bar
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const targetTime = percent * audioPlayer.duration;

    if (segmentLoopActive){
        if (targetTime > loopStart && targetTime < loopEnd ) {
            const loopDuration = loopEnd - loopStart;
            const loopPercent = ((targetTime - loopStart) / loopDuration)*100;
            audioPlayer.currentTime = targetTime;
            loopCenterFill.style.width = loopPercent + "%";
        }
    }
    else{
        audioPlayer.currentTime = percent * audioPlayer.duration;
        progressFill.style.width = (percent * 100) + "%";
    }
    // Instantly sync text string layout upon scrubbing timeline track
    currentTimeText.textContent = formatTime(audioPlayer.currentTime);
});




const DOWNLOAD_SVG = `
    <svg class="dl-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle class="dl-circle" cx="12" cy="12" r="10"/>
        <g class="dl-arrow">
            <line x1="12" y1="7.5" x2="12" y2="16.5"/>
            <polyline points="8.5 13 12 16.5 15.5 13"/>
        </g>
        <polyline class="dl-check" points="7.5 12.5 10.5 15.5 16.5 9"/>
    </svg>`;

// switches the button between "not downloaded" and "downloaded"
function setDownloadButton(btn, isDownloaded) {
    btn.classList.toggle("downloaded", isDownloaded);
    btn.title = isDownloaded ? "Downloaded" : "Download";
}

//    LOADING THE LIST OF SONGS THAT USER HAVE ADDED 

async function loadSongs() {
    let response;
    try {
        response = await fetch("/songs", {
            headers: { "Authorization": "Bearer " + token },
            signal: AbortSignal.timeout(1000)     // give up after 1 second
        });
    } catch (error) {
        // fetch only throws when the server can't be reached at all
        offlineMessage.classList.remove("hidden");
        openDownloads();
        return;
    }
    offlineMessage.classList.add("hidden");   // the server answered, so hide the message

    if (!response.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        window.location.href = "/";
        return;
    }

    songs = await response.json();

    let downloadedIds = new Set();
    try {
        if (!localStorage.getItem("userId")) await loadUsername();   // the id is needed to open the right database
        if (!deviceDB) deviceDB = await openDeviceDB();
        downloadedIds = await getDownloadedIds();
    } catch (error) {
        console.error("could not read downloads:", error);
    }

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
                <div class="track-title"></div>
                <div class="track-artist">Unknown Artist</div>
            </div>
            <button class="track-download">${DOWNLOAD_SVG}</button>`;
        row.querySelector(".track-title").textContent = song.title;

        const downloadBtn = row.querySelector(".track-download");
        setDownloadButton(downloadBtn, downloadedIds.has(song.id));   // check mark if already saved

        downloadBtn.addEventListener("click", async (e) => {
            e.stopPropagation();   // stops the click from also playing the song
            if (downloadBtn.classList.contains("downloaded") || downloadBtn.classList.contains("loading")) return;

            downloadBtn.classList.add("loading"); 
            try {
                const response = await fetch("/songs/" + song.id + "/download",
                    { headers: { "Authorization": "Bearer " + token } }
                );
                if (!response.ok) throw new Error("download failed");

                const blob = await response.blob();
                if (!deviceDB) deviceDB = await openDeviceDB();
                await saveSongToDevice(song, blob);

                downloadBtn.classList.remove("loading");
                setDownloadButton(downloadBtn, true);   // circle fills, check mark appears
                downloadBtn.classList.add("pop");       // little bounce
            } catch (error) {
                console.error(error);
                downloadBtn.classList.remove("loading");
                alert("something went wrong!");
            }
        });

        row.addEventListener("click", () => playSong(song.id, song.title));
        listEl.appendChild(row);
    });

    const listSpacer = document.createElement("div");
    listSpacer.style.height = "120px"; // Gives enough clearance over the mini-player
    listEl.appendChild(listSpacer);

    highlightPlayingRow(currentSongId);
}
loadSongs();


// ADD EVENT LISTENER FOR FOR PREVIOUS SONG

function PreviousSong(){
    if (songs.length === 0) return;
    const i = songs.findIndex(s => s.id === currentSongId);   // where the playing song is in the list now
    currentSong = i <= 0 ? songs.length - 1 : i - 1;
    const songToPlay = songs[currentSong];
    playSong(songToPlay.id, songToPlay.title);
}
previousSong.addEventListener("click",PreviousSong);


//  ADD EVENT LISTENER FOR NEXT SONG
function NextSong(){
    if (songs.length === 0) return;
    const i = songs.findIndex(s => s.id === currentSongId);
    currentSong = (i + 1) % songs.length;    // % wraps back to 0 after the last song
    const songToPlay = songs[currentSong];
    playSong(songToPlay.id, songToPlay.title);
}
nextSong.addEventListener("click",NextSong)

// if the song ends
audioPlayer.addEventListener("ended",() =>{
    if (loop){
        audioPlayer.currentTime = 0
        audioPlayer.play()
    }else{
        NextSong()
    }
})
    
    

//  ADDING THE SONG BY USING URL PROVIDED BY THE USER 

document.getElementById("add-song-btn").addEventListener("click", async () => {
    const titleInput = document.getElementById("song-title");
    const urlInput = document.getElementById("song-url");
    
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();

    // 1. Store original button HTML & activate loading UI
    const originalBtnText = addSongBtn.innerHTML;
    addSongBtn.disabled = true;
    addSongBtn.classList.add("btn-loading");
    addSongBtn.innerHTML = `<span class="spinner"></span> Downloading...`;

    try{
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
            titleInput.value = "";
            urlInput.value = "";
            loadSongs();
        ;}

    } catch(error){
        console.error("Error downloading song:", error);
        document.getElementById("add-message").textContent = "Failed to download song from URL. Please check the URL and try again."

    }finally {
        // 3. Restore original button state
        addSongBtn.disabled = false;
        addSongBtn.classList.remove("btn-loading");
        addSongBtn.innerHTML = originalBtnText;
    }
});




// logout btn

document.getElementById("logout-btn").addEventListener("click", () => {
    // stop the music first
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.replace("/");
});



// SETTINGS 

function openSettings() {
    clearTimeout(settingsCloseTimer);           // in case it was mid-close
    settingsOverlay.classList.remove("closing", "hidden");
    document.body.style.overflow = "hidden";
}

function closeSettings() {
    if (settingsOverlay.classList.contains("hidden") ||
        settingsOverlay.classList.contains("closing")) return;

    settingsOverlay.classList.add("closing");
    settingsCloseTimer = setTimeout(() => {
        settingsOverlay.classList.add("hidden");
        settingsOverlay.classList.remove("closing");
        document.body.style.overflow = "";
    }, SETTINGS_CLOSE_MS);
}

settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);

// click on the dark backdrop (not on the panel) closes it
settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsOverlay.classList.contains("hidden")) closeSettings();
    if (e.key === "Escape" && settingsOverlay.classList.contains("hidden")) openSettings();
});

// show the logged-in username in the panel
async function loadUsername() {
    try {
        const response = await fetch("/me", { headers: { "Authorization": "Bearer " + token } });
        if (response.ok) {
            const me = await response.json();
            document.getElementById("settings-username").textContent = me.username;
            localStorage.setItem("userId", me.id);
        }
    } catch (error) {
        // server not reachable, leave the username empty
    }
}
loadUsername();




// SERVICE WORKER
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("service worker registered"))
        .catch((err) => console.error("service worker failed:", err));
}