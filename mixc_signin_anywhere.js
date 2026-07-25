/*
 * 一点万象签到 - Anywhere 版
 * 说明：
 * 1. MITM 模式负责捕获 token、mallNo 和设备参数。
 * 2. cron 模式负责每天独立执行签到。
 * 3. 参数、签到日期及结果使用 Anywhere.store 持久化保存。
 * 4. 执行结果写入 Anywhere 日志。
 */

const STORE_CFG = "mixc_signin_params";
const STORE_DAY = "mixc_signin_last_day";
const STORE_RESULT = "mixc_signin_last_result";
const SECRET = "P@Gkbu0shTNHjhM!7F";
const KEEP = [
  "X-Mixc-Swimlane", "appId", "appVersion", "deviceParams",
  "imei", "mallNo", "osVersion", "params", "platform", "token"
];

function parseForm(str) {
  const out = {};
  if (!str) return out;
  str.split("&").forEach(function (kv) {
    const i = kv.indexOf("=");
    if (i < 0) return;
    const key = kv.substring(0, i);
    const value = kv.substring(i + 1).replace(/\+/g, " ");
    try { out[key] = decodeURIComponent(value); }
    catch (_) { out[key] = value; }
  });
  return out;
}

function buildBody(obj) {
  return Object.keys(obj)
    .map(k => k + "=" + encodeURIComponent(obj[k] == null ? "" : obj[k]))
    .join("&");
}

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function nowDate() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" +
    pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" +
    pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function today() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function b64encode(str) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = Array.from(Anywhere.codec.utf8.encode(str));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : NaN;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : NaN;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4)];
    out += isNaN(b2) ? "=" : chars[((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6)];
    out += isNaN(b3) ? "=" : chars[b3 & 63];
  }
  return out;
}

function md5(str) {
  return Anywhere.codec.hex.encode(
    Anywhere.crypto.md5(Anywhere.codec.utf8.encode(str))
  );
}

function calcSign(p) {
  let text = "";
  Object.keys(p).sort().forEach(function (k) {
    const v = p[k];
    if (v || v === 0 || v === "") text += k + "=" + v + "&";
  });
  return md5(text + SECRET);
}

function loadCfg() {
  const raw = Anywhere.store.getString(STORE_CFG, true);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function sign(cfg) {
  Anywhere.log.info("一点万象：开始发送签到请求");
  const ms = Date.now();
  const p = {
    "X-Mixc-Swimlane": cfg["X-Mixc-Swimlane"] || "s1",
    action: "mixc.app.memberSign.sign",
    apiVersion: cfg.apiVersion || "1.0",
    appId: cfg.appId || "68a91a5bac6a4f3e91bf4b42856785c6",
    appVersion: cfg.appVersion || "4.2.0",
    date: nowDate(),
    deviceParams: cfg.deviceParams,
    imei: cfg.imei || "",
    mallNo: cfg.mallNo,
    osVersion: cfg.osVersion || "26.5",
    params: b64encode(JSON.stringify({ mallNo: cfg.mallNo })),
    platform: "h5",
    t: String(ms),
    timestamp: String(ms + 3),
    token: cfg.token
  };
  p.sign = calcSign(p);

  const response = await Anywhere.http.post("https://app.mixcapp.com/mixc/gateway", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) crland/4.4.0 grayscale/0 /MIXCAPP/4.2.0 AnalysysAgent/Hybrid",
      "Origin": "https://app.mixcapp.com",
      "Referer": "https://app.mixcapp.com/m/m-" + cfg.mallNo + "/signIn?mallNo=" + cfg.mallNo,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh-Hans;q=0.9"
    },
    body: buildBody(p),
    timeout: 6000
  });

  Anywhere.log.info("一点万象：收到响应，HTTP " + response.status);
  if (response.status < 200 || response.status >= 300) {
    throw new Error("HTTP 状态异常：" + response.status);
  }
  const text = Anywhere.codec.utf8.decode(response.body);
  let result;
  try { result = JSON.parse(text); }
  catch (_) { throw new Error("响应解析失败: " + text.slice(0, 120)); }

  const message = result.message || "";
  if (result.code === 0 && result.data) {
    const got = result.data.point != null
      ? result.data.point
      : result.data.signDataMap && result.data.signDataMap.todayPoint;
    const total = result.data.userPoints != null ? result.data.userPoints : "";
    return "签到成功，本次+" + got + "积分" + (total !== "" ? "，当前" + total : "");
  }
  if (message.indexOf("已签到") >= 0) return "今日已签到：" + message;
  if (message.indexOf("频繁") >= 0 || message.indexOf("稍后") >= 0) return "请求频繁：" + message;
  if (result.code === 401 || message.indexOf("登录") >= 0 || message.indexOf("token") >= 0) {
    throw new Error("登录态失效，请重新进入签到页刷新参数");
  }
  throw new Error("签到失败：code=" + result.code + " " + message);
}

async function runCron() {
  const cfgRaw = Anywhere.store.getString(STORE_CFG, true);
  let cfg = null;
  try { cfg = cfgRaw ? JSON.parse(cfgRaw) : null; } catch (_) {}

  if (!cfg || !cfg.token || !cfg.deviceParams || !cfg.mallNo) {
    const msg = "未抓到有效参数，请先启用 MITM 规则并打开一点万象签到页";
    Anywhere.store.set(STORE_RESULT, today() + " " + msg, true);
    Anywhere.log.error("一点万象：" + msg);
    return;
  }

  const day = today();
  if (Anywhere.store.getString(STORE_DAY, true) === day) {
    Anywhere.log.info("一点万象：今日任务已执行，跳过重复签到");
    return;
  }

  Anywhere.store.set(STORE_DAY, day, true);
  try {
    const result = await sign(cfg);
    Anywhere.store.set(STORE_RESULT, day + " " + result, true);
    Anywhere.log.info("一点万象：" + result);
  } catch (e) {
    Anywhere.store.delete(STORE_DAY, true);
    Anywhere.store.set(STORE_RESULT, day + " " + String(e), true);
    Anywhere.log.error("一点万象：" + e);
  }
}

/* cron 独立入口：脚本加载后立即执行，不等待执行器调用 main/process。 */
(async function () {
  try {
    Anywhere.log.info("一点万象：cron 任务启动");
    await runCron();
    Anywhere.log.info("一点万象：cron 任务结束");
  } catch (e) {
    Anywhere.log.error("一点万象：cron 未捕获异常 " + e);
  }
})();
