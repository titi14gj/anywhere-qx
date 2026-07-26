# Quantumult X 配置迁移报告

来源：`titi14gj-2025new.conf`

转换日期：2026-07-26

## 转换结果

- `rules/`：29 个 Anywhere `.arrs` 文件，共 7195 条规则。
  - 22 个远程分流资源成功转换，共 7163 条受支持规则。
  - 25 条本地分流按原策略拆为 6 个规则集。
  - `[general] excluded_routes` 转为 7 条直连网段规则。
- `rewrite/`：9 个 Quantumult X 兼容 `.snippet`，共 4508 条重写入口。
- `scripts/`：已有可运行的 Anywhere 油价 Automation；一点万象保留当前实验和诊断结果。
- `surge/`：2 个 Surge module（京东比价、一点万象自动签到）。

公开产物不包含节点订阅地址、代理凭据、MITM P12 证书、证书口令、Cookie 或个人 token。

## 导入与策略映射

Anywhere `.arrs` 不能定义 Quantumult X 的策略组，也不能在文件中选择具体代理。除明确的 Direct/Reject 规则外，转换文件均使用 `routing = 0`。导入后应按每个文件头部的 `Quantumult X policy` 注释，在 Anywhere **Routing Rules** 中手动绑定代理或代理链。

原配置的 `final, 🚀 策略选择` 不能转换为规则条目；请把 Anywhere 的默认路由设置为对应代理或代理链。

## 未转换或部分转换：分流

Anywhere 只支持域名后缀、域名关键词、IPv4 CIDR 和 IPv6 CIDR。以下规则类型没有对应能力：

| 来源 | 未转换类型与数量 | 影响 |
| --- | --- | --- |
| ASN-CN | `IP-ASN` 5239 | 整个资源无法转换；Anywhere 不支持 ASN 匹配。 |
| Apple TV | `USER-AGENT` 2 | 仅保留 7 条域名规则。 |
| AI | `AND` 2 | 复合条件无法表达，保留其余 64 条规则。 |
| 广告拦截合集@奶思 | `USER-AGENT` 1 | 保留其余 2608 条规则。 |
| Microsoft | `PROCESS-NAME` 2、`USER-AGENT` 3 | 保留其余 668 条规则。 |
| Apple | `PROCESS-NAME` 13、`USER-AGENT` 23 | 保留其余 20 条规则。 |
| Apple Proxy | `USER-AGENT` 5 | 保留其余 39 条规则。 |
| Telegram | `IP-ASN` 5、`OR` 1、`PROCESS-NAME` 5 | 保留其余 35 条规则。 |
| Wechat | `IP-ASN` 1、`USER-AGENT` 2 | 保留其余 329 条规则。 |
| Spotify | `USER-AGENT` 1 | 保留其余 29 条规则。 |
| Paypal | `USER-AGENT` 1 | 保留其余 247 条规则。 |
| Youtube | `USER-AGENT` 7 | 保留其余 183 条规则。 |
| Netflix | `PROCESS-NAME` 1、`USER-AGENT` 1 | 保留其余 1155 条规则。 |
| Bilibili | `PROCESS-NAME` 6、`USER-AGENT` 4 | 保留其余 123 条规则。 |
| ChinaMedia | `PROCESS-NAME` 6、`USER-AGENT` 35 | 保留其余 405 条规则。 |
| ProxyMedia | `PROCESS-NAME` 3、`URL-REGEX` 1 | 保留其余 345 条规则。 |
| Google | `PROCESS-NAME` 5、`USER-AGENT` 3 | 保留其余 695 条规则。 |
| Proxy | `USER-AGENT` 8 | 保留其余 123 条规则。 |

Quantumult X 的 `HOST`/`DOMAIN` 是精确域名匹配，而 Anywhere 没有精确域名类型，因此转换为域名后缀规则；这会额外匹配相应子域名。

## 未转换：重写

| 原配置项目 | 处理结果 | 原因 |
| --- | --- | --- |
| 一点万象 | Anywhere 保留诊断版本；另生成 Surge module | Anywhere 的 MITM 与 Automation 存储隔离；Surge 两种触发方式可共用 `$persistentStore`。 |
| 养基宝 | 未发布 | 脚本修改会员、订阅和付费状态，不重新发布付费权限绕过内容。 |
| RevenueCat 解锁合集 | 未发布 | 用于修改订阅权益。 |
| APP 解锁合集 | 未发布 | 混合包含多项会员/付费功能解锁。 |
| WeatherKit | 未发布 | 上游明确包含“解锁全部天气功能”。 |
| 打断请求 `switchMode.js` | 未转换 | 依赖 Quantumult X 专属 `$configuration.sendMessage` 切换运行模式，Anywhere/Surge 无直接等价接口。 |

京东比价原资源是 `.sgmodule`，因此保存在 `surge/`，没有伪装成 Anywhere snippet。一点万象另生成 Surge module，包含请求抓参和每日 cron。

## 未转换：自动任务

| 任务 | 处理结果 | 原因 |
| --- | --- | --- |
| 今日油价 | 已转换 | 使用 Anywhere 已验证的 `$httpClient`、通知接口与 `$done`。 |
| 流媒体解锁查询 | 未转换 | 依赖 QX 的 `$task`、`$configuration`、`$environment.params` 和交互式任务界面。 |
| 一点万象签到 | 部分转换 | HTTP 回调可兼容，但 MITM 与 Automation 没有共享持久化存储。 |
| 节点阻断检测 | 未转换 | 依赖 QX 的节点上下文与 `$configuration.get_server_description`，普通 cron 无法取得当前节点信息。 |

## 未转换：客户端级配置

- `[server_remote]`：9 个节点订阅属于私人连接信息，并且 Anywhere 使用自身节点导入模型，未公开或转存。
- `[policy]`：29 个 QX 策略组不能由 `.arrs` 创建；需在 Anywhere 中用代理、代理链和规则集绑定重新搭建。
- `[dns]`：DNS 服务器及按域名指定 DNS 属于客户端设置，不是 Anywhere `.arrs` 的一部分。
- `[general]`：测速 URL、资源解析器、UDP 443 丢弃和 fallback UDP policy 没有通用导入格式；仅 `excluded_routes` 已转换。
- `[mitm]`：P12 和 passphrase 是敏感凭据，绝不提交到公开仓库；负向 hostname `-*.weibo.*` 也没有加入各 snippet。
