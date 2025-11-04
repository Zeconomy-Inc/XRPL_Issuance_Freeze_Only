// api/xrpl/execute/index.js
// Run runner.cjs as a CLI via child_process and return its result.

const path = require("path");
const { execFile } = require("child_process");

function buildArgs(body) {
  const args = [path.join(__dirname, "runner.cjs")];

  const add = (flag, val, toString = true) => {
    if (val === undefined || val === null || val === "") return;
    args.push(flag);
    args.push(toString ? String(val) : val);
  };

  // Map incoming JSON → CLI flags
  add("--issuer-secret", body.issuerSecret);
  add("--holder-secret", body.holderSecret);
  // investorAddress maps to holder-address in your CLI
  add("--holder-address", body.investorAddress || body.holderAddress);
  add("--amount", body.amount);
  add("--currency-code", body.currencyCode);
  add("--limit", body.limit);
  add("--network", body.network);
  if (body.freeze === true) args.push("--freeze");
  if (body.verbose === true) args.push("--verbose");

  return args;
}

function tryParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    // robust body parsing
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") body = {};

    const nodeBin = process.execPath; // Node runtime on Vercel
    const argv = buildArgs(body);

    // Spawn runner.cjs
    execFile(
      nodeBin,
      argv,
      { cwd: __dirname, env: { ...process.env } },
      (error, stdout, stderr) => {
        // If runner printed JSON, return it; else include raw text
        const jsonOut = tryParseJSON(stdout) || tryParseJSON(stderr);

        if (error) {
          // Non-zero exit — bubble a clear response
          return res.status(400).json({
            error: "RUNNER_CLI_ERROR",
            code: typeof error.code === "number" ? error.code : undefined,
            signal: error.signal || undefined,
            stdout:
              jsonOut || (stdout ? String(stdout).slice(0, 4000) : undefined),
            stderr: stderr ? String(stderr).slice(0, 4000) : undefined,
          });
        }

        // Success path
        if (jsonOut) return res.status(200).json(jsonOut);
        return res.status(200).json({
          ok: true,
          stdout: stdout ? String(stdout).slice(0, 4000) : "",
        });
      }
    );
  } catch (e) {
    console.error("EXECUTE_WRAPPER_ERROR", e);
    res
      .status(500)
      .json({
        error: "EXECUTE_WRAPPER_ERROR",
        message: String((e && e.message) || e),
      });
  }
};
