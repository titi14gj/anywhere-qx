# 一点万象签到 Anywhere 版

由 Quantumult X 脚本适配，采用“MITM 捕获参数 + cron 定时签到”的方式运行。

## 文件

- [`scripts/mixc_signin_anywhere.amrs`](scripts/mixc_signin_anywhere.amrs)：导入 Anywhere，用于捕获并更新登录参数。
- [`scripts/mixc_signin_anywhere.js`](scripts/mixc_signin_anywhere.js)：添加到 Anywhere cron 定时任务，用于执行签到。

## 使用方法

1. 在 Anywhere 中安装并信任 MITM 证书。
2. 导入并启用 `scripts/mixc_signin_anywhere.amrs`。
3. 打开一点万象 App，进入会员页或签到页，使脚本捕获 `token`、`mallNo` 和设备参数。
4. 在 Anywhere 的 cron 定时任务中添加 `scripts/mixc_signin_anywhere.js`。
5. 建议 cron 表达式：`1 0 * * *`，即每天 00:01 执行。
6. 首次配置后，可手动运行一次 cron 脚本验证。

## 脚本入口

- `process(ctx)`：MITM 与 cron 通用入口。
- `main()`：兼容以 `main` 为入口的 cron 环境。

## 日志

成功时：

```text
一点万象：签到成功，本次+10积分，当前……
```

已签到时：

```text
一点万象：今日已签到
```

登录态失效时：

```text
一点万象：登录态失效，请重新进入签到页刷新参数
```

## 说明

脚本设置了每日执行锁，避免手动运行与 cron 同时触发重复签到。请求失败时会释放当日锁，允许再次运行。
