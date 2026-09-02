# Cloudflare Workers 生产迁移手册

本手册对应 `lolicon.meme` 的 GitHub + Cloudflare Workers Static Assets + D1 架构。执行外部步骤前，先确认已获得 commit/push、Cloudflare 资源和 DNS 修改授权。

当前状态（已核验）：D1 `my-blog-stats` 已在 APAC 创建，`wrangler.jsonc` 已写入真实 `database_id`；迁移 `0001_blog_stats.sql` 已远端应用；旧站快照 `visitors=8`、`pageviews=49` 已完成 seed 并读回核对。Worker 预览尚未成功：资源已上传，但当前被 Cloudflare 邮箱验证错误码 `10034` 阻塞。DNS 尚未修改。

## 1. 本地验收

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

`wrangler.jsonc` 已包含 `my-blog-stats` 的真实 `database_id`，可供后续 Wrangler 远端操作使用。

## 2. 创建并初始化 D1

登录目标 Cloudflare 账户后执行：

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create my-blog-stats --location apac --binding BLOG_DB --update-config
pnpm exec wrangler d1 migrations apply BLOG_DB --remote
```

生产切换前，从旧站 `/api/stats` 读取最后一次 `{ visitors, pageviews }` 快照，人工核对后写入 D1：

```bash
pnpm d1:seed -- --remote --visitors 8 --pageviews 49
```

当前已使用旧站快照 `8/49` 完成远端 seed 并读回核对。后续切换时若快照变化，替换为核对后的真实数字；脚本只接受非负整数，并要求显式选择 `--remote`，避免误写生产数据库。

## 3. 首次预览发布

预览当前尚未成功：Cloudflare 已完成资源上传，但因邮箱验证错误码 `10034` 暂时阻塞。验证恢复后，再执行以下命令并验收 `*.workers.dev` 地址。

```bash
pnpm build
pnpm exec wrangler deploy
```

先只验收 Cloudflare 提供的 `*.workers.dev` 地址：主页、移动端、Swup 导航、音乐首次播放与 Range 206、`/api/stats`、`/api/visit`、友链车站和浏览器控制台。

## 4. GitHub 自动发布

在 Cloudflare Workers Builds 连接公开仓库 `S7arFish/my-bag`：

- Production branch：`main`
- Build command：`pnpm build`
- Deploy command：`pnpm exec wrangler deploy`
- Root directory：仓库根目录

验证一次普通提交能够完成自动构建并更新 `*.workers.dev`，再进行域名切换。

## 5. 域名切换

DNS 当前保持不变。完成预览和生产 canary 验收并取得明确授权后，再执行以下域名切换步骤。

1. 在 Cloudflare 添加 `lolicon.meme` zone。
2. 把 Cloudflare 给出的两条 Nameserver 填入 Spaceship。
3. 等 zone 变为 Active。
4. 把 `lolicon.meme` 绑定为 Worker Custom Domain。
5. 创建 `www.lolicon.meme` 到根域名的 301/308 重定向，保留路径与查询参数。

不要在 Spaceship 额外创建指向 `workers.dev` 的根域 CNAME；Custom Domain 会在 Cloudflare zone 内管理对应 DNS 记录。

## 6. 生产 canary 与回滚

切换后验证 TLS、canonical、sitemap、RSS、关键静态资源、音乐 206、D1 读写和一次 GitHub 自动发布。短期保留 Tailscale MiniBlog 与 SQLite。

若新 Worker 版本异常，优先回滚 Cloudflare Worker 到上一个成功版本，不回滚或删除 D1。若域名路由本身异常，可临时将根域访问重定向到原 Tailscale 地址，修复后再撤销。
