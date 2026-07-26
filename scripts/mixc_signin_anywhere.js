/*
 * 一点万象签到 - Anywhere Automation/cron 版
 *
 * 参数由 mixc_signin_anywhere.amrs 捕获，通过 $persistentStore 共享。
 * 使用 $httpClient 和 $done，确保 Automation 能识别任务完成。
 */

const STORE_CFG = "mixc_signin_params";
const STORE_DAY = "mixc_signin_last_day";
const STORE_RESULT = "mixc_signin_last_result";
const SECRET = "P@Gkbu0shTNHjhM!7F";
const GATEWAY = "https://app.mixcapp.com/mixc/gateway";

let finished = false;

function log(message) {
  if (typeof console !== "undefined") console.log(message);
}

function readStore(key) {
  return typeof $persistentStore !== "undefined" ? $persistentStore.read(key) : null;
}

function writeStore(value, key) {
  return typeof $persistentStore !== "undefined" && $persistentStore.write(value, key);
}

function finish(result) {
  if (finished) return;
  finished = true;
  $done(result);
}

function fail(message) {
  log("一点万象：" + message);
  writeStore(today() + " " + message, STORE_RESULT);
  finish({ error: message });
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

function encodeForm(values) {
  return Object.keys(values).map(function (key) {
    const value = values[key] == null ? "" : String(values[key]);
    return encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }).join("&");
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

function buildParameters(config) {
  const milliseconds = Date.now();
  const parameters = {
    "X-Mixc-Swimlane": config["X-Mixc-Swimlane"] || "s1",
    action: "mixc.app.memberSign.sign",
    apiVersion: config.apiVersion || "1.0",
    appId: config.appId || "68a91a5bac6a4f3e91bf4b42856785c6",
    appVersion: config.appVersion || "4.2.0",
    date: timestampText(),
    deviceParams: config.deviceParams,
    imei: config.imei || "",
    mallNo: config.mallNo,
    osVersion: config.osVersion || "26.5",
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

function parseResult(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    throw new Error("响应解析失败：" + String(text).slice(0, 120));
  }

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
    throw new Error("登录态失效，请重新进入一点万象签到页刷新参数");
  }
  throw new Error("签到失败：code=" + payload.code + " " + message);
}

function run() {
  if (typeof $persistentStore === "undefined") {
    fail("当前 Automation 不支持 $persistentStore");
    return;
  }
  if (typeof $httpClient === "undefined" || typeof $done !== "function") {
    fail("当前 Automation 缺少 $httpClient 或 $done");
    return;
  }

  let config;
  try {
    const raw = readStore(STORE_CFG);
    config = raw ? JSON.parse(raw) : null;
  } catch (_) {
    fail("共享参数解析失败，请重新打开一点万象签到页");
    return;
  }
  if (!config || !config.token || !config.deviceParams || !config.mallNo) {
    fail("共享存储中没有有效参数，请启用 MITM 规则并打开一点万象签到页");
    return;
  }

  const day = today();
  if (readStore(STORE_DAY) === day) {
    log("一点万象：今日任务已执行，跳过重复签到");
    finish({ status: 200 });
    return;
  }

  writeStore(day, STORE_DAY);
  const request = {
    url: GATEWAY,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) crland/4.4.0 grayscale/0 " +
        "/MIXCAPP/4.2.0 AnalysysAgent/Hybrid",
      "Origin": "https://app.mixcapp.com",
      "Referer": "https://app.mixcapp.com/m/m-" + config.mallNo +
        "/signIn?mallNo=" + config.mallNo,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh-Hans;q=0.9"
    },
    body: encodeForm(buildParameters(config))
  };

  log("一点万象：开始发送签到请求");
  $httpClient.post(request, function (error, response, data) {
    if (error) {
      writeStore("", STORE_DAY);
      fail("网络请求失败：" + error);
      return;
    }
    const status = Number(response && (response.status || response.statusCode));
    if (status < 200 || status >= 300) {
      writeStore("", STORE_DAY);
      fail("HTTP 状态异常：" + status);
      return;
    }
    try {
      const result = parseResult(data);
      writeStore(day + " " + result, STORE_RESULT);
      log("一点万象：" + result);
      finish({ status: status || 200 });
    } catch (error) {
      writeStore("", STORE_DAY);
      fail(String(error));
    }
  });
}

run();
