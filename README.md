# HongShi-DoH (Netlify + Vercel)

一个同时支持 **Netlify Edge Functions** 与 **Vercel Edge Runtime (Next.js App Router)** 的 DNS-over-HTTPS (DoH) 项目。

## 功能一览
- 根路径 `/` 支持 DoH（GET `?dns=...` / POST `application/dns-message`），浏览器直访会跳转到 UI。
- `/dns-query`：二进制 DoH 端点（RFC 8484）。
- `/resolve`：JSON DoH 端点（UI 与程序使用）。
- `/ui`：可视化查询页面（支持选择当前站点 / Cloudflare / Google / 自定义 DoH）。
- `/ip`、`/ip-info`：辅助接口。

头像位于 `public/favicon.png` 与 `vercel/public/favicon.png`，UI 会显示你的头像。

---

## 目录结构
```
HongShi-DoH-all-in-one/
├─ netlify.toml                 # Netlify 发布配置（publish=public，映射 Edge Functions 路径）
├─ public/                      # Netlify 静态资源（含 /ui 页面与 favicon）
│  ├─ index.html
│  └─ ui/
│     └─ index.html
├─ netlify/
│  └─ edge-functions/
│     └─ dns.ts                 # Netlify Edge 逻辑（已包含 Cloudflare/Google JSON 兼容）
└─ vercel/                      # Vercel (Next.js 14 App Router) 工程
   ├─ package.json
   ├─ next.config.js
   ├─ public/
   │  └─ favicon.png
   └─ app/
      ├─ route.ts               # 根路径：DoH & 跳转 /ui
      ├─ dns-query/route.ts
      ├─ resolve/route.ts
      └─ ui/page.tsx
```

---

## 环境变量
| 变量名 | 说明 | 默认值 | 例子 |
|---|---|---|---|
| `DOH` | 上游 DoH 主机或 URL（会自动取 host） | `cloudflare-dns.com` | `dns.google` / `https://dns.quad9.net/dns-query` |
| `PATH` | 自定义二进制 DoH 路径 | `dns-query` | `PATH=mydns` → `/mydns` 可用 |
| `TOKEN` | 与 PATH 等价（兼容旧用法） | — | `TOKEN=mysecret` |

> Netlify 在 **Site settings → Environment variables** 设置；  
> Vercel 在 **Project → Settings → Environment Variables** 设置。

---

## 部署到 Netlify
1. 把本仓库连接 Netlify。
2. 确保根目录存在 `public/` 与 `netlify.toml`（已提供）：
   ```toml
   [build]
     publish = "public"
   
   [[edge_functions]]
   path = "/"
   function = "dns"
   
   [[edge_functions]]
   path = "/dns-query"
   function = "dns"
   
   [[edge_functions]]
   path = "/resolve"
   function = "dns"
   
   [[edge_functions]]
   path = "/ip"
   function = "dns"
   
   [[edge_functions]]
   path = "/ip-info"
   function = "dns"
   ```
3. （可选）设置环境变量 `DOH`、`PATH`/`TOKEN`，然后部署。

### Netlify 常见问题
- **/resolve 直连 Cloudflare 返回 404/502**：已修复。代码会对 `dns.google` 走 `/resolve`，其他（如 `cloudflare-dns.com`）走 `/dns-query?ct=application/dns-json` 并带 `Accept: application/dns-json`。

---

## 部署到 Vercel
1. 将 `vercel/` 目录内容作为项目根（或创建一个新仓库仅放该目录内容）。
2. 连接 Vercel，设置环境变量（同上）。
3. 部署后：
   - `/`：DoH（GET `?dns=` / POST `application/dns-message`）或跳转 `/ui`
   - `/dns-query`：二进制 DoH
   - `/resolve`：JSON DoH
   - `/ui`：查询界面

> 若你的仓库既包含 `netlify` 又包含 `vercel` 文件，推荐针对 **Vercel** 新建一个只含 `vercel/` 的 repo 以避免误识别构建环境。

---

## 本地调试（可选）
- **Netlify**：
  ```bash
  npm i -g netlify-cli
  netlify dev
  ```
- **Vercel**：
  ```bash
  cd vercel
  npm i
  npm run dev
  ```

---

## 变更记录（要点）
- 为 Cloudflare JSON DoH 适配 `/dns-query?ct=application/dns-json`，避免 404。
- `/resolve` 增加错误捕获与 502 JSON 返回，便于前端展示错误。
- UI 焕新：暖色渐变 + 玻璃化卡片，加入「Get JSON」与「清除」。
