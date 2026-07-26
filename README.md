# 一点万象签到 Anywhere 版

由 Quantumult X 自动签到脚本适配为 Anywhere MITM 规则。

## 工作方式

Anywhere 当前没有独立的 cron JavaScript 执行器，因此本版本采用“惰性每日签到”：

1. 一点万象 App 请求 `app.mixcapp.com/mixc/gateway` 时，规则捕获签到所需的登录参数。
2. 当天首次捕获到完整参数后，脚本通过 `Anywhere.http` 自动执行一次签到。
3. 当日状态保存在 `Anywhere.store`，后续请求不会重复签到。
4. 请求失败会释放当日锁，下次 App 请求时可以重试。

这意味着它不能在 App 完全没有网络活动时于固定时间后台运行；每天打开一次一点万象 App 即可触发。

## 安装

1. 在 Anywhere 中安装并信任 MITM 根证书。
2. 下载并导入 [`mixc_signin_anywhere.amrs`](./mixc_signin_anywhere.amrs)。
3. 启用“一点万象每日签到”MITM 规则集。
4. 打开一点万象 App，进入会员页或其他会访问网关的页面。
5. 在 Anywhere 日志中查看“签到参数已更新”和签到结果。

也可以使用远程规则集链接：

```text
https://raw.githubusercontent.com/titi14gj/anywhere-qx/main/mixc_signin_anywhere.amrs
```

## 文件

- `mixc_signin_anywhere.js`：可读、可维护的 Anywhere 脚本源码。
- `mixc_signin_anywhere.amrs`：可直接导入 Anywhere 的规则集，内嵌上述脚本的 Base64。
- `scripts/build-amrs.mjs`：从 JavaScript 源码重新生成 `.amrs`。

修改 JavaScript 后运行：

```bash
node scripts/build-amrs.mjs
```

## 安全说明

规则会将 `token`、设备参数和商场编号持久化到 Anywhere 的规则集存储中，并使用它们向一点万象官方接口发起签到请求。请勿导入来源不可信的修改版规则，也不要分享 Anywhere 的应用数据。

MITM 对启用证书固定（certificate pinning）的客户端可能无效。如果参数未被捕获，请确认 Anywhere 隧道、MITM 证书和规则集均已启用。
