import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "mixc_signin_anywhere.js"));
const encoded = source.toString("base64");
const amrs = `# 一点万象每日签到 - Anywhere MITM 规则
# 捕获登录参数，并在当天首次 App 网关请求中自动签到
name = 一点万象每日签到
hostname = app.mixcapp.com

[Rule]
0, 100, ^https?://app\\.mixcapp\\.com/mixc/gateway(?:\\?|$), ${encoded}
`;

await writeFile(join(root, "mixc_signin_anywhere.amrs"), amrs);
