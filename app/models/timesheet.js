const MssqlConnection = require('../db/mssql');

class Timesheet {
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

    // Convert data from JSON to normal.
    let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

    // check that our key fields are present
    this.check_key_fields_ts(parsedData);

    // Connect if we need to
    await this.connect(parsedData);

    // Transform pseudo columns
    await this.transform_psuedo_columns_into_container(parsedData);

    // Now we sync OUT
    return await this.save_ts_to_db(parsedData);
  }

  async getSuggestedPhases(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    // Connect if we need to
    await this.connect(data);

    const outputs = [];

    const username = data.VPUserName;
    const jcco = data.JCCo;
    const job = data.Job;
    const actdate = data.ActDate;

    const request = await this.db.request();
    request.input('VPUserName', username);
    request.input('JCCo', jcco);
    request.input('Job', job);
    request.input('ActDate', actdate);
    request.input('ReturnAllCols', 0);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetSuggestedPhases');

    const rcode = result.output.rcode;
    const out_msg = result.output.ReturnMessage;

    if (rcode === 1) {
      return { error: out_msg, num_code: 500 };
    }

    if (result.recordset && result.recordset.length > 0) {
      outputs.push(...result.recordset);
    }

    return { Message: out_msg, Phases: outputs };
  }

  async transform_psuedo_columns_into_container(data) {
    const tableName = 'bPRMyTimesheetDetail';
    const co = data.PRCo || 1;

    // Connect if we need to
    await this.connect(data);

    const request = await this.db.request();
    request.input('Co', co);
    request.input('TableName', tableName);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetPsuedoColumns');

    if (result.recordset && result.recordset.length > 0) {
      result.recordset.forEach(row => {
        const containerCol = row.ContainerField;
        const containerKey = data.detailCols.indexOf(containerCol);

        if (containerKey === -1) {
          throw new Error(`The Pseudo Column [${row.Name}] in [${tableName}] is supposed to reside in [${containerCol}]. However, [${containerCol}] is not in the list of columns to sync!`);
        }

        const idxOfCol = data.detailCols.indexOf(row.Name);

        if (idxOfCol === -1) {
          throw new Error(`The Pseudo Column [${row.Name}] in [${tableName}] is not listed in the list of columns you wish to sync.`);
        }

        data.detailRows.forEach((savedRow, rowsK) => {
          data.detailRows[rowsK][containerKey] += `[${row.Name}]{${savedRow[idxOfCol]}} `;
          delete data.detailCols[idxOfCol];
          delete data.detailRows[rowsK][idxOfCol];
        });

        data.detailCols = data.detailCols.filter((_, i) => i !== idxOfCol);
        data.detailRows.forEach(row2 => {
          row2.length = data.detailCols.length;
        });
      });
    }
  }

  check_key_fields_ts(data) {
    if (data.headerRows.length === 0) {
      throw new Error('No headerRows supplied.');
    }
  }

  async save_ts_to_db(data) {
    const outputs = [];

    const fieldSep = '\t';
    const rowSep = '\r';

    const username = data.VPUserName;
    const headerCols = data.headerCols.join(',');
    const headerRows = this.array_2d_to_str(data.headerRows, fieldSep, rowSep);
    const detailCols = data.detailCols.join(',');
    const detailRows = this.array_2d_to_str(data.detailRows, fieldSep, rowSep);

    // Connect if we need to
    await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('headerCols', headerCols);
    request.input('headerRows', headerRows);
    request.input('detailCols', detailCols);
    request.input('detailRows', detailRows);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspSyncInTimesheets');

    const rcode = result.output.rcode;
    const out_msg = result.output.ReturnMessage;

    if (rcode === 1) {
      throw new Error(out_msg);
    }

    if (result.recordset && result.recordset.length > 0) {
      outputs.push(...result.recordset);
    }

    return { Message: out_msg, Changes: outputs };
  }

  array_2d_to_str(arr, fsep, rsep) {
    let strToReturn = '';

    arr.forEach(line => {
      line.forEach(field => {
        strToReturn += field.toString() + fsep;
      });
      strToReturn = strToReturn.slice(0, -fsep.length);
      strToReturn += rsep;
    });

    strToReturn = strToReturn.slice(0, -rsep.length);

    return strToReturn;
  }
}

module.exports = Timesheet;
