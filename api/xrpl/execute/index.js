// api/xrpl/execute/index.js
// Direct XRPL implementation: check trustline → issue → optional freeze.
// CommonJS (module.exports) so it runs fine on Vercel Modern (Node 22).

const xrpl = require("xrpl");

const CLASSIC_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const clean = (s) => (s ?? "").trim().replace(/\u200B/g, "");

// Convert non-3-char ASCII codes (e.g., "GDCP20251110") to 160-bit hex
function toXrplCurrency(code) {
  const s = String(code || "");
  if (/^[A-Z0-9]{3}$/.test(s)) return s;
  const hex = Buffer.from(s, "ascii").toString("hex").toUpperCase();
  return hex.padEnd(40, "0").slice(0, 40);
}

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
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const body = await parseBody(req);

    // Inputs
    let {
      issuerSecret,
      investorAddress, // classic r...
      amount,
      currencyCode,
      freeze,
      network,
      limit,
    } = body;

    // Sanitize
    issuerSecret = clean(issuerSecret);
    investorAddress = clean(investorAddress);
    amount = clean(amount);
    currencyCode = clean(currencyCode);
    network = (clean(network) || "testnet").toLowerCase();
    limit = clean(limit);

    // Validate
    if (!issuerSecret) {
      return res.status(400).json({ error: "Missing issuerSecret" });
    }
    if (!investorAddress || !CLASSIC_ADDR.test(investorAddress)) {
      return res.status(400).json({ error: "Invalid investorAddress" });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const currency = toXrplCurrency(currencyCode);

    // XRPL endpoints: prefer env, fall back to public
    //const server =
    //  network === "mainnet"
    //    ? process.env.XRPL_MAINNET_URL || "wss://xrplcluster.com"
    //    : process.env.XRPL_TESTNET_URL || "wss://s.altnet.rippletest.net:51233";
    let server;
    if (network === "mainnet1") {
      server = process.env.XRPL_MAINNET1_URL || "wss://xrplcluster.com";
    } else if (network === "mainnet2") {
      server =
        process.env.XRPL_MAINNET2_URL ||
        "wss://sparkling-winter-wind.xrp-mainnet.quiknode.pro/8c9ff2d4ce407cd3f6a0b3ba5484963ee5cad831/";
    } else {
      server =
        process.env.XRPL_TESTNET_URL || "wss://s.altnet.rippletest.net:51233";
    }
    const client = new xrpl.Client(server);
    await client.connect();

    const issuer = xrpl.Wallet.fromSeed(issuerSecret);
    const issuerAddr = issuer.address;

    // Optional: check trustline (issuer-only flow expects it)
    const lines = await client.request({
      command: "account_lines",
      account: investorAddress,
      peer: issuerAddr,
    });

    const hasTL = (lines.result.lines || []).some(
      (l) =>
        l.account === issuerAddr &&
        (String(l.currency).toUpperCase() === currency.toUpperCase() ||
          String(l.currency).toUpperCase() === currencyCode.toUpperCase())
    );

    if (!hasTL) {
      await client.disconnect();
      return res
        .status(400)
        .json({ error: "Trustline missing for investor/issuer/token" });
    }

    // 1) Issue payment (issuer → investor)
    const payment = {
      TransactionType: "Payment",
      Account: issuerAddr,
      Destination: investorAddress,
      Amount: {
        currency,
        issuer: issuerAddr,
        value: String(amt),
      },
    };

    const preparedPay = await client.autofill(payment);
    const signedPay = issuer.sign(preparedPay);
    const payResult = await client.submitAndWait(signedPay.tx_blob);

    // 2) Optional: freeze (issuer side freeze on the trustline)
    console.log("freeze", freeze);
    let freezeResult = null;
    if (freeze === true) {
      // Freeze is set via TrustSet with tfSetFreeze (issuer side / HighFreeze)
      const trustSet = {
        TransactionType: "TrustSet",
        Account: issuerAddr,
        Flags: xrpl.TrustSetFlags.tfSetFreeze,
        LimitAmount: {
          currency,
          issuer: investorAddress, // direction
          value: "0",
        },
      };
      const preparedT = await client.autofill(trustSet);
      const signedT = issuer.sign(preparedT);
      freezeResult = await client.submitAndWait(signedT.tx_blob);
      console.log("freezeResult", freezeResult);
    }

    await client.disconnect();

    return res.status(200).json({
      ok: true,
      payment: {
        hash: payResult.result?.hash,
        engine_result: payResult.result?.engine_result,
      },
      freeze: freezeResult
        ? {
            hash: freezeResult.result?.hash,
            engine_result: freezeResult.result?.engine_result,
          }
        : null,
    });
  } catch (e) {
    console.error("ISSUE_FREEZE_ERROR", e);
    return res.status(500).json({
      error: "ISSUE_FREEZE_ERROR",
      message: String((e && e.message) || e),
    });
  }
};
