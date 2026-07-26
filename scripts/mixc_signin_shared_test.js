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

function saveCfg(cfg) {
  const raw = JSON.stringify(cfg);
  Anywhere.store.set(STORE_CFG, raw, true);

  // 最小共享存储探针：失败时保留原有 Anywhere.store，不影响抓参流程。
  try {
    if (typeof $persistentStore === "undefined") {
      Anywhere.log.info("一点万象：MITM $persistentStore=undefined");
    } else if (typeof $persistentStore.write !== "function") {
      Anywhere.log.info("一点万象：MITM $persistentStore.write=不可用");
    } else {
      const written = $persistentStore.write(raw, STORE_CFG);
      Anywhere.log.info("一点万象：共享存储写入=" + (written ? "成功" : "失败"));
    }
  } catch (error) {
    Anywhere.log.error("一点万象：共享存储写入异常（原请求继续） " + error);
  }
}

async function sign(cfg) {
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
    timeout: 10000
  });

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
  const cfg = loadCfg();
  if (!cfg || !cfg.token || !cfg.deviceParams || !cfg.mallNo) {
    const msg = "未抓到有效参数，请先启用 MITM 规则幚打开一点万象签到页";
    Anywhere.store.set(STORE_RESULT, today() + " " + msg, true);
    Anywhere.log.error("一点万象：" + msg);
    return;
  }

  const day = today();
  if (Anywhere.store.getString(STORE_DAY, true) === day) {
    Anywhere.log.info("一点万象：今日任务已执行，跳过重复签到");
    return;
  }

  // 先加当日锁，避免手动运行与 cron 并发触发。
  Anywhere.store.set(STORE_DAY, day, true);
  try {
    const result = await sign(cfg);
    Anywhere.store.set(STORE_RESULT, day + " " + result, true);
    Anywhere.log.info("一点万象：" + result);
  } catch (e) {
    // 失败后释放当日锁，便于手动重跑或下一次 cron 重试。
    Anywhere.store.delete(STORE_DAY, true);
    Anywhere.store.set(STORE_RESULT, day + " " + String(e), true);
    Anywhere.log.error("一点万象：" + e);
  }
}

async function captureRequest(ctx) {
  if (!ctx || ctx.phase !== "request" || !ctx.url ||
      ctx.url.indexOf("/mixc/gateway") < 0) return;

  let form;
  try {
    form = parseForm(Anywhere.codec.utf8.decode(ctx.body));
  } catch (e) {
    Anywhere.log.warning("一点万象：请求体读取失败 " + e);
    return;
  }

  // 忽略签到请求本身，只从 App 的其他有效 H5 请求更新参数。
  if (form.action === "mixc.app.memberSign.sign") return;
  if (form.platform !== "h5" || !form.token || !form.deviceParams) return;

  const previous = loadCfg() || {};
  const saved = {};
  KEEP.forEach(function (k) {
    if (form[k] !== undefined) saved[k] = form[k];
    else if (previous[k] !== undefined) saved[k] = previous[k];
  });

  saved.appId = saved.appId || "68a91a5bac6a4f3e91bf4b42856785c6";
  saved.platform = "h5";
  saved.apiVersion = saved.apiVersion || "1.0";

  try {
    saveCfg(saved);
    Anywhere.log.info("一点万象：签到参数已更新，mallNo=" + saved.mallNo);
  } catch (e) {
    Anywhere.log.error("一点万象：参数保存失败 " + e);
  }
}

/*
 * 通用入口：
 * - MITM 传入 request ctx 时，仅抓取参数；
 * - cron 无 ctx（或非 request ctx）时，执行签到。
 */
async function process(ctx) {
  if (ctx && ctx.phase === "request") {
    await captureRequest(ctx);
  } else {
    await runCron();
  }
}

// 兼容以 main() 为入口的 Anywhere cron 环境。
async function main() {
  await runCron();
}
