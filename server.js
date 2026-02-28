require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'test_token_12345';

let templates = [
  { id: '1', keyword: 'hours', response: 'We are open Monday to Friday, 9 AM to 6 PM. Saturday 10 AM to 4 PM. Closed on Sunday.' },
  { id: '2', keyword: 'location', response: 'We are located at 123 Business Street, City Center. Parking is available in front of the building.' },
  { id: '3', keyword: 'pricing', response: 'Please visit our website or call us for detailed pricing information.' }
];

let conversations = [];

// ============ TEMPLATES API ============
app.get('/api/templates', (req, res) => {
  res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const { keyword, response } = req.body;
  const newTemplate = {
    id: Date.now().toString(),
    keyword: keyword.toLowerCase(),
    response: response
  };
  templates.push(newTemplate);
  res.json(newTemplate);
});

app.delete('/api/templates/:id', (req, res) => {
  templates = templates.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// ============ CONVERSATIONS API ============
app.get('/api/conversations', (req, res) => {
  res.json(conversations);
});

// ============ WHATSAPP WEBHOOK ============
app.post('/webhook/messages', async (req, res) => {
  const { From, Body } = req.body;
  
  if (!From || !Body) {
    return res.sendStatus(400);
  }

  try {
    const matched = templates.find(t => 
      Body.toLowerCase().includes(t.keyword.toLowerCase())
    );

    let aiResponse = null;
    let status = 'pending';

    if (matched) {
      aiResponse = matched.response;
      status = 'resolved';

      // Send auto-response
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
        const auth = Buffer.from(
          `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
        ).toString('base64');

        await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          new URLSearchParams({
            From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
            To: From,
            Body: aiResponse
          }),
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        ).catch(err => console.error('Twilio send error:', err));
      }
    }

    // Log conversation
    conversations.push({
      id: Date.now().toString(),
      customerName: 'Customer',
      customerNumber: From,
      lastMessage: Body,
      aiResponse: aiResponse || 'No matching template',
      timestamp: new Date().toLocaleTimeString(),
      status: status
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// ============ WEBHOOK VERIFICATION ============
app.get('/webhook/messages', (req, res) => {
  const token = req.query.verification_token;
  if (token === VERIFY_TOKEN) {
    res.sendStatus(200);
  } else {
    res.sendStatus(403);
  }
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
