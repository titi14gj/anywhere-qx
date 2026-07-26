/*
 * 一点万象每日签到 - Anywhere MITM 版
 *
 * Anywhere 当前没有独立的 cron JavaScript 执行器。本脚本在一点万象 App
 * 当天首次访问网关时运行：先更新登录参数，再自动签到一次。
 */

const STORE_CFG = "mixc_signin_params_v2";
const STORE_DAY = "mixc_signin_last_day_v2";
const STORE_RESULT = "mixc_signin_last_result_v2";
const SECRET = "P@Gkbu0shTNHjhM!7F";
const SIGN_ACTION = "mixc.app.memberSign.sign";
const GATEWAY = "https://app.mixcapp.com/mixc/gateway";
const FORM_KEYS = [
  "X-Mixc-Swimlane", "apiVersion", "appId", "appVersion",
  "deviceParams", "imei", "mallNo", "osVersion", "platform", "token"
];

function parseForm(text) {
  const output = {};
  if (!text) return output;
  text.split("&").forEach(function (pair) {
    const separator = pair.indexOf("=");
    if (separator < 0) return;
    const rawKey = pair.substring(0, separator).replace(/\+/g, " ");
    const rawValue = pair.substring(separator + 1).replace(/\+/g, " ");
    let key = rawKey;
    let value = rawValue;
    try { key = decodeURIComponent(rawKey); } catch (_) {}
    try { value = decodeURIComponent(rawValue); } catch (_) {}
    output[key] = value;
  });
  return output;
}

function encodeForm(values) {
  return Object.keys(values).map(function (key) {
    const value = values[key] == null ? "" : String(values[key]);
    return encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }).join("&");
}

function headerValue(headers, name) {
  const wanted = name.toLowerCase();
  for (let i = 0; i < headers.length; i += 1) {
    if (String(headers[i][0]).toLowerCase() === wanted) return String(headers[i][1]);
  }
  return undefined;
}

function pad2(number) {
  return number < 10 ? "0" + number : String(number);
}

function today() {
  const date = new Date();
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function timestampText() {
  const date = new Date();
  return today() + " " + pad2(date.getHours()) + ":" +
    pad2(date.getMinutes()) + ":" + pad2(date.getSeconds());
}

function md5(text) {
  return Anywhere.codec.hex.encode(
    Anywhere.crypto.md5(Anywhere.codec.utf8.encode(text))
  );
}

function calculateSignature(parameters) {
  let source = "";
  Object.keys(parameters).sort().forEach(function (key) {
    const value = parameters[key];
    if (value !== null && value !== undefined) source += key + "=" + value + "&";
  });
  return md5(source + SECRET);
}

function loadConfig() {
  const raw = Anywhere.store.getString(STORE_CFG, true);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function saveConfig(config) {
  Anywhere.store.set(STORE_CFG, JSON.stringify(config), true);
}

function captureConfig(ctx, form) {
  if (!form.token || !form.deviceParams || !form.mallNo) return loadConfig();

  const previous = loadConfig() || {};
  const config = {};
  FORM_KEYS.forEach(function (key) {
    if (form[key] !== undefined) config[key] = form[key];
    else if (previous[key] !== undefined) config[key] = previous[key];
  });

  config.apiVersion = config.apiVersion || "1.0";
  config.appId = config.appId || "68a91a5bac6a4f3e91bf4b42856785c6";
  config.platform = "h5";
  config.userAgent = headerValue(ctx.headers, "User-Agent") || previous.userAgent;
  config.origin = headerValue(ctx.headers, "Origin") || previous.origin;
  config.referer = headerValue(ctx.headers, "Referer") || previous.referer;

  saveConfig(config);
  Anywhere.log.info("一点万象：签到参数已更新，mallNo=" + config.mallNo);
  return config;
}

function buildSignParameters(config) {
  const milliseconds = Date.now();
  const parameters = {
    "X-Mixc-Swimlane": config["X-Mixc-Swimlane"] || "s1",
    action: SIGN_ACTION,
    apiVersion: config.apiVersion || "1.0",
    appId: config.appId || "68a91a5bac6a4f3e91bf4b42856785c6",
    appVersion: config.appVersion || "4.2.0",
    date: timestampText(),
    deviceParams: config.deviceParams,
    imei: config.imei || "",
    mallNo: config.mallNo,
    osVersion: config.osVersion || "",
    params: Anywhere.codec.base64.encode(
      Anywhere.codec.utf8.encode(JSON.stringify({ mallNo: config.mallNo }))
    ),
    platform: "h5",
    t: String(milliseconds),
    timestamp: String(milliseconds + 3),
    token: config.token
  };
  parameters.sign = calculateSignature(parameters);
  return parameters;
}

function resultMessage(payload) {
  const code = Number(payload.code);
  const message = String(payload.message || payload.msg || "");
  if (code === 0 && payload.data) {
    const points = payload.data.point != null
      ? payload.data.point
      : payload.data.signDataMap && payload.data.signDataMap.todayPoint;
    const total = payload.data.userPoints;
    return "签到成功" + (points != null ? "，本次+" + points + "积分" : "") +
      (total != null ? "，当前" + total : "");
  }
  if (message.indexOf("已签到") >= 0) return "今日已签到：" + message;
  if (code === 401 || /登录|token/i.test(message)) {
    throw new Error("登录态失效，请重新打开一点万象会员页刷新参数");
  }
  throw new Error("签到失败：code=" + payload.code + " " + message);
}

async function sign(config) {
  const parameters = buildSignParameters(config);
  const response = await Anywhere.http.post(GATEWAY, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.userAgent || "Mozilla/5.0 (iPhone) MIXCAPP/4.2.0",
      "Origin": config.origin || "https://app.mixcapp.com",
      "Referer": config.referer ||
        ("https://app.mixcapp.com/m/m-" + config.mallNo + "/signIn?mallNo=" + config.mallNo),
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh-Hans;q=0.9"
    },
    body: encodeForm(parameters),
    timeout: 10000
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error("HTTP 状态异常：" + response.status);
  }
  const text = Anywhere.codec.utf8.decode(response.body);
  let payload;
  try { payload = JSON.parse(text); }
  catch (_) { throw new Error("响应解析失败：" + text.slice(0, 120)); }
  return resultMessage(payload);
}

async function signOnceToday(config) {
  const day = today();
  if (Anywhere.store.getString(STORE_DAY, true) === day) return;

  // 脚本在 await 期间允许同规则集的其他请求运行，因此先写锁避免并发重复签到。
  Anywhere.store.set(STORE_DAY, day, true);
  try {
    const message = await sign(config);
    Anywhere.store.set(STORE_RESULT, day + " " + message, true);
    Anywhere.log.info("一点万象：" + message);
  } catch (error) {
    Anywhere.store.delete(STORE_DAY, true);
    Anywhere.store.set(STORE_RESULT, day + " " + String(error), true);
    Anywhere.log.error("一点万象：" + error);
  }
}

async function process(ctx) {
  if (!ctx || ctx.phase !== "request" || !ctx.url ||
      ctx.url.indexOf("/mixc/gateway") < 0) return;

  let form = {};
  try { form = parseForm(Anywhere.codec.utf8.decode(ctx.body)); }
  catch (error) {
    Anywhere.log.warning("一点万象：请求体读取失败 " + error);
  }

  // 用户在 App 中主动点击签到时不再额外发起一次请求。
  if (form.action === SIGN_ACTION) {
    Anywhere.store.set(STORE_DAY, today(), true);
    return;
  }

  let config;
  try { config = captureConfig(ctx, form); }
  catch (error) {
    Anywhere.log.error("一点万象：参数保存失败 " + error);
    return;
  }

  if (!config || !config.token || !config.deviceParams || !config.mallNo) {
    Anywhere.log.debug("一点万象：当前请求未包含完整签到参数");
    return;
  }
  await signOnceToday(config);
}
