'use strict';

// Authentication is enforced BEFORE dispatch by Cloud Run's invoker IAM check.
// This function must never be deployed with that check disabled or public IAM.
// No token handling, request logging, outbound calls, application imports or data.
exports.health = (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.set('Allow', 'GET');
    return res.status(405).type('text/plain').send('Method not allowed\n');
  }
  if (req.path !== '/healthz' || Object.keys(req.query || {}).length !== 0) {
    return res.status(404).type('text/plain').send('Not found\n');
  }
  return res.status(200).type('application/json').send('{"status":"healthy"}\n');
};
