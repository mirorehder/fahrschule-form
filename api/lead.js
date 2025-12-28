export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      firstName, lastName, email, phone, city, category, source, message,
      website, // honeypot
    } = req.body || {};

    // 1) Honeypot check (Spam)
    if (website && String(website).trim().length > 0) {
      return res.status(200).json({ ok: true }); // still "ok", so bots don't learn
    }

    // 2) Minimal validation
    if (!firstName || !lastName || !email || !phone || !city || !category || !source) {
      return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' });
    }

    // 3) Optional: basic normalization
    const payload = {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      category: String(category).trim(),
      source: String(source).trim(),
      message: message ? String(message).trim() : '',
      createdAt: new Date().toISOString(),
      status: 'Neu',
      // optional meta
      meta: {
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        origin: req.headers.origin || '',
      }
    };

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;

    if (!n8nWebhookUrl) {
      return res.status(500).json({ error: 'Server-Konfiguration fehlt (N8N_WEBHOOK_URL).' });
    }

    // 4) Forward to n8n webhook
    const r = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-webhook-secret': secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'n8n Webhook Fehler', detail: text.slice(0, 300) });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
