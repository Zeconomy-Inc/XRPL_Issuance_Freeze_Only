// api/xrpl/execute/index.js
// CommonJS wrapper that safely loads runner.cjs and surfaces clear errors

const path = require("path");
const fs = require("fs");

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

let runMod, run, loadError;

try {
  // IMPORTANT: load runner.cjs from the SAME folder as this file
  const runnerPath = path.join(__dirname, "runner.cjs");
  runMod = require(runnerPath);

  // normalize export shapes: module.exports = fn, export default, or { execute }
  run =
    (typeof runMod === "function" && runMod) ||
    (runMod && typeof runMod.default === "function" && runMod.default) ||
    (runMod && typeof runMod.execute === "function" && runMod.execute) ||
    null;
} catch (e) {
  loadError = e;
}

module.exports = async (req, res) => {
  // Basic request context (non-sensitive)
  const ctx = {
    method: req.method,
    url: req.url,
  };

  // If runner failed to load, show a precise, actionable error
  if (loadError || !run) {
    const dir = fs.readdirSync(__dirname);
    console.error("RUNNER_LOAD_ERROR", {
      error: String(loadError),
      dir,
      keys: runMod ? Object.keys(runMod) : null,
    });

    return res.status(500).json({
      error: "RUNNER_LOAD_ERROR",
      message: loadError
        ? String(loadError.message || loadError)
        : "runner.cjs did not export a callable function",
      dirListing: dir, // confirms runner.cjs is actually there
      exportKeys: runMod ? Object.keys(runMod) : null, // shows what it exported
      hint: "Ensure runner.cjs exports a function: module.exports = async (req, res) => { ... } OR module.exports = async (body) => { ... } OR exports.execute = async (...) => { ... }",
    });
  }

  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    // Parse body robustly across environments
    let body = req.body;
    if (typeof body === "string") body = safeJsonParse(body);
    if (!body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = safeJsonParse(Buffer.concat(chunks).toString("utf8")) || {};
    }

    // Support common signatures
    if (run.length >= 2) {
      // runner expects (req, res) and will send the response itself
      return await run(req, res);
    }

    // runner expects (body) or no-arg/options
    const result =
      run.length === 1 ? await run(body) : await run({ req, body });
    return res.status(200).json(result ?? { ok: true });
  } catch (e) {
    console.error("RUNNER_EXEC_ERROR", {
      ctx,
      error: (e && e.stack) || String(e),
    });
    return res.status(500).json({
      error: "RUNNER_EXEC_ERROR",
      message: String((e && e.message) || e),
    });
  }
};
