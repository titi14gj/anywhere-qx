# Anywhere 分流规则

本目录由 Quantumult X 配置转换而来，文件格式为 Anywhere `.arrs`。

## 导入后自动生效的规则

- `private_networks.arrs`：直连，`routing = 1`。
- `local_direct.arrs`：直连，`routing = 1`。
- `local_reject.arrs`：拒绝，`routing = 2`。
- `wechat.arrs`：原配置为全球直连，`routing = 1`。
- `adblock_naisi.arrs`：原规则均为拒绝动作，`routing = 2`。

## 需要手动指定代理或代理链

其余文件使用 `routing = 0`。导入后请在 Anywhere 的 **Routing Rules** 中，根据文件头部的 `Quantumult X policy` 注释选择对应代理或代理链。

`local_hong_kong.arrs`、`local_foreign_media.arrs`、`local_domestic_media.arrs` 和 `local_proxy_selection.arrs` 分别对应原配置的香港节点、国外媒体、国内媒体和策略选择。

## 转换差异

- Anywhere 没有精确域名规则，Quantumult X 的 `HOST`/`DOMAIN` 已转换为域名后缀规则，因而也会匹配其子域名。
- `USER-AGENT`、`PROCESS-NAME`、`IP-ASN`、`URL-REGEX`、`AND`、`OR` 无对应类型，未写入 `.arrs`。
- Quantumult X 的 `final` 应通过 Anywhere 的默认路由实现，不能写入单个规则集。
