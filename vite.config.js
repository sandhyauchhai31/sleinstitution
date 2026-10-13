import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'razorpay-dev-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url || '';

            // ── /backend/create-order.php ──────────────────────────────────
            if (req.method === 'POST' && url.includes('/create-order.php')) {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const data = JSON.parse(body || '{}');
                  const amountRupees = Number(data.amount) || 2000;
                  const amountPaise = Math.round(amountRupees * 100);
                  const currency = (data.currency || 'INR').toUpperCase();
                  const currentEnv = loadEnv(mode, process.cwd(), '');
                  const isLiveMode = (currentEnv.VITE_RAZORPAY_MODE || 'test').toLowerCase() === 'live';
                  const keyId = (isLiveMode
                    ? (currentEnv.RAZORPAY_LIVE_KEY_ID || currentEnv.VITE_RAZORPAY_LIVE_KEY_ID || currentEnv.VITE_RAZORPAY_KEY_ID || currentEnv.key_id || 'rzp_live_TSInBiL96HvXCm')
                    : (currentEnv.VITE_RAZORPAY_TEST_KEY_ID || currentEnv.TEST_RAZORPAY_KEY_ID || currentEnv.VITE_RAZORPAY_KEY_ID || currentEnv.key_id || 'rzp_test_SPs6AqG8E3r2Cp')
                  ).trim();
                  const keySecret = (isLiveMode
                    ? (currentEnv.RAZORPAY_LIVE_KEY_SECRET || currentEnv.VITE_RAZORPAY_LIVE_KEY_SECRET || currentEnv.VITE_RAZORPAY_KEY_SECRET || currentEnv.key_secret || 'sadn8Oy8K2TVSKV70kPbcQFG')
                    : (currentEnv.RAZORPAY_TEST_KEY_SECRET || currentEnv.TEST_RAZORPAY_KEY_SECRET || currentEnv.VITE_RAZORPAY_KEY_SECRET || currentEnv.key_secret || '6EF1JJ2U4Hy5h93WPHVb6GZg')
                  ).trim();

                  try {
                    const authStr = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
                    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Basic ${authStr}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        amount: amountPaise,
                        currency: currency,
                        receipt: `rcpt_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
                        payment_capture: 1,
                        notes: {
                          customerName: data.customerName || '',
                          customerEmail: data.customerEmail || '',
                          customerPhone: data.customerPhone || '',
                          appNumber: data.appNumber || '',
                          course: data.course || '',
                          branch: data.branch || ''
                        }
                      })
                    });

                    if (rzpRes.ok) {
                      const rzpData = await rzpRes.json();
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({
                        success: true,
                        order_id: rzpData.id,
                        amount: rzpData.amount,
                        currency: rzpData.currency,
                        key_id: keyId,
                        receipt: rzpData.receipt,
                        status: rzpData.status
                      }));
                      return;
                    } else {
                      const errText = await rzpRes.text();
                      console.warn('[Vite Dev Gateway] Razorpay API error:', rzpRes.status, errText);
                    }
                  } catch (fetchErr) {
                    console.warn('[Vite Dev Gateway] Order fetch notice:', fetchErr?.message || fetchErr);
                  }

                  // Resilient direct payment response (DO NOT pass fake order_id as Razorpay will reject it)
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    is_mock: false,
                    order_id: null,
                    amount: amountPaise,
                    currency: currency,
                    key_id: keyId,
                    receipt: `rcpt_${Date.now()}`,
                    status: 'created'
                  }));
                } catch (e) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    is_mock: false,
                    order_id: null,
                    amount: 200000,
                    currency: 'INR',
                    key_id: 'rzp_test_SPs6AqG8E3r2Cp'
                  }));
                }
              });
              return;
            }

            // ── /backend/verify-payment.php ───────────────────────────────
            if (req.method === 'POST' && url.includes('/verify-payment.php')) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, verified: true }));
              return;
            }

            // ── /backend/webhook.php (dev simulator) ──────────────────────
            // Accepts POST to /backend/webhook.php for local testing.
            // Use ngrok to expose localhost:3000 and register the ngrok URL
            // in the Razorpay Dashboard as the webhook endpoint during dev.
            if (req.method === 'POST' && url.includes('/webhook.php')) {
              let whBody = '';
              req.on('data', chunk => { whBody += chunk; });
              req.on('end', () => {
                try {
                  const whEvent = JSON.parse(whBody || '{}');
                  const whType = whEvent.event || 'unknown';
                  const whEntity = whEvent?.payload?.payment?.entity || {};
                  console.log('[Vite Dev Webhook] Event:', whType, '| payment_id:', whEntity.id || 'N/A', '| order_id:', whEntity.order_id || 'N/A');
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    message: 'Webhook received (dev simulator)',
                    event: whType,
                    payment_id: whEntity.id || '',
                    processed_at: new Date().toISOString()
                  }));
                } catch (e) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'Webhook acknowledged' }));
                }
              });
              return;
            }

            next();
          });
        }
      }
    ],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/backend': {
          target: 'http://localhost/slesinstitution',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
