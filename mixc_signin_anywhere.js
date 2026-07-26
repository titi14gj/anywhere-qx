/*
 * 一点万象签到 - Anywhere cron 版
 *
 * 登录参数由 mixc_signin_anywhere.amrs 捕获，并通过 Anywhere.store 持久化。
 * 本脚本由支持 cron 的 Anywhere 客户端加载后立即执行一次。
 */

const STORE_CFG = "mixc_signin_params";
const STORE_DAY = "mixc_signin_last_day";
const STORE_RESULT = "mixc_signin_last_result";
const SECRET = "P@Gkbu0shTNHjhM!7F";
const SIGN_ACTION = "mixc.app.memberSign.sign";
const GATEWAY = "https://app.mixcapp.com/mixc/gateway";

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

function loadConfig() {
  const raw = Anywhere.store.getString(STORE_CFG, true);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    Anywhere.log.error("一点万象：缓存参数解析失败 " + error);
    return null;
  }
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

function parseResult(payload) {
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

async function sign(config) {
  Anywhere.log.info("一点万象：开始发送签到请求");
  const response = await Anywhere.http.post(GATEWAY, {
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
    body: encodeForm(buildSignParameters(config)),
    timeout: 10000
  });

  Anywhere.log.info("一点万象：收到响应，HTTP " + response.status);
  if (response.status < 200 || response.status >= 300) {
    throw new Error("HTTP 状态异常：" + response.status);
  }

  const text = Anywhere.codec.utf8.decode(response.body);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    throw new Error("响应解析失败：" + text.slice(0, 120));
  }
  return parseResult(payload);
}

async function runCron() {
  const config = loadConfig();
  if (!config || !config.token || !config.deviceParams || !config.mallNo) {
    const message = "未抓到有效参数，请先启用 MITM 规则并打开一点万象签到页";
    Anywhere.store.set(STORE_RESULT, today() + " " + message, true);
    Anywhere.log.error("一点万象：" + message);
    return;
  }

  const day = today();
  if (Anywhere.store.getString(STORE_DAY, true) === day) {
    Anywhere.log.info("一点万象：今日任务已执行，跳过重复签到");
    return;
  }

  // 先加锁，避免手动运行与定时任务同时触发两次签到。
  Anywhere.store.set(STORE_DAY, day, true);
  try {
    const result = await sign(config);
    Anywhere.store.set(STORE_RESULT, day + " " + result, true);
    Anywhere.log.info("一点万象：" + result);
  } catch (error) {
    // 网络或业务失败时释放锁，允许手动执行或下次 cron 重试。
    Anywhere.store.delete(STORE_DAY, true);
    Anywhere.store.set(STORE_RESULT, day + " " + String(error), true);
    Anywhere.log.error("一点万象：" + error);
  }
}

async function main() {
  await runCron();
}

async function process() {
  await runCron();
}

/*
 * 以表达式形式立即执行并返回 Promise：既兼容只求值脚本的 cron 执行器，
 * 也兼容会主动调用 main/process 的实现；每日锁会阻止兼容入口造成重复请求。
 */
(async function () {
  try {
    Anywhere.log.info("一点万象：cron 任务启动");
    await runCron();
    Anywhere.log.info("一点万象：cron 任务结束");
  } catch (error) {
    Anywhere.log.error("一点万象：cron 未捕获异常 " + error);
  }
})();
