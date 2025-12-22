const MssqlConnection = require('../db/mssql');

class API {
  constructor() {
    // Case insensitive column names to NEVER select -- These are also in MM settings
    this.restrictedColumns = ['SSN', 'RoutingId', 'BankAcct', 'AttachmentData', 'AttachmentFileType'];

    // Words to NEVER let through SQL
    this.restrictedWordsGet = ['DROP', 'INSERT', 'DELETE', 'UPDATE'];

    // Username Domain (prefix to supplied username). Use blank string if you don't use an LDAP system.
    this.USER_DOMAIN = "CORP\\";

    // Global variable to track the username
    this.VPUSERNAME = '';

    // Global variable to store data to send by reply from a POST.
    this.TO_REPLY = [];

    // Instance of MssqlConnection
    this.db = new MssqlConnection();
  }



  async connect(data) {
    const password = data.Password || data.PASSWORD;
    const username = decodeURIComponent(data.VPUserName);
    const isBeta = data.isBeta === true;

    await this.db.connect(username, password, isBeta);
  }

  clean_data_in(data) {
    // Strip out any restricted columns like 'SSN' or 'CREDITCARD' or 'RoutingId' or 'BankAcct'
    data = this.strip_out_restricted_columns(data);

    // Strip out the udColumns being requested (they are added back in during the stored procedure)
    data = this.strip_out_ud_columns(data);

    this.clean_data_tablename(data.table);

    // Make lastSyncedVersion a number!
    data.lastSyncedVersion = +data.lastSyncedVersion;

    // Order the columns alphabetically ascending!!
    data.columns.sort();

    return data;
  }

  strip_out_restricted_columns(data) {
    this.restrictedColumns.forEach(badCol => {
      const index = data.columns.indexOf(badCol);
      if (index !== -1) {
        data.columns.splice(index, 1);
      }
    });
    return data;
  }

  strip_out_ud_columns(data) {
    data.columns = data.columns.filter(col => !col.startsWith('ud'));
    return data;
  }

  clean_data_tablename(tablename) {
    // Make the tablename a bit more sane!
    return tablename.replace(/[^A-Za-z0-9@_]/g, '');
  }

  async remove_psuedo_columns(data) {
    if (!data.pseudoColumns) return data;

    // Connect to the DB if needed
    // await this.connect(data);

    // Create variables to send....
    const tableName = data.table;
    const co = data.Co;

    const request = await this.db.request();
    request.input('Co', co);
    request.input('TableName', tableName);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetPsuedoColumns');

    // REMOVE these row.Names from the array!!!!
    result.recordset.forEach(row => {
      const idx = data.columns.indexOf(row.Name);
      if (idx !== -1) {
        data.columns.splice(idx, 1);
      }
    });

    return data;
  }

  remove_attachment_columns(data) {
    const d1Idx = data.columns.indexOf('AttachmentData');
    if (d1Idx !== -1) data.columns.splice(d1Idx, 1);

    const d2Idx = data.columns.indexOf('AttachmentFileType');
    if (d2Idx !== -1) data.columns.splice(d2Idx, 1);

    return data;
  }

  async get_updated_data(data) {
    this.VPUSERNAME = data.VPUserName;

    // INPUT parameters
    const username = data.VPUserName;
    const pluginName = data.pluginName;
    const table = data.table;
    const co = data.Co;
    const colNameCompany = data.colNameCompany;
    let colNameActiveYN = data.colNameActiveYN;
    if (colNameActiveYN === '') colNameActiveYN = null;
    let colNameCustom1 = data.colNameCustom1;
    if (colNameCustom1 === '') colNameCustom1 = null;
    let colValueCustom1 = data.colValueCustom1;
    if (colValueCustom1 === '') colValueCustom1 = null;
    const colNameAge = data.colNameAge;
    const colValueAge = +data.colValueAge;
    const lastSyncedVersion = +data.lastSyncedVersion;
    const columns = data.columns.join(',');

    // OUTPUT parameters
    let primarykeys = '';
    let colDataTypes = '';

    // Connect to the DB if needed
    // await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('pluginName', pluginName);
    request.input('table', table);
    request.input('co', co);
    request.input('colNameCompany', colNameCompany);
    request.input('colNameActiveYN', colNameActiveYN);
    request.input('colNameCustom1', colNameCustom1);
    request.input('colValueCustom1', colValueCustom1);
    request.input('colNameAge', colNameAge);
    request.input('colValueAge', colValueAge);
    request.input('last_synced_version', lastSyncedVersion);
    request.input('columns', columns);
    request.output('colDataTypes', colDataTypes);
    request.output('primarykeys', primarykeys);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetUpdatedDataV2_1');

    const rcode = parseInt(result.output.rcode, 10);
    const outMsg = result.output.ReturnMessage;

    if (rcode === 2) {
      return {
        columns: columns.split(',').filter((c) => c),
        colDataTypes: [],
        primary_keys: result.output.primarykeys.split(',').filter(c => c),
        saved: [],
        deleted: [],
        message: outMsg,
        type: 'empty',
        table: data.table,
        version: lastSyncedVersion
      };
    } else if (rcode !== 0) {
      throw new Error(outMsg);
    }


    const saved = [];
    const deleted = [];
    const tempSavedArray = [];

    let arColumns;
    if (result.recordset.length > 0) {
      arColumns = Object.keys(result.recordset[0]).filter(k => k !== '_CTA_').sort();
    } else {
      arColumns = columns.split(',').filter(c => c);
    }

    // Process recordset
    result.recordset.forEach(arr => {
      const record = { ...arr };
      delete record._CTA_;
      if (arr._CTA_ === 'I' || arr._CTA_ === 'U') {
        saved.push(arColumns.map(k => record[k]));
        tempSavedArray.push(record);
      } else if (arr._CTA_ === 'D') {
        deleted.push(arColumns.map(k => record[k]));
      }
    });

    // Set sync type
    const type = data.lastSyncedVersion === 0 ? 'full' : 'partial';

    const arToReturn = {
      columns: arColumns,
      colDataTypes: result.output.colDataTypes.split(',').filter(c => c),
      primary_keys: result.output.primarykeys.split(',').filter(c => c),
      saved: saved,
      deleted: deleted,
      message: outMsg,
      type: (saved.length === 0 && deleted.length === 0) ? 'empty' : type,
      version: lastSyncedVersion,
    };

    // Get attachments if tablename is right!
    if (table === 'bPREH' || table === 'bINLM') {
      await this.get_avatars(data, arToReturn);
    }

    return arToReturn;
  }

  // Placeholder for transform_container_into_psuedo_columns
  transform_container_into_psuedo_columns(data, updatedData) {
    // TODO: Implement transform_container_into_psuedo_columns as per PHP logic
    // This involves complex transformation of pseudo columns into container values
    return updatedData;
  }

  async get_sync_in(data) {
    this.VPUSERNAME = data.VPUserName;

    // Clean TABLE name and other stuff
    data = this.clean_data_in(data);

    // Requesting psuedo columns?
    data = await this.remove_psuedo_columns(data);

    // Requesting attachment columns
    data = this.remove_attachment_columns(data);

    const updatedData = await this.get_updated_data(data);

    // Transform pseudo column container value into the columns
    const transformedData = this.transform_container_into_psuedo_columns(data, updatedData);

    return {
      type: transformedData.type,
      version: transformedData.version,
      columns: transformedData.columns,
      colDataTypes: transformedData.colDataTypes,
      primaryKey: transformedData.primary_keys,
      saved: transformedData.saved,
      deleted: transformedData.deleted,
      message: transformedData.message,
      table: data.table,
      VPUserName: data.VPUserName
    };
  }

  async get_user_data(data) {
    this.VPUSERNAME = data.VPUserName;

    const username = data.VPUserName;

    await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetUserData');

    if (result.output.rcode === 1) {
      throw new Error(result.output.ReturnMessage);
    }

    const outputs = result.recordset;
    if (!outputs) return { user: outputs, message: result.output.ReturnMessage };

    outputs[0]['SecurityGroups'] = outputs[0]['SecurityGroups'].split(',').map(Number);
    return { user: outputs, message: result.output.ReturnMessage };
  }

  async get_company_data(data) {
    await this.connect(data);

    const request = await this.db.request();
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetCompanyData');

    if (result.output.rcode === 1) {
      throw new Error(result.output.ReturnMessage);
    }

    return { companies: result.recordset, message: result.output.ReturnMessage };
  }

  async get_plugins_settings(data, updatedData, codata) {
    if (!data.pluginsSettings) return updatedData;

    let co;
    if (data.Co) {
      co = data.Co;
    } else if (data.CO) {
      co = data.CO;
    } else {
      co = codata.companies[0].HQCo;
    }

    const username = data.VPUserName;
    const plugins = data.pluginsSettings.join(',');

    await this.connect(data);

    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('co', co);
    request.input('plugins', plugins);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetPluginsSettings');

    if (result.output.rcode === 1) {
      throw new Error(result.output.ReturnMessage);
    }

    const outputs = {};
    result.recordset.forEach(row => {
      if (!outputs[row.PluginName]) {
        outputs[row.PluginName] = [];
      }
      outputs[row.PluginName].push(row);
    });

    updatedData.settingsForPlugins = outputs;

    return updatedData;
  }

  get_key_fields_for_table(table_name) {
    const mappings = {
      'bEMEM': { primary: 'EMCo', secondary: 'Equipment' },
      'bPREH': { primary: 'PRCo', secondary: 'Employee' },
      'bINLM': { primary: 'INCo', secondary: 'Loc' }
    };
    return mappings[table_name] || { primary: 'xxxx', secondary: 'xxxx' };
  }

  async get_avatars(data, sending) {
    if (sending.saved.length === 0) {
      sending.columns.push('AttachmentData');
      sending.columns.push('AttachmentFileType');
      return;
    }

    const key_fields = this.get_key_fields_for_table(data.table);
    const primary_key_field = key_fields.primary;
    const secondary_key_field = key_fields.secondary;

    const primary_key_index = sending.columns.indexOf(primary_key_field);
    const secondary_key_index = sending.columns.indexOf(secondary_key_field);

    if (primary_key_index === -1 || secondary_key_index === -1) {
      throw new Error(`Required key field '${primary_key_field}' or '${secondary_key_field}' not found in column list for table '${data.table}'!`);
    }

    const secondary_keys = sending.saved.map(row => row[secondary_key_index].toString().replace(/,/g, '---'));
    const secondary_keys_string = secondary_keys.join(',');

    const table_name = data.table;
    const company_code = sending.saved[0][primary_key_index];

    // await this.connect(data);
    const request = await this.db.request();
    request.input('tableName', table_name);
    request.input('co', company_code);
    request.input('k2MultiValue', secondary_keys_string);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGetAvatars');

    sending.columns.push('AttachmentData');
    sending.columns.push('AttachmentFileType');
    const attachment_data_index = sending.columns.indexOf('AttachmentData');
    const attachment_file_type_index = sending.columns.indexOf('AttachmentFileType');

    sending.saved.forEach(row => {
      row.push(null);
      row.push(null);
    });

    const record_map = {};
    sending.saved.forEach((row, index) => {
      const key = `${row[primary_key_index]}|${row[secondary_key_index]}`;
      record_map[key] = index;
    });

    result.recordset.forEach(attachment => {
      const attachment_key = `${attachment.k1}|${attachment.k2}`;
      if (record_map.hasOwnProperty(attachment_key)) {
        const matching_row_index = record_map[attachment_key];
        sending.saved[matching_row_index][attachment_data_index] = attachment.AttachmentData ? attachment.AttachmentData.toString('hex') : null;
        sending.saved[matching_row_index][attachment_file_type_index] = attachment.AttachmentFileType;
      }
    });
  }

  async sync_out(data) {
    if (data.headerRows.length === 0) return true;

    // Transform $data into usable values
    const username = data.VPUserName;
    const pluginName = data.pluginName;
    const co = data.CO || 1;
    const syncType = data.syncType;
    const headerTableName = data.headerTableInfo.tableName;
    const headerColsItemLen = Math.max(...data.headerTableInfo.columns.map(col => col.length));
    const headerColsList = this.array_to_fixed_len_string(data.headerTableInfo.columns, headerColsItemLen);
    const headerLockCol = data.headerTableInfo.locking?.column || '';
    const headerLockEditLvl = data.headerTableInfo.locking?.editLevel || '';
    const headerKeysItemLen = Math.max(...data.headerKeys.map(key => key.length));
    const headerKeysList = this.array_to_fixed_len_string(data.headerKeys, headerKeysItemLen);
    const headerRows = this.cols_and_data_rows_to_xml(data.headerTableInfo.columns, data.headerRows);
    const detailTableName = data.detailTableInfo?.tableName || '';
    const detailColsItemLen = data.detailTableInfo ? Math.max(...data.detailTableInfo.columns.map(col => col.length)) : 0;
    const detailColsList = data.detailTableInfo ? this.array_to_fixed_len_string(data.detailTableInfo.columns, detailColsItemLen) : '';
    const detailRows = data.detailTableInfo ? this.cols_and_data_rows_to_xml(data.detailTableInfo.columns, data.detailRows) : '';
    const ignoreDuplicates = data.headerTableInfo.ignoreDuplicates ? 1 : 0;

    // Connect if we need to
    // await this.connect(data);

    // Prepare SQL statement
    const request = await this.db.request();
    request.input('originalUser', username);
    request.input('pluginName', pluginName);
    request.input('co', co);
    request.input('syncType', syncType);
    request.input('headerTableName', headerTableName);
    request.input('headerColsItemLen', headerColsItemLen);
    request.input('headerColsList', headerColsList);
    request.input('headerLockCol', headerLockCol);
    request.input('headerLockEditLvl', headerLockEditLvl);
    request.input('headerKeysItemLen', headerKeysItemLen);
    request.input('headerKeysList', headerKeysList);
    request.input('headerRows', headerRows);
    request.input('detailTableName', detailTableName);
    request.input('detailColsItemLen', detailColsItemLen);
    request.input('detailColsList', detailColsList);
    request.input('detailRows', detailRows);
    request.input('ignoreDuplicates', ignoreDuplicates);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    try {
      const result = await request.execute('mmspSyncDataFromClientV2_2');

      const rcode = parseInt(result.output.rcode, 10);
      const out_msg = result.output.ReturnMessage;

      if (rcode === 1) {
        throw new Error(out_msg);
      }
    } catch (err) {
      console.error('Error in sync_out:', err);
      throw err;
    }
  }

  array_to_fixed_len_string(arr, len) {
    return arr.map(item => item.padEnd(len, ' ')).join('');
  }

  cols_and_data_rows_to_xml(columns, rows) {
    if (rows.length < 1) return '<Root> </Root>';

    let ret = '<Root>';

    for (const row of rows) {
      ret += '<Row';

      columns.forEach((colName, i) => {
        const val = this.escapeHtml(row[i]);
        ret += ` ${colName}="${val}"`;
      });

      ret += ' />';
    }

    return ret + '</Root>';
  }

  escapeHtml(text) {
    if (text == null) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  async get_login(data) {
    if (data.VPUserName.indexOf('\\') === -1) {
      data.VPUserName = this.USER_DOMAIN + data.VPUserName;
    }

    this.VPUSERNAME = data.VPUserName;

    const codata = await this.get_company_data(data);
    const user = await this.get_user_data(data);
    const updatedUser = await this.get_plugins_settings(data, user, codata);

    return {
      message: updatedUser.message,
      user: updatedUser.user[0],
      companies: codata.companies,
      VPUserName: data.VPUserName,
      settings: updatedUser.settingsForPlugins,
    };
  }

  async get_ssrs_report(data) {
    // TODO: Implement SSRS report logic
    // For now, return a message or URL
    return { message: 'SSRS report placeholder' };
  }

  async create_cached_set(data) {
    // TODO: Implement creating cached set for SQLite
    // Receives path, filename, etc.
    // For now, just acknowledge
    return { message: 'Cached set created' };
  }

  async put(data) {
    return await this.sync_out(data);
  }

  async post(data) {
    return await this.sync_out(data);
  }

  async logSync(userAgent, data, direction, status, errorFlag, errorMsg, successFlag) {
    // TODO: Log to DB or file
    console.log(`LogSync: ${direction}, status: ${status}, error: ${errorMsg}`);
    // Perhaps call a SP for logging
  }
}

module.exports = API;
