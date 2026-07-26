/*
 * 一点万象参数捕获 - Anywhere MITM 脚本
 *
 * 将登录参数同时写入 MITM 规则存储和 Surge 兼容共享存储。
 * cron 脚本通过 $persistentStore 读取同一个键。
 */

const STORE_CFG = "mixc_signin_params";
const KEEP = [
  "X-Mixc-Swimlane", "appId", "appVersion", "deviceParams",
  "imei", "mallNo", "osVersion", "params", "platform", "token"
];

function logInfo(message) {
  if (typeof Anywhere !== "undefined" && Anywhere.log) {
    Anywhere.log.info(message);
  } else if (typeof console !== "undefined") {
    console.log(message);
  }
}

function logError(message) {
  if (typeof Anywhere !== "undefined" && Anywhere.log) {
    Anywhere.log.error(message);
  } else if (typeof console !== "undefined") {
    console.log(message);
  }
}

function parseForm(text) {
  const output = {};
  if (!text) return output;
  text.split("&").forEach(function (item) {
    const separator = item.indexOf("=");
    if (separator < 0) return;
    const key = item.substring(0, separator);
    const value = item.substring(separator + 1).replace(/\+/g, " ");
    try {
      output[key] = decodeURIComponent(value);
    } catch (_) {
      output[key] = value;
    }
  });
  return output;
}

function readConfig() {
  let raw = null;
  if (typeof $persistentStore !== "undefined") {
    raw = $persistentStore.read(STORE_CFG);
  }
  if (!raw && typeof Anywhere !== "undefined" && Anywhere.store) {
    raw = Anywhere.store.getString(STORE_CFG, true);
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveConfig(config) {
  const raw = JSON.stringify(config);
  let shared = false;

  if (typeof $persistentStore !== "undefined") {
    shared = $persistentStore.write(raw, STORE_CFG) === true;
  }
  if (typeof Anywhere !== "undefined" && Anywhere.store) {
    Anywhere.store.set(STORE_CFG, raw, true);
  }
  return shared;
}

async function process(ctx) {
  if (!ctx || ctx.phase !== "request" || !ctx.url ||
      ctx.url.indexOf("/mixc/gateway") < 0) return;

  let form;
  try {
    form = parseForm(Anywhere.codec.utf8.decode(ctx.body));
  } catch (error) {
    logError("一点万象：请求体读取失败 " + error);
    return;
  }

  // 忽略脚本自己发出的签到请求，只从 App 的其他有效 H5 请求更新参数。
  if (form.action === "mixc.app.memberSign.sign") return;
  if (form.platform !== "h5" || !form.token || !form.deviceParams) return;

  const previous = readConfig();
  const saved = {};
  KEEP.forEach(function (key) {
    if (form[key] !== undefined) saved[key] = form[key];
    else if (previous[key] !== undefined) saved[key] = previous[key];
  });
  saved.appId = saved.appId || "68a91a5bac6a4f3e91bf4b42856785c6";
  saved.platform = "h5";
  saved.apiVersion = saved.apiVersion || "1.0";

  try {
    const shared = saveConfig(saved);
    logInfo("一点万象：签到参数已更新，mallNo=" + saved.mallNo +
      "，共享存储=" + (shared ? "成功" : "不可用"));
  } catch (error) {
    logError("一点万象：参数保存失败 " + error);
  }
}
