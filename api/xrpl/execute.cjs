// api/xrpl/execute.cjs
const { spawn } = require("child_process");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
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

    // Minimal validation – lock to expected flags only
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

    // Build CLI args exactly like your command
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

    const child = spawn("node", args, {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

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
      const payload = {
        code,
        stdout: tryParseJson(stdout),
        stderr: tryParseJson(stderr),
      };
      // Treat non-zero exit as 422 to bubble script failures
      res.status(code === 0 ? 200 : 422).json(payload);
    });
  } catch (e) {
    res.status(500).json({ error: "Handler exception", detail: String(e) });
  }
};

function tryParseJson(txt) {
  const s = String(txt || "").trim();
  if (!s) return "";
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
