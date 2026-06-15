// --- MODULE IMPORTS ---
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.set('trust proxy', true);
app.use(express.json());

var lastReq = 0;

// --- CONFIG ---
const PORT = process.env.PORT || 3000;

// --- DEBUG LOG MIDDLEWARE ---
app.use((req, res, next) => {
    try {
        console.log(
            "IP:", req.ip,
            "PATH:", req.path,
            "UA:", req.headers["user-agent"],
            "BODY:", JSON.stringify(req.body || {})
        );
    } catch {}
    next();
});

// --- SECURITY HEADERS ---
app.use((req, res, next) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// --- FUNCTIONS ---
function askGPT(prompt) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAIKEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      service_tier: "flex",
      input: prompt
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => {
        throw new Error(
          err.error?.message || `HTTP ${response.status}`
        );
      });
    }
    return response.json();
  })
  .then(data => data[0].content[0].text);
}

// --- ROUTES ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "script", "connect.js"));
});

app.get("/connect", (req, res) => {
  res.send("LifeAPI CONNECTED!");
});

app.get("/ip", (req, res) => {
  res.send(req.ip);
});

app.post("/ai", (req, res) => {
  if ((Date.now() - lastReq) < 5000) {
      lastReq = Date.now();
      res.status(429).send("ERROR 429: Too many requests.");
  } else {
    lastReq = Date.now();
    askGPT(req.body.prompt)
      .then(result => {
        res.send(result);
      })
      .catch(err => res.status(500).send(err.message));
  }
});

// --- FALLBACK ---
const blockedPaths = [
  // sensitive files
  ".env",
  ".git",
  ".git/",
  ".git/config",
  ".DS_Store",

  // wordpress
  "wp-admin",
  "wp-login.php",
  "xmlrpc.php",

  // graphql probing
  "graphql",
  "api/graphql",
  "graphql/api",
  "api/gql",

  // docker / registry
  "v2/_catalog",
  "v2/",

  // admin / panels
  "admin",
  "login.action",
  "server-status",
  "server-info",
  "console",

  // enterprise exploit targets
  "ecp",
  "owa",
  "autodiscover",

  // cpanel / whm
  "cpanel",
  "whm",
  "___proxy_subdomain_cpanel",
  "___proxy_subdomain_whm",

  // misc common scanner targets
  "phpmyadmin",
  "pma",
  "backend",
  "debug",
  "actuator",
  "metrics"
];

const blockedUA = [
  "l9scan",
  "Leakix",
  "sqlmap",
  "nikto",
  "nmap",
  "acunetix",
  "zgrab",
  "masscan"
];

app.all("*", (req, res) => {
  const path = (req.path || "").toLowerCase();
  const ua = (req.headers["user-agent"] || "").toLowerCase();

  // UA block
  const isBadUA = blockedUA.some(bad => ua.includes(bad.toLowerCase()));

  // Path block
  const isBadPath = blockedPaths.some(p => path.includes(p));

  if (isBadUA || isBadPath) {
    return res.status(403).send("ERROR 403: Do not try to exploit our API backend.");
  }

  // default pass-through (important if you still have routes below)
  return res.status(404).send("ERROR 404: Not Found");
});

// --- START ---
app.listen(PORT, () => {
    console.log(`LifeAPI Launched: ${PORT}`);
});
