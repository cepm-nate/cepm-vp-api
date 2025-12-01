if (!process.env.LDAP_URL) require('dotenv').config();
const compression = require("compression");
const express = require("express"); // call express
const app = express(); // define our app using express
const https = require("https");
const fs = require("fs");
const Emtrx = require("./app/controllers/emtrx");
const PhyCnts = require("./app/controllers/phycnts");
const Auth = require("./app/controllers/auth");
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(allowCrossDomain);
app.use(compression());

const emtrx = new Emtrx();
const phycnts = new PhyCnts();
const auth = new Auth();

var port = process.env.PORT || 12980; // set our port

// Cross Domain
// =============================================================================
function allowCrossDomain(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "token,username,password,Testing,x-uuid,x-phone,x-code,x-pass,x-employee,x-hqco",
  );
  res.header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.header("Cache-Control", "no-cache");
  if (req.method === 'OPTIONS') return res.status(200).send();
  next();
}

// AUTHENTICATION
// =============================================================================
function checkLogin(req, res) {
  return Promise.all([]).then(function () {
    if (req.headers["x-uuid"]) {
      return auth
        .check(req)
        .then((res) => auth.employeeInfo(res.output.PRCo, res.output.Employee));
    }

    const userAndPass = {
      username: req.headers.username,
      password: req.headers.password,
    };

    return auth.authenticateHandler(userAndPass);
  });
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

// ROUTES FOR OUR API/
// =============================================================================
var router = express.Router(); // get an instance of the express Router

// test route to make sure everything is working (accessed at GET /api)
router.get("/", function (req, res) {
  console.log("basic test");
  res.json({ message: "Hooray! welcome to our api!" });
});

// First authentication route
// ----------------------------------------------------
router
  .route("/login")
  // get the login token
  .get((req, res) => {
    checkLogin(req, res)
      .then((r) => res.send(r))
      .catch((e) => {
        console.warn(e.message);
        if (e.response) res.status(e.response.status).send(e.message);
        else res.status(500).send(e.message);
      });
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


// REGISTER OUR ROUTES -------------------------------
app.use("/api", router);

// START THE SERVER
// =============================================================================
app.listen(port, "0.0.0.0", function () {
  console.log("CEPM-VP-API calls happen on port " + port);
});
