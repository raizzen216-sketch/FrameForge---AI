
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "FrameForge AI",
    message: "Backend läuft!"
  });
});

app.post("/api/generate", (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      error: "Bitte gib eine Videoidee ein."
    });
  }

  res.status(501).json({
    status: "not_configured",
    message:
      "Das Backend ist erreichbar, aber die Video-KI muss noch verbunden werden."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FrameForge AI läuft auf Port ${PORT}`);
});
