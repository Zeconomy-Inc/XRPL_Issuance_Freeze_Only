import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const {
    issuerSecret,
    holderSecret,
    currencyCode,
    amount,
    limit,
    freeze,
    network,
    verbose,
  } = req.body || {};
  if (
    !issuerSecret ||
    !holderSecret ||
    !currencyCode ||
    !amount ||
    !limit ||
    !network
  )
    return res.status(400).json({ error: "Missing required fields" });

  const scriptPath = path.join(__dirname, "..", "index.cjs");
  const args = [
    scriptPath,
    "--issuer-secret",
    issuerSecret,
    "--holder-secret",
    holderSecret,
    "--currency-code",
    String(currencyCode),
    "--amount",
    String(amount),
    "--limit",
    String(limit),
    "--freeze",
    String(Boolean(freeze)),
    "--network",
    String(network),
  ];
  if (verbose) args.push("--verbose");

  const child = spawn("node", args, { env: process.env });

  let stdout = "",
    stderr = "";
  child.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  child.on("error", (err) =>
    res.status(500).json({ error: "Spawn error", detail: String(err) })
  );
  child.on("close", (code) => {
    res.status(code === 0 ? 200 : 422).json({
      code,
      stdout: safe(stdout),
      stderr: safe(stderr),
    });
  });
}
function safe(s) {
  const t = String(s || "").trim();
  try {
    return t ? JSON.parse(t) : "";
  } catch {
    return t;
  }
}
