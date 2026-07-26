# Anywhere Scripts

将 Quantumult X、Surge 等平台的脚本适配为 Anywhere 可用格式。

完整的 Quantumult X 配置迁移结果见 [`MIGRATION_REPORT.md`](MIGRATION_REPORT.md)：包括已转换文件、手动策略映射、部分转换规则和未转换原因。仓库不会保存节点订阅、代理凭据、Cookie 或 MITM 证书。

## 分流规则

### F1 TV

文件：[`rules/f1_tv.arrs`](rules/f1_tv.arrs)

由 Surge F1 TV Rule Provider 转换为 Anywhere `.arrs` 格式。导入后需要在 Anywhere 的 **Routing Rules** 中为该规则集指定代理或代理链；文件默认保持 `Default`，不会自行选择节点。

Anywhere 当前没有仅匹配单一域名的规则类型，因此原规则中的 `DOMAIN` 与 `DOMAIN-SUFFIX` 均转换为域名后缀规则。

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

### `$persistentStore` 最小测试

- [`scripts/mixc_signin_shared_test.amrs`](scripts/mixc_signin_shared_test.amrs)：以已验证可抓参的规则为基线，仅增加一次受保护的共享存储写入。
- [`scripts/mixc_signin_shared_test.js`](scripts/mixc_signin_shared_test.js)：测试规则内嵌的可读源码。

测试前必须停用原捕获规则，不能同时启用两条规则。打开一点万象签到页后，根据 MITM 日志中的 `$persistentStore=undefined`、`共享存储写入=成功/失败` 或“写入异常”判断 MITM 环境是否提供共享存储。原规则保持不变，可随时切回。

## 安全说明

- 不要将 token、Cookie、设备参数或个人 API 密钥提交到仓库。
- 仅导入可信来源的 MITM 规则。
- Automation 脚本中的 HTTP 请求会访问相应第三方服务，请自行确认其隐私政策与可用性。
