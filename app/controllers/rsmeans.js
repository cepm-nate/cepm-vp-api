const { poolPromise, sql } 	= require('../connectors/db');
const values 			    = require('object.values');
const fetch			        = require('node-fetch'); // V2
const plumbCache            = require('../cache/plumb.json');
const mechCache            = require('../cache/mech.json');
/* Hardcoded cookies removed - now passed via constructor */
// ======================================================================================
// These global vars can be multiple lines (for easy copy/paste), as I TRIM them later.

const COOKIE = `

rsmo_session=2jvta2u5tap4jrpj4ei5wty0; OptanonAlertBoxClosed=2026-04-17T20:06:33.501Z; __RequestVerificationToken=tmCO56JOhbwFiLyEnzKyvj19sThbmYFZrs_6Y9yHx9DBB74Bu3_h0kG6sI6Cs57KvWfi0xRIdRJCtJOdeShCYCDzfxc1; OptanonConsent=isGpcEnabled=0&datestamp=Tue+Apr+21+2026+12%3A45%3A36+GMT-0700+(Pacific+Daylight+Time)&version=202602.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=1225efb5-c1da-436d-b0bb-9e9712c02105&interactionCount=2&isAnonUser=1&prevHadToken=0&landingPath=NotLandingPage&groups=C0004%3A1%2CC0001%3A1%2CC0002%3A1&crTime=1776456393769&intType=3&geolocation=US%3BWA&AwaitingReconsent=false; .AspNet.Cookies=u4kMan_eSNpo-W1xvIFnUiL77tIMHSB2o8sup3OVZakhafVbzWZuiVaGkseXpw5xtBjf6_7PljpfbwCcZchf2tI_X8Df-YqP7eEqxvVuRZK15h1jY3NKrBanJvQZyGjpyK266f-Q3K7O9TJlRi_DAZ_yD2yiFc2YOrdVzJdjBozdCQ7em-Rv4ZWS8ixXuhl4aXQxJLeN4mCGkGJvd4QOqFktyU1BgMJNcTtTg2H2gAgRFITutloXB3WZ6koG0LrdgO3jn1BRPUiwDyvIM0BUK6gM7pp69JNylk4urnjx6o9l5clRJADJVnTMJRUo25ZxXG2A7TaEYDa4AMXmVIWM8-8PO3r9OCgunguWefDVJ9NCplIn-YGwjQ4UU3-JcLwbniuC1P5AGqFCj14ycy-Ccjc8tjin6S3l82isc_8N-5AX5YVGv_hhScwvDZacYATTRDk1FCvVpLY1wo5BJj1ekD_jLkY5iN1-K7md2ZBxz99XzJ8r9JU_R1OdNFyC_VkVd75NxdKJw5E0WGh_TzeEjkTepNrMyfeqrhMRzghjTCvNhfESZLgzrzDiVMXklpBBjC1uy8mfW1Sk13iUbwkYBQjSihOc628KpSJVQthWUIRPfzdsKokyFK9SfqVq6XI62d8byKB0OYJi2GO_sA0ipp83XXd1QVcVSsoOrvF1BA9-eFk_UJqECyH57FSWScAP1Oi4I_6DE7MjievqUY-psPuKVhMUBKzj5NOW9ARhXwaedCRHiFEx5VekYRhwNV8F8PNkPO_X5OU05uhvak6Jp9XVt5CiK50V9zQiOQ_Avc8Gq5EcmhSScM_C77l_OTuS4h3W17BtJAXttoE2w4nIwvYM4auH85ZYciWNRnQSLLgUldRpQdIBO7_bg_4mUGvh1kna9UYXUjGC56C1y2XCXr-u2ZUrO8-CNcaHjPpDjzUXkVQCq7T2I2HECV7oOgogUwKVhQqm9UiKcJAHbde6yQUgpg_r8baJ4C6Ap6tO_-fc7us6YuC-jZK_IRM3NMejTxFuULBuvvJVEI10sn_eXaMvp-ZfSUqXqPxGPK_s46YH_KVbHsDbrDHAtoV77OVa8rrYcgchIRrQtGkAVBHb7h6t1hssS4T8PYIlqCs9HDq8jqIYXbkE29TMt4JKxLWwhBhCeCgcZzqrjouemQrXQYe-weQdRu4WYNYJkgTculYz9r33MZFTa1JEzv2Flfru6-OsCRl8xxYK-ReWXXXO6MrTHo7lxQ4YpKttcD_yQO3IPujJN7W0VBctTtGAFKqBhRN3oSl1meWNM7gVvC-jU-xN_8kAiyewPPo6oeHLpWfLW4uELUBdQ1lcNw8rRYlYb6L7-XoOCT2taebY0gMohPi4rQICNiRRRlLwTY4CFTj98gh0oJ6PHfTUIfzaYzM_uUKygaSK_WoDtKZaQRvtEwoag3x0KsHf86TCA2AOFYwnTnFIpTlAwhqKDLeisRwOVKAamo3c0g3-7LyOFDXuuM47RnKj1srf0OglEQb8hwNvrmczg2nU52ZuoZE8yzwdKLaOgG6Gm_dtxON2eaenrlJfukqFaqjCBP5t4VEcqV93dO2yNPQENMGgQFrn8orK-HNOkryno7xUXtj62xs-GEeAyMJvDGZ2vG2p03_FQhU9t786DdTwa-FqYimEcByLumkUIHwWkOhf7NzN7MXtjVfnv03OG4crXcjflvjO2mDds3Y5DLWkLjDkncntWpFfm_jBaVlmtCDH3jZCLgZ8DbxyCc5BL_qNsiVyrzJaPnZ3S1GN5f-LspRVMhKFacIyoq2GHpYrvL7ceiH8Xza0Sy0nXYy1fKVzJG1z4Ga1YrYLQs29GAkpyZzTdWWD9daIxY3hMppm0bJBUnJDrLMw5v4QWlTJJM2P2rWj0Ky_VNNjG2BS49-uAS7VJH4cLk508C5uX6jH31gCX-I2RhtHF-yL6-O7ViSOcG-m_kDVedkhsvERoyKzFmDY3D7lA-Cqg0zD-BRDlUNhnH7rTZIe7I2CMQeCo6s1kcGooTW3k_lElYJQSjsIIGqLdX5A7jqvxXcAVxNGQxHL_W0ueYXqDLAQ0j2D_qv_Ewo_P9Pb_a1IQOdl4tHApFvAkyuPbalgbYoEOJ_cMXJHLqvjEE3CJO0-zIy8QOtVuvMP79CLHaFiYfUTDh95Huu_m2rkxa7KkkeBQwLytkX9qgutaYi5GnrGO_dJ_wVime7VjkPmy8GuTEWosVTBdv9V0T4TQ4sWyBze9dNK9s8cDhjI6ITibWftQ32lKk8QtF-DIb_nVkxOFQJCGldGRLwK2Ct6idqXx0h0IOcJzeu_5NXglAce7uukK7EFJmmYShQIgdlC5C8fylaOfCDP0ZHEUQ0b4UOCxyJscUicxeucUiGhAkAroa9caSpTE-IqjNGEhrJGEQy1hXBF8npofbYvyiwwKLToBX0y6eFYu1-EkpeJhwtFgk_GXHc

`;

const VALIDATION_TOKEN = `

7RhFFSsLjy9tKkgLUgfjFSLsh-fThHQCUSl0vE2eCHz9SvPhZi28UQrSLCm4k0x5ya9ZLdOupNftlzVgihI2RC97fuM1,uamWOEkfgf8IdkUsaUaAntsIIkaxBsOOM-gaE5pVXF77LvPdqveL2QVJyxoeYZhCB-MkyCtGerwiHcTjYqibOF7aqkOxjMHCLd3gllgtrkd-QnAojDN3AY6d7XSULRCWLQGTMA2

`;
// ======================================================================================




module.exports = class RSMeans {

  year = '2026';

  dataRelease = `Year+${this.year}`;

  dataReleaseId = '95';

  uri = 'https://www.rsmeansonline.com/SearchData/LoadGridWithCriteria';

  mCostDataOb = {
    CostData: '.....Mechanical',
    CostDataId: 26
  };

  pCostDataOb = {
    CostData: '.....Plumbing',
    CostDataId: 27
  };

  mDivCodes = [
    '01', '02', '03', '04', '05', '06', '07', '09', '10',
    '11', '13', '14', '22', '23', '26',
    '28', '31', '32', '33', '44', '46',
  ];

  pDivCodes = [
    '01', '02', '03', '05', '06', '07', '09', '10',
    '11', '12', '13', '14', '21', '22', '23', '26',
    '28', '31', '32', '33', '41', '44', '46',
  ];

  choiceOb = this.mCostDataOb; // swap mCostDataOb and pCostDataOb

  divCodes = this.mDivCodes;

  indentTagMap = {
    ind1: ' ',
    ind2: '  ',
    ind3: '   ',
    ind4: '    ',
    ind5: '     ',
    ind6: '      ',
    ind7: '       ',
  };

  cellMap = [
    // each IDX reduced by two for 2023 data.
    { idx: 1, name: 'RSMeansId' },
    { idx: 7, name: 'Description' },
    { idx: 8, name: 'LaborUM' },
    { idx: 9, name: 'Crew' },
    { idx: 10, name: 'DailyOutput' },
    { idx: 12, name: 'LaborHours' },
    { idx: 13, name: 'Material' },
    { idx: 16, name: 'BareCostsLabor' },
    { idx: 17, name: 'BareCostsEq' },
    { idx: 18, name: 'Total' },
    { idx: 21, name: 'TotalPlusOnP' },
    { idx: 32, name: 'ShortDesc', idxWithTags: 6 },
    { idx: 33, name: 'HourlyOpCost' },
    { idx: 34, name: 'RentPerDay' },
    { idx: 35, name: 'RentPerWeek' },
    { idx: 36, name: 'RentPerMonth' },
  ];

  // just useful as reference.
  rowHdr = [
      // false,              // [0]  // 'star',      -- no longer present in 2023!
      // false,              // [1]  // 'lightning',  -- no longer present in 2023!
      false,              // [2]  // 'blank1',
      'RSMeansId',        // [3]
      false,              // [4]  // 'blank2',
      false,              // [5]  // 'leaf',
      false,              // [6]  // 'blank3',
      false,              // [7]  // 'pencil',
      false,              // [8]  // 'shortDescWithTags',     // but is useful to get indent level!!
      false,              // [9]  // 'fullDesc',
      'LaborUM',          // [10] // 'unit'
      'Crew',             // [11]
      'DailyOutput',      // [12]
      false,              // [13] // 'blank4',
      'LaborHours',       // [14]
      'Material',         // [15] // Bare Material
      false,              // [16] // 'blank5',       // has something, but does not match in visible table
      false,              // [17] // 'blank6',
      'BareCostsLabor',   // [18] // 'Bare Labor',
      'BareCostsEq',      // [19] // Bare Costs Equipment
      'Total',            // [20] // 'bareTotal',
      false,              // [21] // 'blank7',
      false,              // [22] // 'blank8',
      'TotalPlusOnP',     // [23] // 'totalO&P',
      false,              // [24] // 'refPDF',
      false,              // [25] // 'blank9',
      false,              // [26] // 'blank10',
      false,              // [27] // 'blank11',      // "Q" ?
      false,              // [28] // 'blank12',      // "false"
      false,              // [29] // 'blank13',      // 015433400070 // possibly internal ref numbers for rental equipment
      false,              // [30] // 'blank14',      // 015904000070
      false,              // [31] // 'blank15',      // "0"
      false,              // [32] // 'blank16',      // "0"
      false,              // [33] // 'blank17',
      'Description',      // [34] // Like [8] but no HTML tags
      'HourlyOpCost',     // [35] // Hourly Op. Cost
      'RentPerDay',       // [36]
      'RentPerWeek',      // [37]
      'RentPerMonth',     // [38]
      false,              // [39] // Looks like about HALF a day plus extra? Not shown on grid.
  ]

  constructor(options = {}) {
    this.cookie = options.cookie || '';
    this.validationToken = options.validationToken || '';
    this.year = options.year || this.year;
    this.dataReleaseId = options.dataReleaseId || this.dataReleaseId;
    this.onLog = options.onLog || function() { console.log.apply(console, arguments); };
    this.start = 0;
    this.type = options.type || 'Mechanical';
    this.choiceOb = this.type === 'Plumbing' ? this.pCostDataOb : this.mCostDataOb;
    this.divCodes = this.type === 'Plumbing' ? this.pDivCodes : this.mDivCodes;
    this.quarter = options.quarter || '4';
    this.dataRelease = `Year+${this.year}+Quarter+${this.quarter}`;

    // Initialize headers here, after options are set
    this.headers = {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "pragma": "no-cache",
      "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"141\", \"Chromium\";v=\"141\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "validationtoken": this.validationToken,
      "x-requested-with": "XMLHttpRequest",
      "cookie": this.cookie,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Iron Safari/537.36",
      "Host": 'www.rsmeansonline.com',
      "Origin": 'https://www.rsmeansonline.com',
      "Referer": 'https://www.rsmeansonline.com/SearchData'
    };

    // Initialize bodyArgs here, after dataRelease is set
    this.bodyArgs = {
      LaborId: 'STD',
      DataTypeId: '1',
      CostData: this.choiceOb.CostData,
      CostDataId: this.choiceOb.CostDataId,
      DataReleaseId: this.dataReleaseId,
      DataFormatCode: 'MF04',
      Keywords: '',
      DivisionCode: '01',
      'Location.CityName': 'National+Average',
      MeasurementType: 'US Standard',
      SetCustomCostData: 'false',
      DataType: 'Unit',
      LaborType: 'Standard+Union',
      DataRelease: this.dataRelease,  // Now uses the correct value
      DataFormatName: 'MasterFormat+2018',
      CCILocation: 'National+Average',
      CountryCode: 'NA',
      'Location.CityId': '431',
      SearchCriteria: 'index',
      SearchTerm: '',
      _search: 'false',
      rows: 200,
      page: 1,
      sidx: 'CostLineId',
      sord: 'asc',
    };
  }

  async obtainAndImport() {
    // This is our main function which calls each step and logs results.
    console.log('obtainAndImport start');

    try {
      let allRows = await this._recursiveFetchAndSave(this.choiceOb, this.divCodes, 1, 1, []);

      // let allRows = await this._upsertIntoSQL(this._siteObToJSON(mechCache));
      // let allRows = await this._upsertIntoSQL(this._siteObToJSON(plumbCache));

      return allRows;
    } catch (e) {
      this.onLog(e.message, "error");
      console.error(e.message); // Also log to server console for full details
      return 'Fail!!';
    }

  }

  _recursiveFetchAndSave(CostDataOb, divCodes, divIdx, pageNum, allRows) {
    // Global var to track total pages for this CostDataOb
    let totalPages;

    let msg = `Fetching page ${pageNum} for ${CostDataOb.CostData} div ${divCodes[divIdx]}`;
    console.log(msg);
    this.onLog(msg, "info");

    return this._fetchFromSite(CostDataOb, divCodes[divIdx], pageNum)
    .then((fetch_result) => {
      totalPages = fetch_result.total;
      let msg = `... retrieved ${fetch_result.rows.length} rows, total of ${totalPages} pages.`;
      console.log(msg);
      this.onLog(msg, "info");
      allRows = [
        ...allRows,
        ...fetch_result.rows,
      ];
      return this._upsertIntoSQL(this._siteObToJSON(fetch_result))
    })
    .then(() => {
      // Here is the recursive part -- not last page? increment and call again.
      if (totalPages > pageNum) return this._recursiveFetchAndSave(CostDataOb, divCodes, divIdx, pageNum + 1, allRows);
      // Last page, but not last divison? increment division and reset page to 1, call again.
      else if (divCodes.length - 1 > divIdx) return this._recursiveFetchAndSave(CostDataOb, divCodes, divIdx + 1, 1, allRows);
      // No more pages or divisions?
      else return allRows;
    })
  }

  async _fetchFromSite(CostDataOb, DivisionCode, page) {
    const bodyArgs = {
        ...this.bodyArgs,
        nd: Date.now(),
        page,
        DivisionCode,
        ...CostDataOb,
    };
    const constructedBody = this._constructBody(bodyArgs);

    // // Log the full request details before sending
    // console.log('RSMeans Request Details:');
    // console.log('URL:', this.uri);
    // console.log('Headers:', JSON.stringify(this.headers, null, 2));
    // console.log('Body:', constructedBody);

    const r = await fetch(this.uri, {
      headers: this.headers,
      body: constructedBody,
      method: 'POST',
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      // Depend on parent functions to catch and log error
      throw new Error(e.message);
    }
  }

  _siteObToJSON(siteOb) {
      let rows = siteOb.rows;
      if (!rows) rows = siteOb;
      if (!rows || rows.length === 0) return [];
      const r1 = rows[0].cell;
      if (r1.length !== this.rowHdr.length) {
          console.error('Headers and cells do not match!!');
          console.warn(r1);
          throw new Error('Headers and cells do not match!!');
      }
      return rows.map((r) => {
          const o = {};
          this.cellMap.forEach((cm) => {
              if (cm.name === 'RSMeansId') {
                  o[cm.name] = this._createFormattedRSMeansId(r.cell[cm.idx]);
              } else if (cm.idxWithTags) {
                  // This is the description row
                  o[cm.name] = this._createIndentedDescription(r,cm);
              } else {
                  // This is a normal field
                  o[cm.name] = r.cell[cm.idx] === '' ? null : this._createFormattedValue(r.cell[cm.idx]);
              }
          })
          return o;
      })
  }

  _createFormattedValue(val) {
      // if there is a '%', then we try removing it and parseFloat the result. If that fails, we return the original
      if (val.indexOf('%') > -1) {
          // If we remove it, can the result be parsed to a float?
          const f = parseFloat(val);
          return isNaN(f) ? val : f / 100; // to handle percentages!!
      } else {
          // return whatever was given
          return val;
      }
  }

  _createIndentedDescription(rowOb, cellMapLine) {
      // rowOb has { cell: ['x', 'z', 'zooolooo', '1231234']}
      // cellMapLine has .idx, .idxWithTags, .name
      // console.log(rowOb.cell[cellMapLine.idxWithTags].indexOf('<div class='), rowOb.cell[cellMapLine.idxWithTags] );
      if (rowOb.cell[cellMapLine.idxWithTags].indexOf('<div class=') === 0) {
          // console.log(rowOb.cell[cellMapLine.idxWithTags].split("'"));
          const className = rowOb.cell[cellMapLine.idxWithTags].split("'")[1];
          if (!className) return rowOb.cell[cellMapLine.idx];
          if (!this.indentTagMap[className]) return rowOb.cell[cellMapLine.idx];
          return `${this.indentTagMap[className]}${rowOb.cell[cellMapLine.idx]}`;
      }
      return rowOb.cell[cellMapLine.idx];
  }

  _createFormattedRSMeansId(rsmeans) {
      // input  [221423337000]
      // output [01 31 13.80 0150]
      return [
          rsmeans.slice(0,2),
          ' ',
          rsmeans.slice(2,4),
          ' ',
          rsmeans.slice(4,6),
          '.',
          rsmeans.slice(6,8),
          ' ',
          rsmeans.slice(8), // the rest
      ].join('');
  }

  _constructBody(ob) {
      return Object.keys(ob).map((k) => `${k}=${ob[k]}`).join('&')
  }

	async _upsertIntoSQL(rows) {
		const pool = await poolPromise;
    return pool.request()
      .input('JCCo', sql.Int, 1)
      .input('Year', sql.Int, parseInt(this.year))
      .input('DataJSON', sql.VarChar(sql.MAX), JSON.stringify(rows))
      .output('ReturnMessage', sql.VarChar(255))
      .execute('mspUpsertJCRSMeansFromJSON');
  };

}
