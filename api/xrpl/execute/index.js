// api/xrpl/execute/index.js
const { spawn } = require("child_process");
const path = require("path");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const {
    issuerSecret,
    holderSecret,
    holderAddress, // NEW
    investorAddress, // allow old field
    currencyCode,
    amount,
    freeze,
    network,
    limit,
    verbose,
  } = req.body;
  // basic required fields
  // alias support
  holderAddress = holderAddress || investorAddress || null;
  if (!issuerSecret || !currencyCode || !amount || !network) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  // exactly one of secret or address
  if ((hasHolder && hasAddr) || (!hasHolder && !hasAddr)) {
    return res
      .status(400)
      .json({ error: "Provide holderSecret OR holderAddress (not both)" });
  }
  // limit is only required when we are creating the trustline
  if (
    !issuerOnly &&
    (limit === undefined || limit === null || `${limit}`.trim() === "")
  ) {
    return res
      .status(400)
      .json({ error: "Missing limit (required when creating trustline)" });
  }
  // point to the script sitting *next to* this file
  const scriptPath = path.join(__dirname, "runner.cjs");
  console.log("scriptPath:", scriptPath);

  // build argv for the runner
  const args = [
    "node",
    "runner.cjs",
    "--issuer-secret",
    issuerSecret,
    hasHolder ? "--holder-secret" : "--holder-address",
    hasHolder ? holderSecret : holderAddress,
    "--currency-code",
    currencyCode,
    "--amount",
    String(amount),
    ...(issuerOnly ? [] : ["--limit", String(limit)]),
    "--freeze",
    String(!!freeze),
    "--network",
    network,
    ...(verbose ? ["--verbose"] : []),
  ];
  // classic mode
  if (holderSecret) {
    args.push("--holder-secret", holderSecret);
  } else if (investorAddress) {
    // issue-only mode (trustline must already exist)
    args.push("--holder-address", investorAddress);
  }
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
