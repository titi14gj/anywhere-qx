/* QX request-body/response-body compatibility helper for Surge. */

function decodeBase64URL(value) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let input = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  let bits = 0;
  let bitCount = 0;
  const bytes = [];
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === "=") break;
    const index = chars.indexOf(input[i]);
    if (index < 0) continue;
    bits = (bits << 6) | index;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 255);
    }
  }
  let encoded = "";
  bytes.forEach(function (byte) {
    encoded += "%" + (byte < 16 ? "0" : "") + byte.toString(16);
  });
  return decodeURIComponent(encoded);
}

try {
  const config = JSON.parse(decodeBase64URL($argument));
  const source = typeof $response !== "undefined" ? $response : $request;
  const body = String(source.body || "");
  let rewritten;
  try {
    rewritten = body.replace(new RegExp(config.search, "g"), config.replacement);
  } catch (_) {
    rewritten = body.split(config.search).join(config.replacement);
  }
  $done({ body: rewritten });
} catch (error) {
  console.log("QX body replacement failed: " + error);
  $done({});
}
