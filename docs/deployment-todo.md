# Deployment TODO

## 当前可做

- 在 Cloudflare 中将目标域名或子域名指向 VPS 公网 IP
- 保持 DNS 记录为 `DNS only`
- 确认本地可以通过 `ssh` 登录 RackNerd VPS
- 确认 VPS 使用 Debian 或 Ubuntu，且具备 `root` 或可提权账号
- 确认计划使用的域名，例如 `example.com` 或 `blog.example.com`

## 网站部署

- 给部署脚本添加执行权限：`chmod +x ./scripts/deploy_racknerd.sh`
- 用生产参数执行部署脚本
- 检查 `systemd` 服务是否正常
- 检查 `nginx` 反向代理是否正常
- 访问 `http://域名/api/v1/health` 验证站点在线

## HTTPS 待办

- 保持 Cloudflare DNS 为 `DNS only`
- 在 VPS 上用 `certbot` 签发 Let's Encrypt 证书
- 验证 `https://域名` 可正常访问
- 为可选别名域名一并签发证书，例如 `www.example.com`
- 确认 `certbot renew` 自动续期可用
- 证书正常后，将 Cloudflare 记录切换为 `Proxied`
- 在 Cloudflare `SSL/TLS` 中设置 `Full (strict)`

## 部署后收尾

- 如需保护上传接口，配置 `OPENCLAW_API_KEY`
- 如需接入 Obsidian 内容源，配置 `OBSIDIAN_VAULT_PATH`
- 检查日志：`journalctl -u wikiblog -n 100 --no-pager`
- 备份 `/var/www/wikiblog/shared/content/posts`
