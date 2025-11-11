# 🌐 HongShi Netlify Edge DoH Proxy (with UI & Root DNS)

一个可直接部署在 **Netlify Edge Functions** 上的高性能 DNS-over-HTTPS (DoH) 代理。  
支持 Cloudflare / Google / Quad9 等上游 DNS，内置一个优雅的 `/ui` 网页，可直接输入域名进行解析查询。

---

## 🚀 功能特性

- ✅ **兼容 RFC 8484**：支持二进制 DoH（`application/dns-message`）
- 🌍 **根路径即服务**：`/` 可直接作为 DoH 端点  
  （POST 或 GET `?dns=` 参数自动识别）
- 🔄 **传统路径保留**：`/dns-query` 继续支持
- 🧠 **JSON API**：`/resolve?name=example.com&type=A` 返回 DoH JSON 结构
- 💡 **可视化 UI**：访问 `/ui` 即可使用内置查询界面
- ⚡ **基于 Edge Functions**：毫秒级响应，零冷启动
- 🔒 **CORS 支持**：默认允许所有来源，可配置限制
- 🧩 **可选 IP 辅助接口**：
  - `/ip` → 返回访问者 IP
  - `/ip-info` → 返回地理与网络信息（使用 Cloudflare Trace）

---

## 🏗️ 部署步骤

1. **Fork 或上传仓库**  
   将整个目录推送到 GitHub（包含以下结构）：



netlify-doh/
├─ netlify.toml
├─ public/
│  ├─ index.html       # 简介
│  └─ ui
│  │   └─ index.html     # DNS 查询 UI
│  └─  favicon.png
└─ netlify/
     └─ edge-functions/
          └─ dns.ts        # 核心逻辑



2. **连接到 Netlify**  
在 [Netlify](https://app.netlify.com/) 创建站点 → 选择你的仓库 → 自动部署。

3. **设置环境变量（可选）**  
在 **Site settings → Environment variables** 添加如下配置：

| 变量名 | 作用 | 默认值 | 示例 |
|--------|------|--------|------|
| `DOH` | 上游 DoH 服务器主机或 URL | `cloudflare-dns.com` | `dns.google` / `https://dns.quad9.net/dns-query` |
| `PATH` | 自定义二进制 DoH 路径 | `dns-query` | `PATH=mydns` → `/mydns` 可访问 |
| `TOKEN` | 与 PATH 等价（旧版兼容） | — | `TOKEN=mysecret` |
| `URL` | 保留字段（兼容旧版） | — | — |
| `ALLOW_ORIGIN` | CORS 允许来源 | `*` | `https://dns-ui.example.com` |
| `DEBUG` | 输出诊断信息（JSON 模式下） | `false` | `true` |
| `ROOT_DOH` | 控制根路径是否启用 DoH 服务 | `true` | `false` |

4. **重新部署**  
保存后，Netlify 会自动构建并发布。

---

## 🌎 使用方式

### 1️⃣ 浏览器访问
- 主页：`https://<你的域名>/`
- 可视化 UI：`https://<你的域名>/ui`

### 2️⃣ JSON DoH API
```bash
curl "https://<你的域名>/resolve?name=example.com&type=A"
````

返回示例：

```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "AD": true,
  "Question": [{ "name": "example.com.", "type": 1 }],
  "Answer": [{ "name": "example.com.", "type": 1, "TTL": 296, "data": "93.184.216.34" }]
}
```

### 3️⃣ 二进制 DoH

```bash
curl -s -H 'accept: application/dns-message' \
  "https://<你的域名>/dns-query?dns=<base64url-encoded-DNS-message>"
```

或 POST：

```bash
curl -s -X POST -H 'content-type: application/dns-message' \
  --data-binary @query.bin "https://<你的域名>/dns-query"
```

> 若设置 `ROOT_DOH=true`，上述请求也可直接发往 `/`。

---

## 💅 UI 页面

访问：

```
https://<你的域名>/ui
```

可以：

* 输入域名与记录类型（A、AAAA、TXT、MX 等）
* 点击「查询」按钮
* 立即查看结果表格 + 原始 JSON

UI 页面示例：

![ui](https://user-images.githubusercontent.com/00000000/placeholder.png)

---

## 🧪 调试

### 查看 Edge Logs

在 Netlify 控制台 → **Functions → dns** → **Logs**

### 本地预览

```bash
npm i -g netlify-cli
netlify dev
```

---

## 🧱 技术栈

* Netlify Edge Functions (Deno runtime)
* Web 标准 `fetch / Request / Response / Headers / URL`
* HTML + JS + Tailwind-like 原生样式 UI

---

## 📝 License

MIT © 2025 HongShi
欢迎 fork 并二次开发。若用于自建 DoH 服务，请遵守目标上游的使用条款。
