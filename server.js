
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
body{margin:0;padding:24px;background:#101116;color:#fff;font-family:Arial,sans-serif;max-width:850px;margin:auto}
h1{color:#baff68}
.card{background:#1c1e28;padding:18px;border-radius:16px;margin-top:18px}
textarea,select,input{width:100%;padding:12px;margin:8px 0;background:#11131a;color:white;border:1px solid #444;border-radius:9px}
button{width:100%;padding:14px;margin-top:10px;border:0;border-radius:10px;font-weight:bold;background:#baff68;color:#111}
small{color:#aaa}
video{width:100%;margin-top:15px;border-radius:10px}
</style>
</head>
<body>
<h1>◈ FrameForge AI</h1>
<p>Deine Idee. Dein Film.</p>
<div class="card">
<h3>Video erstellen</h3>
<textarea id="prompt" rows="5" placeholder="Beschreibe dein Video"></textarea>
<label>Videoformat</label>
<select id="format">
<option value="9:16">9:16 – TikTok / Reels</option>
<option value="16:9">16:9 – YouTube</option>
<option value="1:1">1:1 – Quadrat</option>
</select>
<label>Videolänge</label>
<select id="duration">
<option value="5">5 Sekunden</option>
<option value="10">10 Sekunden</option>
</select>
<button onclick="improve()">Prompt verbessern</button>
<button id="generate" onclick="generate()">Video generieren</button>
<p id="status" role="status"></p>
<div id="preview"></div>
</div>
<script>
function improve(){
 const p=document.getElementById("prompt");
 if(!p.value.trim()){
   document.getElementById("status").textContent="Gib zuerst eine Videoidee ein.";
   return;
 }
 p.value += ". Cinematic lighting, realistic details, smooth motion, professional composition, no text, no logos.";
 document.getElementById("status").textContent="Prompt verbessert.";
}

async function generate(){
 const status=document.getElementById("status");
 const button=document.getElementById("generate");
 const prompt=document.getElementById("prompt").value.trim();
 const aspect_ratio=document.getElementById("format").value;
 const duration=Number(document.getElementById("duration").value);

 if(!prompt){
   status.textContent="Bitte gib eine Videoidee ein.";
   return;
 }

 button.disabled=true;
 status.textContent="Video wird gestartet. Das kann einige Minuten dauern.";
 document.getElementById("preview").replaceChildren();

 try{
   const r=await fetch("/api/generate",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({prompt,aspect_ratio,duration})
   });
   const data=await r.json();
   if(!r.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");

   let prediction=data;
   for(let i=0;i<120;i++){
     if(prediction.status==="succeeded"){
       const url=Array.isArray(prediction.output)
         ? prediction.output[0] : prediction.output;
       if(!url) throw new Error("Kein Video zurückgegeben.");
       const video=document.createElement("video");
       video.src=url;
       video.controls=true;
       video.playsInline=true;
       document.getElementById("preview").appendChild(video);
       status.textContent="Fertig! Dein Video wurde erstellt.";
       return;
     }
     if(prediction.status==="failed" || prediction.status==="canceled"){
       throw new Error(prediction.error || "Generierung fehlgeschlagen.");
     }
     status.textContent="Video wird generiert: "+prediction.status+" ...";
     await new Promise(resolve=>setTimeout(resolve,5000));
     const check=await fetch("/api/videos/"+encodeURIComponent(prediction.id));
     prediction=await check.json();
     if(!check.ok) throw new Error(prediction.error || "Statusabfrage fehlgeschlagen.");
   }
   throw new Error("Die Generierung dauert zu lange. Bitte später erneut versuchen.");
 }catch(e){
   status.textContent="Fehler: "+e.message;
 }finally{
   button.disabled=false;
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
    app: "FrameForge AI",
    tokenConfigured: Boolean(TOKEN),
    model: MODEL
  });
});

app.post(["/api/generate", "/api/videos"], async (req, res) => {
  try {
    if (!TOKEN) {
      return res.status(500).json({
        error: "REPLICATE_API_TOKEN fehlt in Render Environment."
      });
    }

    const prompt = String(req.body.prompt || "").trim();
    const aspect_ratio = String(req.body.aspect_ratio || "16:9");
    const duration = Number(req.body.duration || 5);

    if (!prompt) {
      return res.status(400).json({ error: "Prompt fehlt." });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: "Der Prompt ist zu lang." });
    }
    if (!["16:9", "9:16", "1:1"].includes(aspect_ratio)) {
      return res.status(400).json({ error: "Ungültiges Videoformat." });
    }
    if (![5, 10].includes(duration)) {
      return res.status(400).json({
        error: "Dieses Modell unterstützt hier 5 oder 10 Sekunden."
      });
    }

    const response = await fetch(`${API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait=5"
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio, duration }
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
    console.error("Generation error:", error);
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

    const response = await fetch(
      `${API}/predictions/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.detail || data.title || "Status konnte nicht geladen werden."
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Fehler beim Abrufen des Videostatus." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("FrameForge AI läuft auf Port " + PORT);
});
