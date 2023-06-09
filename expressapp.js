const path = require("path");
const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const LOMOL_HOST = process.env.LOMOL_HOST; 
const CLIENT_LND_DOMAIN = process.env.CLIENT_LND_DOMAIN;
const MACAROON_PATH_CLIENT = process.env.MACAROON_PATH_CLIENT;
// const TLS_CERT_PATH_CLIENT = process.env.TLS_CERT_PATH_CLIENT;

var macaroonInt = fs.readFileSync(MACAROON_PATH_CLIENT);
const MACAROON = Buffer.from(macaroonInt, 'utf8').toString('hex');

console.log("This is update 2")

console.log("MACAROON: ", MACAROON);

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.get("/", async (req, res) => {
  res.render("index");
});

/////////////////////////////
// Client LND node calls
/////////////////////////////

app.post("/getinfo", async (req, res) => {
  let options = {
    url: `https://${CLIENT_LND_DOMAIN}/v1/getinfo`,
    rejectUnauthorized: false,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
    },
  }
  request.get(options, function(error, response, body) {
    res.json(body);;
  });
});

app.post("/addholdinvoice", async (req, res) => {
  let options = {
    url: `https://${CLIENT_LND_DOMAIN}/v2/invoices/hodl`,
    rejectUnauthorized: false,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
    },
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);;
  });
});

app.post("/lookupinvoice", async (req, res) => {
  var payment_hash_buf = req.body.payment_hash;
  var buffer = Buffer.from(payment_hash_buf, 'base64') 
  payment_hash_buf = buffer.toString('base64url')
  let options = {
    url: `https://${CLIENT_LND_DOMAIN}/v2/invoices/lookup?payment_hash=${payment_hash_buf}=`,
    rejectUnauthorized: false,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
    },
  }
  request.get(options, function(error, response, body) {
    res.json(body);;
  });
});

app.post("/sendpayment", async (req, res) => {
  console.log('req.body.dest: ' + req.body.dest);
  console.log('req.body.payment_hash: ' + req.body.payment_hash);
  console.log('req.body.payment_request: ' + req.body.payment_request);
  let options = {
    url: `https://${CLIENT_LND_DOMAIN}/v1/channels/transactions`,
    rejectUnauthorized: false,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
    },
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);;
  });
});

app.post("/settleinvoice", async (req, res) => {
  console.log('req.body.preimage: ' + req.body.preimage);
  // var preimage_buf = req.body.preimage;
  // var buffer = Buffer.from(preimage_buf, 'base64') 
  // preimage_buf = buffer.toString('base64url')
  // req.body.preimage = preimage_buf + '='
  // console.log('preimage as url in server side function: ' + req.body.preimage)
  let options = {
    url: `https://${CLIENT_LND_DOMAIN}/v2/invoices/settle`,
    rejectUnauthorized: false,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
    },
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);
  });
});

/////////////////////////////
// LOMOL server calls
/////////////////////////////

app.get("/getorderbooks", async (req, res) => {
  let options = {
    url: `http://${LOMOL_HOST}/getorderbooks`,
  }
  request.get(options, function(error, response, body) {
    res.json(body);
  });
});

app.get("/gettickerprice", async (req, res) => {
  let options = {
    url: `http://${LOMOL_HOST}/gettickerprice`,
  }
  request.get(options, function(error, response, body) {
    res.json(body);
  });
});

app.get("/getpaymenthash", async (req, res) => {
  let options = {
    url: `http://${LOMOL_HOST}/getpaymenthash`,
  }
  request.get(options, function(error, response, body) {
    res.json(body);
  });
});

app.get("/getserverpubkey", async (req, res) => {
  let options = {
    url: `http://${LOMOL_HOST}/getserverpubkey`,
  }
  request.get(options, function(error, response, body) {
    res.json(body);
  });
});

app.post("/getrevealedpreimage", async (req, res) => {
  console.log('request payment hash getrevealedpreimage: ' + req.body.payment_hash)
  let options = {
    url: `http://${LOMOL_HOST}/getrevealedpreimage`,
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);
  });
});

app.post("/negotiateorder", async (req, res) => {
  console.log(req.body)
  let options = {
    url: `http://${LOMOL_HOST}/negotiateorder`,
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);
  });
});

app.post("/placeorder", async (req, res) => {
  console.log(req.body)
  let options = {
    url: `http://${LOMOL_HOST}/placeorder`,
    form: JSON.stringify(req.body),
  }
  request.post(options, function(error, response, body) {
    res.json(body);
  });
});

const port = process.env.CLIENT_UI_PORT || 3030;
console.log(`Running on ${port}`);
app.listen(port);


/////////////////////////////////////////////

