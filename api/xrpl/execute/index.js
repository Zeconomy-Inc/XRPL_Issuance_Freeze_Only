// Ensures Node 22 serverless runtime
export const config = { runtime: "nodejs22.x" };

// Delegate to your CommonJS runner
const path = require("path");

// If runner.cjs exports a function like: module.exports = async (req) => ({ ok: true })
const run = require(path.join(process.cwd(), "runner.cjs"));

module.exports = async (req, res) => {
  try {
    // Handle both raw body and JSON
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

    const result = await run({ req, body });
    res.status(200).json(result ?? { ok: true });
  } catch (err) {
    console.error("EXECUTE_ERROR", err);
    res.status(400).json({ error: String(err.message || err) });
  }
};
