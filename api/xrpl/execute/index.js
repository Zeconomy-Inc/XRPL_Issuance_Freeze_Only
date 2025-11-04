// api/xrpl/execute/index.js
const path = require("path");

// Load runner.cjs from THIS directory (same folder)
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
    if (!run) throw new Error("runner.cjs does not export a callable function");

    // Robust body parsing
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

    // Support common signatures
    if (run.length >= 2) {
      // (req, res)
      return await run(req, res);
    }

    const result =
      run.length === 1
        ? await run(body ?? req) // (body) or (req)
        : await run({ req, body }); // (opts)

    res.status(200).json(result ?? { ok: true });
  } catch (err) {
    console.error("EXECUTE_ERROR", err);
    res.status(400).json({ error: String(err.message || err) });
  }
};
