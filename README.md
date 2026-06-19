# LifeAPI
## 給LifeTools專用的API後端

### 1. 匯入LifeAPI:
#### 在HTML的```<head></head>```標籤內加入以下HTML:
```
<script src="https://lifetools.nett.to/scripts/lifeapi.js"></script>
```

### 2. 串接LifeAPI:
#### 在HTML的```<script></script>```內先寫好要用的function (這裡以```exfunc()```示範)
#### 再寫入下列這段:
```
function exfunc () {
  console.log("API server連接成功!");
}
console.log("API server連接中...");
connect()
  .then(exfunc())
  .catch(console.error);
```

### 3. 路由介紹:
1.
```
GET https://lifeapi.zone.id/ip
```
#### 介紹: 使用Express Server的trust proxy來取得req.ip
#### 回應: 使用者目前IP

2.
```
POST https://lifeapi.zone.id/ai
```
請求body:
```
{"prompt": "問AI的問題..."}
```
#### 介紹: 把單次問題用OpenAI API發給GPT-5.4 Nano
#### 回應: 純AI的回答

3.
```
POST https://lifeapi.zone.id/shorturl
```
請求body:
```
{"url": "https://example.com"}
```
#### 介紹: 把URL丟給PICSEE做縮網址
#### 回應: 純短網址
