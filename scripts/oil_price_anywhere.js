/*
 * 国内油价提醒 - Anywhere Automation 版
 * 来源逻辑：deezertidal/private/oil.js
 *
 * 如果 Automation 没有注入 $argument，请直接修改 DEFAULT_PROVINCE。
 * 省份名称不要带“省”字。
 */

const DEFAULT_PROVINCE = "江苏";
const REQUEST_BUDGET_MS = 8000;
const API_KEYS = [
  "231de491563c35731436829ac52aad43",
  "a2bc7a0e01be908881ff752677cf94b7",
  "1bcc67c0114bc39a8818c8be12c2c9ac",
  "3c5ee42145c852de4147264f25b858dc",
  "d718b0f7c2b6d71cb3a9814e90bf847f"
];

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

function decodeBody(body) {
  if (typeof body === "string") return body;
  return Anywhere.codec.utf8.decode(body);
}

async function fetchOilPrice(province) {
  const startedAt = Date.now();
  let lastError = "没有可用的接口响应";

  for (let index = 0; index < API_KEYS.length; index += 1) {
    const remaining = REQUEST_BUDGET_MS - (Date.now() - startedAt);
    if (remaining <= 500) break;

    const url = "https://apis.tianapi.com/oilprice/index?key=" +
      API_KEYS[index] + "&prov=" + encodeURIComponent(province);
    try {
      const response = await Anywhere.http.get(url, {
        timeout: Math.min(2500, remaining)
      });
      if (response.status < 200 || response.status >= 300) {
        lastError = "HTTP " + response.status;
        continue;
      }

      const payload = JSON.parse(decodeBody(response.body));
      if (Number(payload.code) === 200 && payload.result) return payload.result;
      lastError = String(payload.msg || "API 返回 code=" + payload.code);
    } catch (error) {
      lastError = String(error);
    }
    Anywhere.log.warning("油价：接口 " + (index + 1) + " 不可用，尝试下一个");
  }
  throw new Error(lastError);
}

function sendNotification(title, subtitle, body) {
  const notification = Anywhere.notification;
  if (typeof notification === "function") {
    notification(title, subtitle, body);
    return true;
  }
  if (notification && typeof notification.post === "function") {
    notification.post(title, subtitle, body);
    return true;
  }
  if (notification && typeof notification.send === "function") {
    notification.send(title, subtitle, body);
    return true;
  }
  return false;
}

function formatOilPrice(result) {
  return [
    "⛽️92号汽油：¥" + result.p92,
    "⛽️95号汽油：¥" + result.p95,
    "⛽️98号汽油：¥" + result.p98,
    "⛽️0号柴油：¥" + result.p0
  ].join("\n");
}

async function runOilPrice() {
  const province = selectedProvince();
  Anywhere.log.info("油价：正在查询" + province);

  const result = await fetchOilPrice(province);
  const title = String(result.prov || province) + "油价提醒";
  const subtitle = String(result.time || "");
  const body = formatOilPrice(result);

  if (!sendNotification(title, subtitle, body)) {
    Anywhere.log.warning("油价：当前 Automation 未提供可识别的通知方法");
  }
  Anywhere.log.info(title + "\n" + subtitle + "\n" + body);
}

(async function () {
  try {
    await runOilPrice();
  } catch (error) {
    Anywhere.log.error("油价查询失败：" + error);
  } finally {
    if (typeof Anywhere.done === "function") Anywhere.done();
  }
})();
