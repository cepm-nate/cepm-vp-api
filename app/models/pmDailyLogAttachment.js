const MssqlConnection = require('../db/mssql');
const fs = require('fs');
const path = require('path');
const os = require('os');
const SMB2 = require('smb2'); // Assuming smb2 package is installed

class PMDailyLogAttachment {
  constructor() {
    this.USER_DOMAIN = "CORP\\";
    this.db = new MssqlConnection();
  }

  async connect(data) {
    if (data.mm_version && parseFloat(data.mm_version.replace('.', '')) < 22054) {
      throw new Error('Your version is out of date. Install update, then tap "Status" -> "Settings" -> RED BUTTON. Thank you.');
    }

    const password = data.Password || data.PASSWORD;
    const username = decodeURIComponent(data.VPUserName);
    const isBeta = data.isBeta === true;

    await this.db.connect(username, password, isBeta);
  }

  async post(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      return { error: 'Invalid JSON data!', num_code: 304 };
    }

    // Connect
    await this.connect(parsedData);

    // Save to SMB
    parsedData = await this.save_attachment_to_smb(parsedData);

    // Save to DB
    return await this.save_attachment_to_db(parsedData);
  }

  async getForOneDailyLog(data) {
    if (!data || data === '') {
      return { error: 'No Data Sent!', num_code: 303 };
    }

    await this.connect(data);
    return await this.get_attachments(data);
  }

  async save_attachment_to_smb(data) {
    const buffer = Buffer.from(data.data, 'base64');
    const tempFile = path.join(os.tmpdir(), `att_${Date.now()}.tmp`);
    fs.writeFileSync(tempFile, buffer);

    const tmpname = `${Date.now()}_${Math.random()}.tmp`;

    const smb2Client = new SMB2({
      share: '\\\\DB1.corp.cepm.biz\\tmp_attachments',
      domain: 'corp.cepm.biz',
      username: 'attachment_writer',
      password: 'somenotverysecretpassword'
    });

    await new Promise((resolve, reject) => {
      smb2Client.writeFile(tmpname, fs.readFileSync(tempFile), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    fs.unlinkSync(tempFile);
    data.TempFileName = tmpname;
    return data;
  }

  async save_attachment_to_db(data) {
    const request = await this.db.request();

    const params = {
      PMCo: data.PMCo,
      Project: data.Project,
      LogDate: new Date(data.LogDate).toISOString().slice(0, 19).replace('T', ' '),
      Description: data.Description,
      AddDate: new Date(data.AddDate).toISOString().slice(0, 19).replace('T', ' '),
      OriginalUser: data.AddedBy,
      OrigFileName: data.OrigFileName,
      TempFileName: data.TempFileName,
      AttachFileType: `.${data.type.split('/')[1]}`,
      UniqueAttchID: data.UniqueAttchID,
      AttachmentID: data.AttachmentID
    };

    request.input('PMCo', params.PMCo);
    request.input('Project', params.Project);
    request.input('LogDate', params.LogDate);
    request.input('Description', params.Description);
    request.input('AddDate', params.AddDate);
    request.input('OriginalUser', params.OriginalUser);
    request.input('OrigFileName', params.OrigFileName);
    request.input('TempFileName', params.TempFileName);
    request.input('AttachFileType', params.AttachFileType);
    request.input('UniqueAttchID', params.UniqueAttchID || null);
    request.input('AttachmentID', params.AttachmentID || null);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspUpsertDLAttachment');

    const rcode = result.output.rcode;
    const out_msg = result.output.ReturnMessage;

    if (rcode === 1) {
      throw new Error(out_msg);
    }

    return {
      sent: {
        UniqueAttchID: data.UniqueAttchID,
        AttachmentID: data.AttachmentID,
      },
      onServer: {
        UniqueAttchID: result.output.UniqueAttchID || params.UniqueAttchID,
        AttachmentID: result.output.AttachmentID || params.AttachmentID,
      },
      message: out_msg
    };
  }

  async get_attachments(data) {
    const request = await this.db.request();

    request.input('PMCo', data.pmco);
    request.input('Project', data.project);
    request.input('LogDate', data.logdate);
    request.output('rcode', 0);
    request.output('ReturnMessage', '');

    const result = await request.execute('mmspGatherDLAttachments');

    const rcode = result.output.rcode;
    const out_msg = result.output.ReturnMessage;

    if (rcode === 1) {
      throw new Error(out_msg);
    }

    const attachments = result.recordset.map(row => {
      let attachmentData = '';
      for (let i = 1; i <= 25; i++) {
        attachmentData += row[`AttachmentData${i}`] || '';
      }
      return {
        ...row,
        AttachmentData: Buffer.from(attachmentData).toString('base64')
      };
    });

    // Remove individual parts
    attachments.forEach(att => {
      for (let i = 1; i <= 25; i++) {
        delete att[`AttachmentData${i}`];
      }
    });

    return {
      attachments,
      message: 'Success'
    };
  }
}

module.exports = PMDailyLogAttachment;
