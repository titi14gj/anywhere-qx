/* QX echo-response compatibility helper for Surge. */

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
  return JSON.parse(decodeURIComponent(encoded));
}

try {
  const config = decodeBase64URL($argument);
  $httpClient.get(config.url, function (error, response, data) {
    if (error) {
      console.log("QX echo-response fetch failed: " + error);
      $done({});
      return;
    }
    $done({
      response: {
        status: Number(response && (response.status || response.statusCode)) || 200,
        headers: { "Content-Type": config.contentType || "application/json" },
        body: data || ""
      }
    });
  });
} catch (error) {
  console.log("QX echo-response failed: " + error);
  $done({});
}
