// api/derive/index.js
// Derive XRPL classic address + public key from a seed on the server.
const xrpl = require("xrpl");

function isProbablySeed(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  // Allow both Ed25519 (sEd...) and secp256k1 (family "s...") formats
  return (
    /^sEd[1-9A-HJ-NP-Za-km-z]{20,}$/.test(t) ||
    /^s[1-9A-HJ-NP-Za-km-z]{20,}$/.test(t)
  );
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

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

    const seed = (body.seed || "").trim();
    if (!isProbablySeed(seed)) {
      return res.status(400).json({ error: "INVALID_SEED" });
    }

    // Derive with xrpl
    const wallet = xrpl.Wallet.fromSeed(seed); // throws on invalid
    return res.status(200).json({
      ok: true,
      address: wallet.address, // classic r...
      publicKey: wallet.publicKey, // hex
    });
  } catch (e) {
    return res
      .status(400)
      .json({ error: "DERIVE_FAILED", message: String(e?.message || e) });
  }
};
