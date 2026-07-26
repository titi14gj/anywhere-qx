# Anywhere Quantumult X 重写

本目录中的文件均整理为 `.snippet`，供带有 Quantumult X 重写兼容层的 Anywhere 客户端导入。

- `wloc.snippet`：Apple WLOC 定位修改。
- `adblock_naisi.snippet`：奶思去广告合集。
- `adblock_ultra.snippet`：去开屏 Ultra。
- `adblock.snippet`：AdBlock。
- `wechat_applets.snippet`：微信小程序去广告。
- `wechat_official_accounts.snippet`：微信公众号去广告。
- `bilibili_enhanced.snippet`：BiliBili Enhanced。
- `boxjs.snippet`：BoxJS。
- `vvebo.snippet`：VVEBO 用户主页修复。

这些 snippet 保留原作者的远程 JavaScript 地址；导入时仍会从对应上游加载脚本。若 Anywhere 的 QX 兼容层未实现某个脚本使用的全局 API，日志会报告运行错误。
