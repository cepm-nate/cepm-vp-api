const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const API = require('../models/api');

const LocalDB = require('../models/localDB');
const PMDailyLogDetail = require('../models/pmDailyLogDetail');
const PMIssue = require('../models/pmIssue');
const RFI = require('../models/rfi');
const Equipment = require('../models/equipment');
const INAdjustmentBatch = require('../models/inAdjustmentBatch');
const JobPhase = require('../models/jobPhase');
const MO = require('../models/mo');
const MU = require('../models/mu');
const Attachment = require('../models/attachment');
const PhoneGapBuild = require('../models/phoneGapBuild');


const Auth = require('../controllers/auth');
const Emtrx = require('../controllers/emtrx');
const PhyCnts = require('../controllers/phycnts');
const auth = new Auth();
const emtrx = new Emtrx();
const phycnts = new PhyCnts();

// Not used in app
// const CID = require('../models/cid');
// const A1CAL = require('../models/a1cal');
// const TimeLogger = require('../models/timeLogger');
// const Timesheet = require('../models/timesheet');
// const PMDailyLogAttachment = require('../models/pmDailyLogAttachment');

// Phonegap Build Version Info
// AUTHENTICATION
async function checkLogin(req, res) {
  await Promise.all([]);
  if (req.headers["x-uuid"]) {
    return auth
      .check(req)
      .then((res_1) => auth.employeeInfo(res_1.output.PRCo, res_1.output.Employee));
  }
  const userAndPass = {
    username: req.headers.username || req.query.VPUserName,
    password: req.headers.password || req.query.Password,
  };
  return await auth.authenticateHandler(userAndPass);
}

function isAuthenticated(req, res, next) {
  let authMethod = req.headers["x-uuid"]
    ? () => auth.check(req)
    : () => auth.verify(req.headers.token);
  Promise.all([])
    .then(function () {
      return authMethod();
    })
    .catch((e) => {
      // If the first one said ECONNREFUSED, just try it again.
      if (e.message.indexOf("ECONNREFUSED") > -1) {
        console.log("Trying a 2nd time for", req.headers.username, "...");
        return authMethod();
      } else throw e;
    })
    .then((r) => next())
    .catch((e) => {
      console.log(
        "... failed authentication for",
        req.headers.username,
        e.message,
      );
      if (e.response) {
        res.status(e.response.status).json({ message: e.response.data.error });
        console.warn(e.response.data.error);
      } else {
        res.status(500).json({ message: e.message });
      }
    });
}
router.get('/pgbVersion', async (req, res) => {
  try {
    const pgb = new PhoneGapBuild();
    const result = await pgb.get_current_version(req.query);
    res.set('Access-Control-Allow-Origin', '*');
    if (!result || result === '') {
      res.status(404).json({ message: 'Not Found' });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Caller ID getter
// router.get('/cid', async (req, res) => {
//   try {
//     const cid = new CID();
//     const result = await cid.get_phonenumber(req.query);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (!result || result === '') {
//       res.status(404).json({ message: 'Not Found' });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// A1 Calendar Getter
// router.get('/a1cal', async (req, res) => {
//   try {
//     const cal = new A1CAL();
//     const p = await cal.get_feed(req.query);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (p == '') {
//       res.status(404).json({ message: 'Not Found' });
//     } else if (Array.isArray(p)) {
//       res.json({ message: 'error' });
//     } else {
//       res.json(p);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// TEST responder
router.get('/testserver', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ message: 'Server is running' });
});

// Latest PG Build
router.get('/latest_pg_build', async (req, res) => {
  const { pgid } = req.query;
  if (!pgid) {
    return res.status(400).json({ error: 'pgid required' });
  }
  const url = `https://build.phonegap.com/apps/${pgid}/builds`;
  https.get(url, (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Content-Type', 'text/plain');
      res.send(data);
    });
  }).on('error', (error) => {
    res.status(500).json({ error: error.message });
  });
});

// Login Getter
router.get('/login', async (req, res) => {
  try {
    const loginResult = await checkLogin(req, res);
    res.set('Access-Control-Allow-Origin', '*');
    let merged = loginResult;
    const vpUserName = req.headers.username || req.query.VPUserName;
    if (vpUserName) {
      const api = new API();
      const extraData = await api.get_login(req.query);
      merged = { ...loginResult, ...extraData };
    }
    res.send(merged);
  } catch (e) {
    console.warn(e.message);
    if (e.response) res.status(e.response.status).send(e.message);
    else res.status(500).send(e.message);
  }
});

// SSRS Report
router.get('/ssrs_report', isAuthenticated, async (req, res) => {
  try {
    const api = new API();
    const result = await api.get_ssrs_report(req.query);
    // No response in PHP, but assuming similar to others
    res.set('Access-Control-Allow-Origin', '*');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prep for SQLite DB
router.get('/prepForSQLiteDB', isAuthenticated, async (req, res) => {
  try {
    const api = new API();
    const dbPath = path.join(__dirname, '../../mm.db');
    const filename = 'mm.db';
    const result = await api.create_cached_set({ ...req.query, path: dbPath, filename });
    res.set('Access-Control-Allow-Origin', '*');
    res.status(201).json({ message: 'Cached DB Created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SQLite DB Dump
router.get('/getSQLiteDBDump', isAuthenticated, async (req, res) => {
  try {
    const db = new LocalDB();
    const dbPath = path.join(__dirname, '../../mm.db');
    const dumpPath = path.join(__dirname, '../../mm.db.sql');
    const filename = 'mm.db.sql';
    await db.create_dump(dbPath, dumpPath);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'must-revalidate, post-check=0, pre-check=0');
    res.set('Content-Description', 'File Transfer');
    res.type('text/plain');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(dumpPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Local Storage
router.get('/getLocalStorage', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../../localStorage.txt'));
});

// Get Local DB
router.get('/getLocalDB', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../../mm.db'));
});

// SYNC Getter
router.get('/', (req, res) => {
  if (req.query.pluginName) {
    // authenticated behavior
    isAuthenticated(req, res, async () => {
      try {
        const api = new API();
        const userAgent = req.get('User-Agent');
        const result = await api.get_sync_in(req.query);
        res.set('Access-Control-Allow-Origin', '*');
        if (result.error) {
          res.status(result.num_code).json({ message: result.error });
          await api.logSync(userAgent, req.query, 'in', result.num_code, 'Y', result.error, 'Y');
        } else {
          res.json(result);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  } else {
    // test behavior
    console.log("basic test");
    res.json({ message: "Hooray! welcome to our api!" });
  }
});

// PMDailyLogAttachment allForOne - no code in app uses this endpoint.
// router.get('/PMDailyLogAttachment/allForOne', async (req, res) => {
//   try {
//     const attachment = new PMDailyLogAttachment();
//     const result = await attachment.getForOneDailyLog(req.query);
//     res.set('Access-Control-Allow-Origin', '*');
//     res.json(result);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// Timesheet suggestedPhases
// router.get('/Timesheet/suggestedPhases', async (req, res) => {
//   try {
//     const ts = new Timesheet();
//     const result = await ts.getSuggestedPhases(req.query);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (result.error) {
//       res.status(result.num_code).json({ message: result.error });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// Weather proxy
router.get('/weather', async (req, res) => {
  const { zip, date } = req.query;
  if (!zip || !date) {
    return res.status(400).json({ error: 'zip and date required' });
  }

  try {
    // Get coordinates from zip
    const coordUrl = `https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=zip%3D${zip}`;
    const coordResponse = await fetch(coordUrl);
    const coordData = await coordResponse.json();
    if (!coordData.records || coordData.records.length === 0) {
      return res.status(404).json({ error: 'No records for that zip code.' });
    }
    const { latitude, longitude } = coordData.records[0].fields;

    // Get weather
    const weatherUrl = `https://api.darksky.net/forecast/40c4aed2bde6902b452864224f71b4bc/${latitude},${longitude},${Math.floor(new Date(date + ' 11:00').getTime() / 1000)}?exclude=currently,minutely,hourly,alerts,flags`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();
    if (!weatherData.daily) {
      return res.status(500).json({ error: 'Error from weather.' });
    }
    const day = weatherData.daily.data[0];
    const output = {
      summary: day.summary,
      windSummary: `${Math.round(day.windSpeed)} MPH${day.windGust > day.windSpeed ? ` & gusts of ${Math.round(day.windGust)} MPH.` : '.'}`,
      tempHigh: day.temperatureHigh,
      tempLow: day.temperatureLow
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.json(output);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Support Sender
router.put('/', isAuthenticated, async (req, res) => {
  try {
    const api = new API();
    const userAgent = req.get('User-Agent');
    const result = await api.put(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
      await api.logSync(userAgent, req.body, 'out', result.num_code, 'Y', result.error, 'Y');
    } else {
      res.json(result);
      await api.logSync(userAgent, req.body, 'out', 200, 'N', null, 'Y');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Receive Local Storage
router.put('/receiveLocalStorage', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../localStorage.txt');
    fs.writeFileSync(filePath, req.body.LocalStorage);
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ message: 'Just some random data!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IN Phy Count to Adj Batch
router.put('/INPhyCountToAdjBatch', isAuthenticated, async (req, res) => {
  try {
    const api = new API();
    const userAgent = req.get('User-Agent');
    const result = await api.put_inv_worksheet_to_adj(req.body, userAgent);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload SQLite
router.post('/uploadSQLite', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const destPath = path.join(__dirname, '../../mm.db');
    fs.renameSync(req.file.path, destPath);
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ message: 'Cached DB Made?' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic SAVER
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const api = new API();
    const userAgent = req.get('User-Agent');
    const result = await api.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
      await api.logSync(userAgent, req.body, 'out', result.num_code, 'Y', result.error, 'Y');
    } else {
      res.json(result);
      await api.logSync(userAgent, req.body, 'out', 200, 'N', null, 'Y');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// INV Adjustment Batch Save
router.post('/Inventory/AdjustmentBatch', async (req, res) => {
  try {
    const model = new INAdjustmentBatch();
    const result = await model.post_adjustment(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MO
router.post('/MO', async (req, res) => {
  try {
    const mo = new MO();
    const result = await mo.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MU
router.post('/MU', async (req, res) => {
  try {
    const mu = new MU();
    const result = await mu.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PMDailyLogDetail
router.post('/PMDailyLogDetail', async (req, res) => {
  try {
    const issue = new PMDailyLogDetail();
    const result = await issue.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PMDailyLogAttachment POST
// router.post('/PMDailyLogAttachment', async (req, res) => {
//   try {
//     const attachment = new PMDailyLogAttachment();
//     const result = await attachment.post(req.body);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (result.error) {
//       res.status(result.num_code).json({ message: result.error });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// PMIssue
router.post('/PMIssue', async (req, res) => {
  try {
    const issue = new PMIssue();
    const result = await issue.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RFI
router.post('/RFI', async (req, res) => {
  try {
    const rfi = new RFI();
    const result = await rfi.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TimeLogger
// router.post('/TimeLogger', async (req, res) => {
//   try {
//     const logger = new TimeLogger();
//     const result = await logger.post(req.body);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (result.error) {
//       res.status(result.num_code).json({ message: result.error });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// JobPhase
router.post('/JobPhase', async (req, res) => {
  try {
    const jp = new JobPhase();
    const result = await jp.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Timesheet
// router.post('/Timesheet', async (req, res) => {
//   try {
//     const ts = new Timesheet();
//     const result = await ts.post(req.body);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (result.error) {
//       res.status(result.num_code).json({ message: result.error });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// Equipment
router.post('/Equipment', async (req, res) => {
  try {
    const em = new Equipment();
    const result = await em.post(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Equipment Transfer
router.post('/Equipment/Transfer', async (req, res) => {
  try {
    const em = new Equipment();
    const result = await em.post_transfer(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Equipment Part Transfer
router.post('/Equipment/Part/Transfer', async (req, res) => {
  try {
    const em = new Equipment();
    const result = await em.post_part_transfer(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// INV Adjustment Batch Delete
router.delete('/Inventory/AdjustmentBatch', async (req, res) => {
  try {
    const model = new INAdjustmentBatch();
    const result = await model.delete_adjustment(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PMDailyLogDetail delete
router.delete('/PMDailyLogDetail', async (req, res) => {
  try {
    const issue = new PMDailyLogDetail();
    const result = await issue.delete_detail(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Attachment Delete
router.delete('/Attachment', async (req, res) => {
  try {
    const att = new Attachment();
    const result = await att.delete(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PMIssue delete
router.delete('/PMIssue', async (req, res) => {
  try {
    const issue = new PMIssue();
    const result = await issue.delete_issue(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RFI Delete
router.delete('/RFI', async (req, res) => {
  try {
    const rfi = new RFI();
    const result = await rfi.delete_rfi(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TimeLogger delete
// router.delete('/TimeLogger', async (req, res) => {
//   try {
//     const logger = new TimeLogger();
//     const result = await logger.delete_logger(req.body);
//     res.set('Access-Control-Allow-Origin', '*');
//     if (result.error) {
//       res.status(result.num_code).json({ message: result.error });
//     } else {
//       res.json(result);
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// Equipment Transfer DELETE
router.delete('/Equipment/Transfer', async (req, res) => {
  try {
    const em = new Equipment();
    const result = await em.delete_transfer(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Equipment Part Transfer DELETE
router.delete('/Equipment/Part/Transfer', async (req, res) => {
  try {
    const em = new Equipment();
    const result = await em.delete_part_transfer(req.body);
    res.set('Access-Control-Allow-Origin', '*');
    if (result.error) {
      res.status(result.num_code).json({ message: result.error });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request for "clear-site-data" header (useful when someone logs out)
// ----------------------------------------------------
router
  .route("/clear-data")
  // get the login token --- RESPOND with a 200 and [Clear-Site-Data: "*"] in the headers.
  .get((req, res) =>
    res.send(200, "Clearning Data?", {
      "Clear-Site-Data": "*",
      "Cache-Control": "no-cache",
    }),
  );

// =================================
//	EMTRX routes
// =================================
router
  .route("/emtrx/since/:last_seq")
  // get all the jobs (accessed at GET /api/all/since/:last_seq)
  .get(isAuthenticated, (req, res) => {
    emtrx
      .findSince(req)
      .then((r) => res.json(r))
      .catch((e) => {
        console.warn(e);
        res.status(500).json(e.message);
      });
  });

router
  .route("/emtrx/:id")
  // get this specific one
  .get(isAuthenticated, (req, res) => {
    emtrx
      .findSingle(req)
      .then((r) => res.json(r))
      .catch((e) => {
        console.warn(e);
        res.status(500).json(e.message);
      });
  });

router.route("/emtrx").put(isAuthenticated, (req, res) => {
  emtrx
    .save(req)
    .then((r) => res.json(r))
    .catch((e) => {
      console.warn(e);
      res.status(500).json(e.message);
    });
});

// =================================
//	phycounts routes
// =================================
router
  .route("/phycnts/since/:last_seq")
  // get all the jobs (accessed at GET /api/all/since/:last_seq)
  .get(isAuthenticated, (req, res) => {
    phycnts
      .findSince(req)
      .then((r) => res.json(r))
      .catch((e) => {
        console.warn(e);
        res.status(500).json(e.message);
      });
  });

router.route("/phycnts").put(isAuthenticated, (req, res) => {
  phycnts
    .save(req)
    .then((r) => res.json(r))
    .catch((e) => {
      console.warn(e);
      res.status(500).json(e.message);
    });
});

module.exports = router;
