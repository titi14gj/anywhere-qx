# Anywhere Scripts

将 Quantumult X、Surge 等平台的脚本适配为 Anywhere 可用格式。

## 国内油价提醒

文件：[`scripts/oil_price_anywhere.js`](scripts/oil_price_anywhere.js)

该脚本适用于支持 Automation/cron JavaScript 的 Anywhere 客户端，不依赖 MITM 或持久化存储。它使用已验证的 Surge/QX 兼容接口 `$httpClient` 和 `$done`；查询完成后会明确结束任务，避免出现“已输出油价但任务仍超时”。

### 使用方法

1. 将脚本完整复制到 Automation 的 JavaScript 输入框。
2. 默认查询江苏油价。如需修改省份，编辑脚本顶部的：

   ```javascript
   const DEFAULT_PROVINCE = "江苏";
   ```

   省份名称不要带“省”字。
3. 如果客户端支持 `$argument`，也可以传入 `广东`、`province=广东` 或 `{"province":"广东"}`。
4. 手动运行一次验证日志和通知，然后按需设置 cron。

脚本会依次尝试原脚本提供的 TianAPI 接口密钥，并把总请求时间控制在约 8 秒内。第三方接口密钥可能因额度、失效或服务变更而不可用。

## 一点万象签到（暂缓）

- [`scripts/mixc_signin_anywhere.amrs`](scripts/mixc_signin_anywhere.amrs)：MITM 捕获规则。
- [`scripts/mixc_signin_anywhere.js`](scripts/mixc_signin_anywhere.js)：cron 签到脚本。

公开版 Anywhere 的 `Anywhere.store` 按 MITM 规则集隔离；自定义 Automation 若未绑定相同存储作用域，将无法读取 MITM 捕获的登录参数。因此该脚本暂缓使用，等待客户端提供共享存储能力。

## 安全说明

- 不要将 token、Cookie、设备参数或个人 API 密钥提交到仓库。
- 仅导入可信来源的 MITM 规则。
- Automation 脚本中的 HTTP 请求会访问相应第三方服务，请自行确认其隐私政策与可用性。
