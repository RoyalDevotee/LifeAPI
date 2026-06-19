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
  .then(data => data.output[0].content[0].text);
}

// --- ROUTES ---
app.get("/", (req, res) => {
  res.send("LifeAPI Online!");
});

app.get("/script", (req, res) => {
  res.sendFile(path.join(__dirname, "script", "connect.js"));
});

app.get("/connect", (req, res) => {
  res.send("LifeAPI CONNECTED!");
});

app.get("/ip", (req, res) => {
  res.send(req.ip);
});

// PicSee API 錯誤代碼繁體中文對照表
const picseeErrorCodes = {
  "PUB00001": "發生未預期的錯誤，請稍後再試。",
  "PUB00002": "請求參數無效，請檢查輸入網址。",
  "PUB00005": "已超過 API 請求頻率限制，請稍候再試。",
  "PUB00006": "找不到所請求的伺服器資源。",
  "PUB00007": "已達到 LifeTools 的短網址額度限制。",
  "PUB00202": "此長網址被 PicSee 判定為無效或不安全的網址，請嘗試其他網址。",
  "PUB00301": "找不到所請求的短網址。",
  "PUB00504": "所請求的短網址已被刪除。",
  "PUB00505": "所請求短網址的原始網域無效。",
  "PUB00508": "無權限編輯此短網址的到期時間。",
  "PUB00509": "到期時間無效，您只能設定未來的時間。",
  "PUB00510": "此短網址不允許被更新指向至該目標網址。",
  "PUB00511": "此短網址屬於其他用戶，您無權修改。",
  "PUB00512": "無效的圖片網址格式。",
  "PUB00513": "標籤數量已達上限，無法再新增標籤。",
  "PUB00601": "批次建立短網址時發生錯誤，請重試。",
  "PUB00701": "找不到所請求的短網址。",
  "PUB01001": "網址格式不正確，網址必須是字串並包含通訊協定（http/https）與路徑。"
};

// 縮短網址路由 (串接 PicSee API)
// 專業版短網址路由 (整合 Pro 權限驗證與 PicSee 服務)
app.post("/shorturl", (req, res) => {
    const longUrl = req.body.url;
    const userPasskey = req.body.passkey; // 接收前端送來的 Pro 密鑰

    // 1. 執行 Pro 專業版權限安全驗證
    if (!proAuth(userPasskey)) {
        // 驗證失敗時，直接中斷請求並回傳 403 拒絕存取狀態
        return res.status(403).send("PRO 驗證失敗：您輸入的專業版密鑰不正確或已失效，無權限使用此工具。若需申請密鑰，請聯絡 royaldevotee@nxlab.zone.id。");
    }

    // 2. 檢查請求中是否包含必填之原始長網址
    if (!longUrl) {
        return res.status(400).send("ERROR 400: URL parameter is required.");
    }

    // 3. 向 PicSee 伺服器發送 POST 請求
    fetch("https://api.pics.ee/v1/links", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.PICSEEKEY}` // 採用 Bearer 驗證
        },
        body: JSON.stringify({
            url: longUrl,
            domain: "nxlab.pse.is" // 指定自訂短網域
        })
    })
    .then(response => {
        // 4. 處理錯誤回應，解析出 PicSee 專屬的 PUB 代碼
        if (!response.ok) {
            return response.text().then(errText => {
                let chineseErrorMessage = "縮網址伺服器回應異常，請稍候再試。";
                try {
                    const errorObject = JSON.parse(errText);
                    const errorCode = errorObject?.error?.code;
                    
                    // 若能在對照表中找到對應代碼，使用優雅的中文描述
                    if (errorCode && picseeErrorCodes[errorCode]) {
                        chineseErrorMessage = picseeErrorCodes[errorCode];
                    } else {
                        // 備用無對應代碼時的輸出
                        chineseErrorMessage = `PicSee 錯誤 [${errorCode || "UNKNOWN"}]: ${errorObject?.error?.message || "未知錯誤"}`;
                    }
                } catch (parseError) {
                    // 萬一非 JSON 格式時的備用處理
                    chineseErrorMessage = `連線異常 (HTTP ${response.status})`;
                }
                throw new Error(chineseErrorMessage);
            });
        }
        return response.json();
    })
    .then(data => {
        // 5. 驗證並提取回傳的 picseeUrl
        if (data && data.data && data.data.picseeUrl) {
            res.send(data.data.picseeUrl); // 成功回傳短網址字串
        } else {
            throw new Error("PicSee 回傳之資料格式異常");
        }
    })
    .catch(err => {
        // 6. 錯誤處理，回傳 400 狀態碼與更直觀的中文錯誤給前端
        console.error("PicSee API error:", err);
        res.status(400).send(err.message);
    });
});

/**
 * AI 賽博網頁圖卡生成器路由 (Type C)
 * 整合現有 Pro 驗證機制與 gpt-5.4-nano 運算服務
 */
app.post("/html-generator", (req, res) => {
    const { passkey, prompt, systemPrompt, ratio } = req.body;

    // 1. 執行 Pro 專業版權限驗證
    if (!proAuth(passkey)) {
        return res.status(403).send("PRO 驗證失敗：您輸入的專業版密鑰不正確或已失效，無權限使用此工具。若需申請密鑰，請聯絡 royaldevotee@nxlab.zone.id。");
    }

    // 2. 檢查必要參數
    if (!prompt) {
        return res.status(400).send("ERROR 400: Prompt parameter is required.");
    }

    // 3. 頻率限制 (比照原本的 /ai 路由)
    if ((Date.now() - lastReq) < 5000) {
        lastReq = Date.now();
        return res.status(429).send("ERROR 429: Too many requests.");
    }
    lastReq = Date.now();

    // 4. 重組指令，並傳入現有的 askGPT 處理
    const combinedPrompt = `${systemPrompt || "請生成美觀的 HTML/CSS 圖卡"}\n\n[使用者設計主題]：${prompt}\n[指定尺寸比例]：${ratio || "1:1"}`;

    askGPT(combinedPrompt)
        .then(result => {
            // 回傳 JSON 格式以配合同步開發的前端代碼解析
            res.json({ code: result });
        })
        .catch(err => {
            console.error("HTML Generator API error:", err);
            res.status(500).send(err.message);
        });
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

// --- Pro ---
function proAuth (key) {
    const proMembers = process.env.PRO.split(",");
    if (proMembers.includes(key)) {
        return true;
    } else {
        return false;
    }
}

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
