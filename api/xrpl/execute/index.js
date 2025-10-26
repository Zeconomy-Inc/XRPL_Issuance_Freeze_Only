// api/xrpl/execute/index.js
const { spawn } = require("child_process");
const path = require("path");

module.exports = async (req, res) => {
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

  // point to the script sitting *next to* this file
  const scriptPath = path.join(__dirname, "index.cjs");
  console.log("scriptPath:", scriptPath);

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
};

function safe(s) {
  const t = String(s || "").trim();
  try {
    return t ? JSON.parse(t) : "";
  } catch {
    return t;
  }
}
