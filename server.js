
const express = require("express");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL =
  process.env.REPLICATE_MODEL || "kwaivgi/kling-v2.1-master";

const API = "https://api.replicate.com/v1";

const PAGE = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FrameForge AI</title>
<style>
*{box-sizing:border-box}
body{
 margin:0;padding:24px;background:#0c0d12;color:#f5f5f7;
 font-family:Arial,sans-serif;max-width:850px;margin:auto
}
h1{font-size:36px;margin-bottom:6px;color:#c3ff70}
.sub{color:#a4a5b1;line-height:1.6}
.card{
 background:#171922;border:1px solid #292c38;border-radius:18px;
 padding:22px;margin-top:20px
}
label{display:block;margin:16px 0 8px;font-weight:bold}
textarea,select{
 width:100%;padding:14px;border-radius:10px;
 background:#0d0f15;color:white;border:1px solid #373b49;
 font-size:16px
}
textarea{min-height:145px;resize:vertical}
button{
 width:100%;padding:15px;margin-top:16px;border:0;
 border-radius:10px;background:#c3ff70;color:#10120b;
 font-size:16px;font-weight:bold;cursor:pointer
}
button:disabled{opacity:.5;cursor:wait}
#status{margin-top:18px;line-height:1.6;overflow-wrap:anywhere}
video{width:100%;margin-top:18px;border-radius:12px;background:#000}
small{color:#a4a5b1}
a{color:#c3ff70}
</style>
</head>
<body>
<h1>◈ FrameForge AI</h1>
<div class="sub">Deine kreative KI-Videowerkstatt.</div>

<div class="card">
<h2>Video erstellen</h2>
<label for="prompt">Was soll im Video passieren?</label>
<textarea id="prompt" placeholder="Beispiel: Ein Sportwagen fährt bei Nacht durch eine futuristische Stadt, filmische Beleuchtung, realistische Kamerabewegung"></textarea>

<label for="ratio">Videoformat</label>
<select id="ratio">
<option value="16:9">16:9 – Querformat</option>
<option value="9:16">9:16 – Hochformat</option>
<option value="1:1">1:1 – Quadrat</option>
</select>

<button id="create" onclick="createVideo()">Video generieren</button>
<div id="status" role="status"></div>
<div id="result"></div>
</div>

<p><small>Die Videogenerierung benötigt einen gültigen Replicate-Token und kann Kosten verursachen.</small></p>

<script>
const statusBox = document.getElementById("status");
const button = document.getElementById("create");

async function createVideo(){
 const prompt = document.getElementById("prompt").value.trim();
 const aspect_ratio = document.getElementById("ratio").value;

 if(!prompt){
   statusBox.textContent = "Bitte gib zuerst eine Beschreibung ein.";
   return;
 }

 button.disabled = true;
 document.getElementById("result").innerHTML = "";
 statusBox.textContent = "Video wird gestartet ...";

 try {
   const response = await fetch("/api/videos", {
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({prompt,aspect_ratio})
   });

   const data = await response.json();
   if(!response.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");

   let prediction = data;
   statusBox.textContent = "Video wird generiert. Bitte warten ...";

   for(let i=0;i<120;i++){
     await new Promise(resolve=>setTimeout(resolve,5000));

     const check = await fetch("/api/videos/" + encodeURIComponent(prediction.id));
     const current = await check.json();

     if(!check.ok) throw new Error(current.error || "Statusabfrage fehlgeschlagen.");

     prediction = current;

     if(prediction.status === "succeeded"){
       const output = Array.isArray(prediction.output)
         ? prediction.output[0] : prediction.output;

       if(!output) throw new Error("Das Modell hat kein Video zurückgegeben.");

       const video = document.createElement("video");
       video.controls = true;
       video.playsInline = true;
       video.src = output;
       document.getElementById("result").appendChild(video);

       const link = document.createElement("a");
       link.href = output;
       link.target = "_blank";
       link.rel = "noopener";
       link.textContent = "Video in neuem Tab öffnen";
       document.getElementById("result").appendChild(link);

       statusBox.textContent = "Fertig! Dein Video wurde erstellt.";
       return;
     }

     if(prediction.status === "failed" || prediction.status === "canceled"){
       throw new Error(prediction.error || "Die Videogenerierung ist fehlgeschlagen.");
     }

     statusBox.textContent = "Status: " + prediction.status + " ...";
   }

   throw new Error("Die Generierung dauert zu lange. Prüfe den Status später erneut.");
 } catch(error) {
   statusBox.textContent = "Fehler: " + error.message;
 } finally {
   button.disabled = false;
 }
}
</script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.type("html").send(PAGE);
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    tokenConfigured: Boolean(TOKEN),
    model: MODEL
  });
});

app.post("/api/videos", async (req, res) => {
  try {
    if (!TOKEN) {
      return res.status(500).json({
        error: "REPLICATE_API_TOKEN fehlt in den Render Environment Variables."
      });
    }

    const prompt = String(req.body.prompt || "").trim();
    const aspect_ratio = String(req.body.aspect_ratio || "16:9");

    if (!prompt) {
      return res.status(400).json({ error: "Prompt fehlt." });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({ error: "Der Prompt ist zu lang." });
    }

    if (!["16:9", "9:16", "1:1"].includes(aspect_ratio)) {
      return res.status(400).json({ error: "Ungültiges Videoformat." });
    }

    const response = await fetch(`${API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait=5"
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Replicate API error:", response.status, data);
      return res.status(response.status).json({
        error: data.detail || data.title || "Replicate hat die Anfrage abgelehnt."
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Video creation error:", error);
    res.status(500).json({ error: "Serverfehler beim Starten des Videos." });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  try {
    if (!TOKEN) {
      return res.status(500).json({ error: "API-Token fehlt." });
    }

    const id = req.params.id;

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({ error: "Ungültige Video-ID." });
    }

    const response = await fetch(`${API}/predictions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Replicate status error:", response.status, data);
      return res.status(response.status).json({
        error: data.detail || "Status konnte nicht geladen werden."
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Fehler beim Abrufen des Videostatus." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FrameForge AI läuft auf Port ${PORT}`);
});
