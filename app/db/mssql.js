class MssqlConnection {
  constructor() {
    this.poolPromise = require('../connectors/db').poolPromise;
  }

  async connect(username, password, isBeta) {
    // Pool is already connected, no action needed
  }

  async request() {
    const pool = await this.poolPromise;
    return pool.request();
  }

  async query(sql) {
    const pool = await this.poolPromise;
    return pool.request().query(sql);
  }
}

module.exports = MssqlConnection;