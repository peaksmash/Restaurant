const D = require('better-sqlite3')('database.sqlite');
const cfg = JSON.stringify({
  baseUrl: 'https://192.168.1.73:2001',
  owner: 'com.necomplus.test',
  keyEnvName: 'ARTEMIS_TEST_API_KEY',
  allowInsecureTls: true
});
D.prepare('UPDATE payment_devices SET configJson=? WHERE provider=?').run(cfg, 'artemis');
console.log('OK', D.prepare('SELECT configJson FROM payment_devices WHERE provider=?').get('artemis'));