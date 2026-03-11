# RackNerd VPS 部署说明

本项目推荐部署形态：

- `Node.js` 应用跑在 `127.0.0.1:4321`
- `systemd` 负责常驻与重启
- `nginx` 负责 `80/443` 入口和反向代理
- 域名解析托管在 `Cloudflare`

## 1. 本地准备

确认本地有以下命令：

- `ssh`
- `scp`
- `tar`

给脚本执行权限：

```bash
chmod +x ./scripts/deploy_racknerd.sh
```

## 2. 最小部署

下面命令会把当前项目打包上传到 VPS，自动安装 `Node.js 22`、`nginx`，然后创建 `systemd` 服务：

```bash
VPS_HOST=YOUR_VPS_IP \
DOMAIN=blog.example.com \
SITE_NAME="OpenClaw Reading" \
SITE_OWNER="Ella" \
./scripts/deploy_racknerd.sh
```

脚本默认使用 `DEPLOY_MODE=detached`，也就是：

- 本地上传代码后立刻返回
- VPS 在后台继续部署
- 即使 SSH 会话波动，远端部署也不会被一起杀掉
- 默认附带 SSH keepalive，降低长连接被中途断开的概率

默认行为：

- 远端目录：`/var/www/wikiblog`
- SSH 用户：`root`
- SSH 端口：`22`
- 应用端口：`4321`
- 服务名：`wikiblog`

## 3. 带 SSL 的部署

如果你准备用 `Let's Encrypt`，在 Cloudflare 里先把域名记录设置成 `DNS only`，再执行：

```bash
VPS_HOST=YOUR_VPS_IP \
DOMAIN=blog.example.com \
CERTBOT_EMAIL=ops@example.com \
./scripts/deploy_racknerd.sh
```

证书签发成功后，可以再把 Cloudflare 的代理切回 `Proxied`。

如果你还要同时支持别名域名，例如根域和 `www`：

```bash
VPS_HOST=YOUR_VPS_IP \
DOMAIN=example.com \
DOMAIN_ALIASES="www.example.com" \
CERTBOT_EMAIL=ops@example.com \
./scripts/deploy_racknerd.sh
```

## 4. 常用可选参数

```bash
VPS_HOST=YOUR_VPS_IP \
DOMAIN=blog.example.com \
VPS_USER=root \
VPS_PORT=22 \
APP_NAME=wikiblog \
APP_DIR=/var/www/wikiblog \
APP_PORT=4321 \
NODE_MAJOR=22 \
DOMAIN_ALIASES="www.example.com" \
OPENCLAW_API_KEY=demo-key \
OBSIDIAN_VAULT_PATH=/data/obsidian/知识库 \
OBSIDIAN_ROOT_PATH=/data/obsidian \
./scripts/deploy_racknerd.sh
```

如果你明确想前台等待完整输出，可以手动切成：

```bash
DEPLOY_MODE=attached ./scripts/deploy_racknerd.sh
```

如果你的网络特别容易断，可以把 keepalive 再调高一点：

```bash
SSH_SERVER_ALIVE_INTERVAL=10 SSH_SERVER_ALIVE_COUNT_MAX=12 ./scripts/deploy_racknerd.sh
```

如果你必须用密码登录，而且本地已安装 `sshpass`，也可以直接传：

```bash
SSH_PASSWORD='your-password' ./scripts/deploy_racknerd.sh
```

如果你已经配置了专用 SSH key，推荐显式指定：

```bash
SSH_IDENTITY_FILE=~/.ssh/racknerd_wikiblog ./scripts/deploy_racknerd.sh
```

## 5. 部署后检查

在 VPS 上检查：

```bash
systemctl status wikiblog
systemctl status nginx
journalctl -u wikiblog -n 100 --no-pager
curl http://127.0.0.1:4321/api/v1/health
```

如果脚本是后台模式启动的，先看部署日志：

```bash
tail -n 80 /var/log/wikiblog-deploy-*.log
```

## 6. Cloudflare 绑定域名

`https://nerdvm.racknerd.com/` 是 RackNerd 的 `SolusVM` 控制面板，不是绑定站点域名的地方。它主要用于：

- 开关机
- 重装系统
- 修改 VPS hostname
- 打开 VNC

真正让站点域名生效，分两层：

### 6.1 Cloudflare DNS

在 Cloudflare 的 DNS 页面添加：

- `A` 记录：`@` -> 你的 VPS IPv4
- `CNAME` 记录：`www` -> `@`

建议：

- 首次签发 `Let's Encrypt` 时，先设为 `DNS only`
- 证书签发完成后，再切到 `Proxied`
- 如果你的 VPS 有旧的 `AAAA` 记录但并未正确配置 IPv6，删掉或不要新增 `AAAA`

### 6.2 VPS 站点配置

本仓库里的部署脚本会自动生成 `nginx` 配置，并写入：

- `server_name your-domain`，以及可选的 `DOMAIN_ALIASES`
- 反向代理到 `127.0.0.1:4321`

如果你手动改配置，文件位置是：

- `/etc/nginx/sites-available/wikiblog`

## 7. nerdvm.racknerd.com 里你可能要做的事

如果你想让服务器主机名和域名一致，可以登录 `nerdvm.racknerd.com`：

1. 打开你的 VPS
2. 进入 `Hostname` 功能
3. 把主机名改成类似 `blog.example.com`
4. 重启 VPS

这一步不是站点可访问的必要条件，只是让机器 hostname 更整洁。

## 8. Cloudflare SSL 推荐配置

推荐顺序：

1. Cloudflare DNS 先指向 VPS，记录设为 `DNS only`
2. 跑部署脚本并签发 `Let's Encrypt`
3. 访问 `https://your-domain` 确认证书正常
4. Cloudflare 代理切到 `Proxied`
5. Cloudflare `SSL/TLS` 模式设为 `Full (strict)`

如果你不想在源站使用 `Let's Encrypt`，也可以改用 `Cloudflare Origin Certificate`，但当前脚本默认走标准的 `Let's Encrypt`。
