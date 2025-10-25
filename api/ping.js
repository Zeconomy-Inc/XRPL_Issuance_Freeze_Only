// api/ping.js
module.exports = (req, res) => {
  res.status(200).json({ pong: true, method: req.method });
};
