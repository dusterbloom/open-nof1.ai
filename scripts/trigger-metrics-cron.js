const jwt = require('jsonwebtoken');

const CRON_SECRET = '1234';
const BASE_URL = 'http://localhost:3001';

async function triggerCron() {
  const token = jwt.sign({}, CRON_SECRET);

  console.log('📊 Triggering metrics cron...\n');

  const response = await fetch(
    `${BASE_URL}/api/cron/20-seconds-metrics-interval?token=${token}`
  );

  const text = await response.text();
  console.log('Response:', text);
  console.log('\n✅ Metrics cron triggered successfully!');
}

triggerCron().catch(console.error);
