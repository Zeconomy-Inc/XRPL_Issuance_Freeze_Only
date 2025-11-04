// api/xrpl/execute/index.js
export const config = { runtime: "nodejs22.x" };

const path = require("path");

// Load runner.cjs from THIS directory (not project root)
const runMod = require(path.join(__dirname, "runner.cjs"));
const run =
  typeof runMod === "function"
    ? runMod
    : typeof runMod?.default === "function"
    ? runMod.default
    : typeof runMod?.execute === "function"
    ? runMod.execute
    : null;

module.exports = async (req, res) => {
  try {
    if (!run) throw new Error("runner.cjs does not export a function");

    // Parse body robustly
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    if (!body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {}
    }

    // Adapt to common signatures
    let result;
    if (run.length >= 2) {
      // (req, res) style — runner handles the response
      return await run(req, res);
    }
    if (run.length === 1) {
      // (body) or (req) style — pass body if present, else req
      result = await run(body ?? req);
    } else {
      // no-args or options object
      result = await run({ req, body });
    }

    res.status(200).json(result ?? { ok: true });
  } catch (err) {
    console.error("EXECUTE_ERROR", err);
    res.status(400).json({ error: String(err.message || err) });
  }
};
