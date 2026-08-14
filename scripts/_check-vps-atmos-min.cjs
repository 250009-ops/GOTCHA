const { createRequire } = require("module");
const path = require("path");
const require2 = createRequire("C:/projects/donish_edu/backend/package.json");
const { Client } = require2("ssh2");
const dotenv = require2("dotenv");
const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, "deploy/.env") });
const IP = process.env.IP?.trim();
const PASSWORD = process.env.PASSWORD?.trim();
const APP = process.env.VPS_APP_DIR?.trim() || "/var/www/gotcha";
function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => (code === 0 ? resolve() : reject(new Error("exit " + code))));
    });
  });
}
const conn = new Client();
conn.on("ready", async () => {
  try {
    console.log("==> env");
    await sshExec(conn, "grep -E '^(ATMOS_MIN_AMOUNT_SOM|PAYMENT_GATEWAY_ENABLED)=' '" + APP + "/.env'");
    console.log("==> dist default");
    await sshExec(conn, "grep -n 'ATMOS_MIN_AMOUNT_SOM\\|?? 500\\|?? 10000' '" + APP + "/services/api/dist/modules/billing/atmos.client.js' | head -5");
    console.log("==> gateway-status");
    await sshExec(conn, "sleep 3; curl -sS http://127.0.0.1:3200/api/v1/billing/gateway-status; echo");
    console.log("==> pm2");
    await sshExec(conn, "pm2 list | grep gotcha-api");
  } finally { conn.end(); }
});
conn.on("error", (e) => { console.error(e.message); process.exit(1); });
conn.connect({ host: IP, port: 22, username: "root", password: PASSWORD, readyTimeout: 25000 });