// api/derive-key/index.js
// Derives XRPL public key (and address) from a secret seed, using Node 'xrpl'.

const xrpl = require("xrpl");

async function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      body = {};
    }
  }
  return body;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const { seed = "" } = await parseBody(req);
    const s = String(seed).trim();
    if (!s) return res.status(400).json({ error: "Missing seed" });

    try {
      const wallet = xrpl.Wallet.fromSeed(s);
      return res.status(200).json({
        publicKey: wallet.publicKey,
        address: wallet.address,
        algorithm: wallet.algorithm, // 'ed25519' or 'secp256k1'
      });
    } catch (e) {
      return res
        .status(200)
        .json({
          error: "Invalid seed",
          message: String((e && e.message) || e),
        });
    }
  } catch (e) {
    console.error("DERIVE_KEY_ERROR", e);
    return res
      .status(500)
      .json({
        error: "DERIVE_KEY_ERROR",
        message: String((e && e.message) || e),
      });
  }
};
