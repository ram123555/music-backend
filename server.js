// -------------------------------
// IMPORTS
// -------------------------------
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// -------------------------------
// INIT
// -------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Ensure upload directories exist
const dirs = ["uploads", "uploads/tmp", "uploads/songs", "uploads/covers"];
dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Serve static with MIME support (important for m4a/mp3)
app.use("/uploads", express.static("uploads", {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mp3")) res.set("Content-Type", "audio/mpeg");
        if (filePath.endsWith(".m4a")) res.set("Content-Type", "audio/mp4");
        if (filePath.endsWith(".wav")) res.set("Content-Type", "audio/wav");
    }
}));

// Load songs.json safely
let songs = [];
try { songs = require("./songs.json"); } catch { songs = []; }

// ----------------------------------------
// MULTER TEMP STORAGE
// ----------------------------------------
const upload = multer({ dest: "uploads/tmp/" });

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

            const finalSongPath = path.join("uploads/songs", songNewName);
            const finalCoverPath = path.join("uploads/covers", coverNewName);

            // Move from tmp -> final
            fs.renameSync(songFile.path, finalSongPath);
            fs.renameSync(coverFile.path, finalCoverPath);

            const newSong = {
                id: Date.now(),
                title: req.body.title || "Unknown",
                artist: req.body.artist || "Unknown",
                cover: `http://localhost:3000/uploads/covers/${coverNewName}`,
                src: `http://localhost:3000/uploads/songs/${songNewName}`
            };

            songs.push(newSong);
            fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

            res.json({
                message: "Song uploaded successfully!",
                song: newSong
            });

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

    if (!song) {
        return res.status(404).json({ error: "Song not found" });
    }

    // File system paths
    const songPath = path.join("uploads/songs", path.basename(song.src));
    const coverPath = path.join("uploads/covers", path.basename(song.cover));

    if (fs.existsSync(songPath)) fs.unlinkSync(songPath);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);

    songs = songs.filter(s => s.id !== id);
    fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

    res.json({ message: "Song deleted successfully!" });
});

// ----------------------------------------
// API: EDIT SONG (title + artist only)
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

        if (!song) {
            return res.status(404).json({ error: "Song not found" });
        }

        // Update text info
        song.title = req.body.title || song.title;
        song.artist = req.body.artist || song.artist;

        // (If you want file edit later, we can add here)

        fs.writeFileSync("songs.json", JSON.stringify(songs, null, 2));

        res.json({ message: "Song updated successfully!", song });
    }
);

// ----------------------------------------
// START SERVER
// ----------------------------------------
app.listen(3000, () => {
    console.log("🎵 Music API running at http://localhost:3000");
});
