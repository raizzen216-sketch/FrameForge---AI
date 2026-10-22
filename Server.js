const express = require('express');
const app = express();
app.use(express.json({ limit: '8mb' }));

const TOKEN = process.env.REPLICATE_API_TOKEN;
// Modell kann in Render unter Environment mit REPLICATE_MODEL geändert werden
const MODEL = process.env.REPLICATE_MODEL || 'kwaivgi/kling-v2.1-master';
const API = 'https://api.replicate.com/v1';
const headers = () => ({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });

const PAGE = String.raw`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FrameForge AI</title>
<style>
body{margin:0;background:#101116;color:#fff;font-family:Arial,sans-serif;padding:20px;max-width:720px;margin:auto}
h1{color:#baff68;margin-bottom:0}
.card{background:#1c1e28;padding:18px;border-radius:16px;margin-top:18px}
textarea,select,input{width:100%;box-sizing:border-box;padding:12px;margin:8px 0;background:#11131a;color:#fff;border:1px solid #444;border-radius:9px;font-size:16px}
button{width:100%;padding:14px;margin-top:10px;border:0;border-radius:10px;font-weight:bold;background:#baff68;color:#111;font-size:16px}
button:disabled{opacity:.5}
small{color:#aaa}
video{width:100%;border-radius:10px}
#status{min-height:1.4em}
.ok{color:#baff68}.err{color:#ff7b7b}
</style>
</head>
<body>
<h1>&#9672; FrameForge AI</h1>
