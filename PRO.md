# LifeAPI Pro使用手冊:

### Pro的核心在於後端API

驗證function (變數key是使用者給的key):
```
proAuth(key);
```
驗證成功: 返回true
驗證失敗: 返回false

後端驗證 (以短網址為例，req.body.passkey是前端送來的pro key):
```
app.post("/shorturl", (req, res) => {
  if (proAuth(req.body.passkey)) {
    這裡是確認Pro之後的程式碼...
  } else {
    res.status(403).send("Pro passkey錯誤 你沒有權限使用此工具");
  }
});
```
