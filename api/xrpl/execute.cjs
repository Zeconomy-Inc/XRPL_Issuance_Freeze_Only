// api/xrpl/execute.js
import { spawn } from "node:child_process";

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

  const args = [
    "index.cjs",
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

  const child = spawn("node", args, { cwd: process.cwd(), env: process.env });

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
    // Try to JSON-parse script output; otherwise return as text
    const parsedOut = safeParse(stdout);
    const parsedErr = safeParse(stderr);
    res.status(code === 0 ? 200 : 422).json({
      code,
      stdout: parsedOut,
      stderr: parsedErr,
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
