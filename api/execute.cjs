import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

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
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Ensure we point to the script file packaged with the deployment
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

  child.on("error", (err) => {
    res.status(500).json({ error: "Spawn error", detail: String(err) });
  });

  child.on("close", (code) => {
    res.status(code === 0 ? 200 : 422).json({
      code,
      stdout: safeParse(stdout),
      stderr: safeParse(stderr),
    });
  });
}

function safeParse(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
