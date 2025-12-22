const MssqlConnection = require('../db/mssql');

class PMIssue {
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
    this.check_key_fields(parsedData);

    // Connect if we need to
    await this.connect(parsedData);

    // Sync out MU to Database
    return await this.save_issue_to_db(parsedData);
  }

  async delete_issue(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

    // check that our key fields are present
    this.check_key_fields(parsedData);

    // Connect if we need to
    await this.connect(parsedData);

    // Now we sync OUT -- use same SP as saving transfer
    return await this.save_issue_to_db(parsedData);
  }

  check_key_fields(data) {
    // no key fields to check
  }

  async save_issue_to_db(data) {
    const outputs = [];

    // These settings have to match what's on the server stored procedure
    const fieldSep = '\t'; // TAB
    const rowSep = '\r'; // CARRIAGE RETURN

    const username = data.VPUserName;
    const cols = data.cols.join(',');
    const rows = this.array_2d_to_str(data.rows, fieldSep, rowSep);

    // Connect if we need to
    await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('cols', cols);
    request.input('rows', rows);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspSyncInPMIssues');

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

  array_2d_to_str(arr, fsep, rsep) {
    let strToReturn = '';

    // Replace any ALREADY EXISTING $rseps with
    for (const line of arr) {
      for (const field of line) {
        strToReturn += field.toString().replace(new RegExp(rsep, 'g'), String.fromCharCode(10)) + fsep;
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

module.exports = PMIssue;
