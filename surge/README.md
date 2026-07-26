# Surge 转换与保留项

- `jd_price.sgmodule`：原配置中的京东比价本身就是 Surge module，因此原样保留。模块中的 `MMMCK_SCRIPT` 参数需要由用户在 Surge 中自行设置，仓库不包含 Cookie。
- `mixc_signin.sgmodule`：一点万象抓参与每日签到。Surge 的请求脚本和 cron 共用 `$persistentStore`，因此不存在当前 Anywhere 的存储隔离问题。

## 由 Anywhere/QX snippet 转换的模块

- `adblock.sgmodule`
- `adblock_naisi.sgmodule`
- `adblock_ultra.sgmodule`
- `bilibili_enhanced.sgmodule`
- `boxjs.sgmodule`
- `vvebo.sgmodule`
- `wechat_applets.sgmodule`
- `wechat_official_accounts.sgmodule`
- `wloc.sgmodule`

QX 的 reject、302/307、请求/响应脚本、body 正则替换和 echo-response 已转换。`scripts/qx_body_replace.js` 与 `scripts/qx_echo_response.js` 为 body 替换和模拟响应提供 Surge 兼容实现。

奶思规则中的 31 条 `jsonjq-response-body` 仅作为注释保留，因为 Surge 没有内置 jq 执行器；每个 module 末尾均包含转换数量和未转换条目。
