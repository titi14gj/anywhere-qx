# Surge 转换与保留项

- `jd_price.sgmodule`：原配置中的京东比价本身就是 Surge module，因此原样保留。模块中的 `MMMCK_SCRIPT` 参数需要由用户在 Surge 中自行设置，仓库不包含 Cookie。
- `mixc_signin.sgmodule`：一点万象抓参与每日签到。Surge 的请求脚本和 cron 共用 `$persistentStore`，因此不存在当前 Anywhere 的存储隔离问题。
