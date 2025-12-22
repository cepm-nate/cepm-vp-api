const MssqlConnection = require('../db/mssql');

class Attachment {
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

    // Set ANSI_WARNINGS, ANSI_PADDING ON
    const request = await this.db.request();
    await request.query('SET ANSI_WARNINGS, ANSI_PADDING ON;');
  }

  async delete(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    // Convert data from JSON to normal (assuming data is already an object)
    // In Node, if data is string, JSON.parse(data)
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      return { error: 'Invalid JSON data!', num_code: 304 };
    }

    // Connect if we need to
    await this.connect(parsedData);

    // Push attachment into Database (delete)
    const sync_out_msg = await this.delete_attachment(parsedData);

    return sync_out_msg;
  }

  async delete_attachment(data) {
    // Variables to send in the stored procedure
    const username = data.VPUserName;
    const attachments = data.rows;
    const cols = data.cols;

    // Connect if we need to
    // await this.connect(data);

    // Find index of AttachmentID
    const idx = cols.indexOf('AttachmentID');
    if (idx === -1) {
      throw new Error('AttachmentID column not found');
    }

    for (const a of attachments) {
      const attachmentID = a[idx];

      const request = await this.db.request();
      request.input('originalUser', username);
      request.input('AttachmentID', attachmentID);
      request.output('rcode', 0);
      request.output('ReturnMessage', '');

      const result = await request.execute('mmspDeleteAttachment');

      const rcode = result.output.rcode;
      const out_msg = result.output.ReturnMessage;

      if (rcode === 1) {
        throw new Error(out_msg);
      }
    }

    return {
      message: 'Attachments deleted successfully',
    };
  }

  check_data(data) {
    // Not programmed yet - throw error as in PHP
    throw new Error('We have not programmed this part yet. Good job getting this far!');
  }

  array_2d_to_str(arr, fsep, rsep) {
    // Not used in current implementation, but ported for completeness
    let strToReturn = '';

    // Replace any already existing rseps with chr(10) equivalent
    for (const line of arr) {
      for (const field of line) {
        strToReturn += field.toString().replace(new RegExp(rsep, 'g'), String.fromCharCode(10)) + fsep;
      }
      // Remove the last fsep
      strToReturn = strToReturn.slice(0, -fsep.length);
      // Add the row separator
      strToReturn += rsep;
    }
    // Remove the last rsep
    strToReturn = strToReturn.slice(0, -rsep.length);

    return strToReturn;
  }
}

module.exports = Attachment;
