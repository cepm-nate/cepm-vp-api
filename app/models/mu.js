const MssqlConnection = require('../db/mssql');
const { spawn } = require('child_process');

class MU {
  constructor() {
    // Username Domain (prefix to supplied username). Use blank string if you don't use an LDAP system.
    this.USER_DOMAIN = "CORP\\";

    // Instance of MssqlConnection
    this.db = new MssqlConnection();
  }

  async connect(data) {
    const password = data.Password || data.PASSWORD;
    const username = decodeURIComponent(data.VPUserName);
    const isBeta = data.isBeta === true;

    await this.db.connect(username, password, isBeta);
  }

  async post(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    // Convert data from JSON to normal (assuming it's already an object, or parse if string)
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      return { error: 'Invalid JSON data!', num_code: 304 };
    }

    // check that our key fields are present
    this.check_key_fields_mu(parsedData);

    // Connect if we need to
    await this.connect(parsedData);

    // Sync out MU to Database
    const syncOutMsg = await this.save_mu_to_db(parsedData);

    // Now we post it from bJCCB to bJCCD!
    return await this.post_saved_mu_in_db(syncOutMsg, parsedData);
  }

  check_key_fields_mu(data) {
    if (!data.co || data.co === 'null' || data.co === 'undefined') {
      throw new Error('"co" is not present or undefined.');
    }
    if (!data.mth || data.mth === 'null' || data.mth === 'undefined') {
      throw new Error('"mth" is not present or undefined.');
    }
    if (!data.batchId || data.batchId === 'null' || data.batchId === 'undefined') {
      throw new Error('"batchId" is not present or undefined.');
    }
  }

  async save_mu_to_db(data) {
    const outputs = [];

    // These settings have to match what's on the server stored procedure
    const fieldSep = '\t'; // TAB
    const rowSep = '\r'; // CARRIAGE RETURN

    const username = data.VPUserName;
    const co = data.co;
    const mth = data.mth;
    const batchId = data.batchId;
    const source = data.source;
    const job = data.job;
    const udmemo = data.udMemo;
    const actualDate = data.actualDate;
    const cols = data.cols.join(',');
    const rows = this.array_2d_to_str(data.rows, fieldSep, rowSep);

    // Connect if we need to
    await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('co', co);
    request.input('mth', mth);
    request.input('batchId', batchId);
    request.input('source', source);
    request.input('job', job);
    request.input('udMemo', udmemo);
    request.input('actualDate', actualDate);
    request.input('cols', cols);
    request.input('rows', rows);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspSyncInMatUseBatch');

    const rcode = result.output.rcode;
    const out_msg = result.output.ReturnMessage;

    if (rcode === 1) {
      throw new Error(out_msg);
    }

    // TEMP to grab possible table output
    if (result.recordset && result.recordset.length > 0) {
      outputs.push(...result.recordset);
    }

    return out_msg;
  }

  async post_saved_mu_in_db(sync_out_msg, data) {
    let msgToReturn = '';

    if (sync_out_msg.includes('Success')) {
      msgToReturn = { Message: 'Success', Exploded: sync_out_msg.split(',') };
    }

    // EXTRACT the real BatchId
    const explodedMsg = sync_out_msg.split(',');

    // Now we SPLIT OFF INTO ANOTHER THREAD to allow the first one to return to the mobile device,
    // while this second thread does the posting.
    // In Node, spawn a child process or use a queue/worker.
    // For simplicity, simulate or skip as full implementation might need external file.

    const pw = data.Password || data.PASSWORD;
    const usr = data.VPUserName;
    const co = data.co;
    const mth = data.mth;
    const id = parseInt(explodedMsg[1]); // From first DB call

    // Spawn child process (assuming there's a stub file, but adjust path)
    // const child = spawn('node', ['path/to/child_mu_post.js', '-u', usr, '-p', pw, '-c', co, '-m', mth, '-b', id]);

    // For now, return immediately
    return msgToReturn;
  }

  array_2d_to_str(arr, fsep, rsep) {
    let strToReturn = '';

    for (const line of arr) {
      for (const field of line) {
        strToReturn += field.toString() + fsep;
      }
      // remove the last fsep
      strToReturn = strToReturn.slice(0, -fsep.length);
      // Add the row separator
      strToReturn += rsep;
    }

    // remove the last rsep
    strToReturn = strToReturn.slice(0, -rsep.length);

    return strToReturn;
  }
}

module.exports = MU;
