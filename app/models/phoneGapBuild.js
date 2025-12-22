const https = require('https');

class PhoneGapBuild {
  constructor() {
    this.TOKEN = 's19gsKtCG3BW9zgYap5i';
  }

  async get_current_version(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    if (!data.appid) {
      return { error: 'App ID was not sent', num_code: 303 };
    }

    const url = `https://build.phonegap.com/api/v1/apps/${data.appid}?auth_token=${this.TOKEN}`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (error) {
            resolve({ error: 'Invalid JSON response', num_code: 500 });
          }
        });
      }).on('error', (error) => {
        resolve({ error: 'Failed to fetch', num_code: 500 });
      });
    });
  }
}

module.exports = PhoneGapBuild;