// -------------------------------
// IMPORTS
// -------------------------------
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// -------------------------------
// INIT
// -------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Get BASE_URL (important for Render deployment)
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Create upload folders (safe)
const uploadRoot = path.join(process.cwd(), "uploads");
const dirs = [
    uploadRoot,
    path.join(uploadRoot, "tmp"),
    path.join(uploadRoot, "songs"),
    path.join(uploadRoot, "covers")
];
dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Serve static files
app.use("/uploads", express.static(uploadRoot, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mp3")) res.set("Content-Type", "audio/mpeg");
        if (filePath.endsWith(".wav")) res.set("Content-Type", "audio/wav");
        if (filePath.endsWith(".m4a")) res.set("Content-Type", "audio/mp4");
    }
}));

// Load songs.json safely
let songs = [];
try { songs = require("./songs.json"); } catch { songs = []; }

// Multer Storage
const upload = multer({ dest: path.join(uploadRoot, "tmp") });

// ----------------------------------------
// API: GET ALL SONGS
// ----------------------------------------
app.get("/api/songs", (req, res) => {
    res.json(songs);
});

// ----------------------------------------
// API: UPLOAD SONG + COVER
// ----------------------------------------
app.post(
    "/api/upload",
    upload.fields([
        { name: "song", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    (req, res) => {
        try {
            if (!req.files.song || !req.files.cover) {
                return res.status(400).json({ error: "Song & cover required!" });
            }

            const songFile = req.files.song[0];
            const coverFile = req.files.cover[0];

            // sanitize names
            const safeSong = songFile.originalname.replace(/[^a-zA-Z0-9.\-_ ]/g, "");
            const safeCover = coverFile.originalname.replace(/[^a-zA-Z0-9.\-_ ]/g, "");

            const songNewName = Date.now() + "-" + safeSong;
            const coverNewName = Date.now() + "-" + safeCover;

            const finalSongPath = path.join(uploadRoot, "songs", songNewName);
            const finalCoverPath = path.join(uploadRoot, "covers", coverNewName);

            // Move from tmp → final
            fs.renameSync(songFile.path, finalSongPath);
            fs.renameSync(coverFile.path, finalCoverPath);

            const newSong = {
                id: Date.now(),
                title: req.body.title || "Unknown",
                artist: req.body.artist || "Unknown",
                cover: `${BASE_URL}/uploads/covers/${coverNewName}`,
                src: `${BASE_URL}/uploads/songs/${songNewName}`
            };

            songs.push(newSong);
            fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

            res.json({ message: "Song uploaded successfully!", song: newSong });

        } catch (err) {
            console.log("UPLOAD ERROR:", err);
            return res.status(500).json({ error: "Upload failed", details: err });
        }
    }
);

// ----------------------------------------
// API: DELETE SONG
// ----------------------------------------
app.delete("/api/songs/:id", (req, res) => {
    const id = Number(req.params.id);
    const song = songs.find(s => s.id === id);

    if (!song) return res.status(404).json({ error: "Song not found" });

    const songPath = path.join(uploadRoot, "songs", path.basename(song.src));
    const coverPath = path.join(uploadRoot, "covers", path.basename(song.cover));

    if (fs.existsSync(songPath)) fs.unlinkSync(songPath);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);

    songs = songs.filter(s => s.id !== id);
    fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

    res.json({ message: "Song deleted successfully!" });
});

// ----------------------------------------
// API: EDIT SONG (title + artist)
// ----------------------------------------
app.put(
    "/api/songs/:id",
    upload.fields([
        { name: "song", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    (req, res) => {
        const id = Number(req.params.id);
        const song = songs.find(s => s.id === id);

        if (!song) return res.status(404).json({ error: "Song not found" });

        song.title = req.body.title || song.title;
        song.artist = req.body.artist || song.artist;

        fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

        res.json({ message: "Song updated", song });
    }
);

// ----------------------------------------
// START SERVER
// ----------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎵 Music API running at ${BASE_URL}`);
});
