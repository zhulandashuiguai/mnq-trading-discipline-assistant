# MNQ 交易纪律助手

面向 MNQ / QQQ 日内交易的手动入场与出场条件清单，支持 Windows 桌面端、网页 PWA 与同一账户跨设备同步。

## 本地运行

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev:web
```

填写 `.env.local` 中的 Supabase 项目地址和匿名密钥后，再使用 `npm run dev` 启动 Electron。

## Supabase 配置

1. 创建一个 Supabase 项目，在 SQL Editor 中执行 `supabase/migrations/202607280001_single_user_sync.sql`。
2. 在 Authentication 的 Email 设置中启用邮箱确认和密码重置。
3. 将站点 URL 设为 `https://zhulandashuiguai.github.io/mnq-trading-discipline-assistant/`，并将相同地址加入 Redirect URLs。
4. 在项目 Settings > API 中取得 Project URL 与 anon key。匿名密钥可用于前端；不要将 `service_role` 密钥放入应用或 GitHub。
5. 在 GitHub 仓库的 Settings > Secrets and variables > Actions > Variables 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

随后重新运行 GitHub Pages 工作流，或推送到 `main` 发布新的 HTTPS 版本。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```
