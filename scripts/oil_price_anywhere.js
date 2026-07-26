/*
 * 国内油价提醒 - Anywhere Automation 版
 * 来源逻辑：deezertidal/private/oil.js
 *
 * 使用 Automation 已验证支持的 Surge/QX 兼容接口：
 * $httpClient、$notification/$notify、$done。
 */

const DEFAULT_PROVINCE = "江苏";
const API_KEYS = [
  "231de491563c35731436829ac52aad43",
  "a2bc7a0e01be908881ff752677cf94b7",
  "1bcc67c0114bc39a8818c8be12c2c9ac",
  "3c5ee42145c852de4147264f25b858dc",
  "d718b0f7c2b6d71cb3a9814e90bf847f"
];

let currentIndex = 0;
let lastError = "没有可用的接口响应";
let completed = false;

function automationArgument() {
  if (typeof $argument === "undefined" || $argument == null) return "";
  const raw = String($argument).trim();
  if (!raw) return "";

  // 兼容 `江苏`、`province=江苏`、`prov=江苏` 和 JSON 参数。
  if (raw[0] === "{") {
    try {
      const parsed = JSON.parse(raw);
      return String(parsed.province || parsed.prov || "").trim();
    } catch (_) {}
  }
  if (raw.indexOf("=") >= 0) {
    const fields = raw.split("&");
    for (let i = 0; i < fields.length; i += 1) {
      const separator = fields[i].indexOf("=");
      if (separator < 0) continue;
      const key = fields[i].slice(0, separator).trim().toLowerCase();
      if (key !== "province" && key !== "prov") continue;
      const value = fields[i].slice(separator + 1).replace(/\+/g, " ");
      try { return decodeURIComponent(value).trim(); }
      catch (_) { return value.trim(); }
    }
  }
  return raw;
}

function selectedProvince() {
  return (automationArgument() || DEFAULT_PROVINCE).replace(/省$/, "");
}

function finish(result) {
  if (completed) return;
  completed = true;
  $done(result || {});
}

function sendNotification(title, subtitle, body) {
  try {
    if (typeof $notification !== "undefined" &&
        typeof $notification.post === "function") {
      $notification.post(title, subtitle, body);
      return;
    }
    if (typeof $notify !== "undefined") {
      $notify(title, subtitle, body);
      return;
    }
    if (typeof Anywhere !== "undefined" && Anywhere.notification) {
      if (typeof Anywhere.notification.post === "function") {
        Anywhere.notification.post(title, subtitle, body);
        return;
      }
      if (typeof Anywhere.notification.send === "function") {
        Anywhere.notification.send(title, subtitle, body);
      }
    }
  } catch (error) {
    console.log("油价：通知发送失败 " + error);
  }
}

function formatOilPrice(result) {
  return [
    "⛽️92号汽油：¥" + result.p92,
    "⛽️95号汽油：¥" + result.p95,
    "⛽️98号汽油：¥" + result.p98,
    "⛽️0号柴油：¥" + result.p0
  ].join("\n");
}

function handleResponse(data, response) {
  let payload;
  try {
    payload = typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    lastError = "响应解析失败：" + error;
    tryNextAPI();
    return;
  }

  if (payload && Number(payload.code) === 200 && payload.result) {
    const result = payload.result;
    const title = String(result.prov || selectedProvince()) + "油价提醒";
    const subtitle = String(result.time || "");
    const body = formatOilPrice(result);

    sendNotification(title, subtitle, body);
    console.log(title + "\n" + subtitle + "\n" + body);
    finish({
      status: Number(response && (response.status || response.statusCode)) || 200
    });
    return;
  }

  lastError = String(payload && (payload.msg || "API 返回 code=" + payload.code));
  tryNextAPI();
}

function tryNextAPI() {
  if (completed) return;
  if (currentIndex >= API_KEYS.length) {
    console.log("油价查询失败：" + lastError);
    finish({ error: lastError });
    return;
  }

  const index = currentIndex++;
  const province = selectedProvince();
  const url = "https://apis.tianapi.com/oilprice/index?key=" +
    API_KEYS[index] + "&prov=" + encodeURIComponent(province);

  console.log("油价：正在查询" + province + "（接口 " + (index + 1) + "）");
  $httpClient.get(url, function (error, response, data) {
    if (error) {
      lastError = String(error);
      tryNextAPI();
      return;
    }
    const status = Number(response && (response.status || response.statusCode));
    if (status && (status < 200 || status >= 300)) {
      lastError = "HTTP " + status;
      tryNextAPI();
      return;
    }
    handleResponse(data, response);
  });
}

if (typeof $httpClient === "undefined" || typeof $done === "undefined") {
  console.log("油价查询失败：Automation 未提供 $httpClient/$done");
} else {
  tryNextAPI();
}
