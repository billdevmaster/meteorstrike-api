const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mysql = require('mysql');
const cors = require('cors');
const Web3 = require('web3');
const axios = require('axios');
require('dotenv').config();
const app = express();

const secretEncryptionKey = process.env.secretKey;
const configuration = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  acquireTimeout: 10000000000
};
const rate = 2; // 100 coins = 200 token
let connection;

handleDisconnect();
app.use(bodyParser.urlencoded());
app.use(cors({ origin: '*' }));
// Define a route
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.post('/saveScore', async (req, res) => {
  
  const {hash, address, score} = req.body;
  const input = address + score + secretEncryptionKey;
  console.log(input);
  const hashServer = hashString(input);
  console.log(hashServer)
  console.log(hash)
  let sql = "";
  if (hashServer == hash) {
    // save 
      sql = `INSERT INTO scores (
        address, 
        score) VALUES (
        '${address}', 
        ${score})`;
    try {
      connection.query(sql, (err1, result1) => {
        if (err1) throw err1;
        console.log(result1);
        res.json("success");
      });
    } catch (e) {
      res.json("fail");
    }
  } else {
    res.json("fail");
  }
});

app.post('/saveGameScore', async (req, res) => {
  const {hash, address, score, gameName} = req.body;
  const input = address + score + gameName + secretEncryptionKey;
  const hashServer = hashString(input);
  let sql = "";
  if (hashServer == hash) {
    // save 
    sql = `INSERT INTO ${gameName}_scores (
        address, 
        score) VALUES (
        '${address}', 
        ${score})`;
    try {
      connection.query(sql, (err1, result1) => {
        if (err1) {
          console.log(err1)
          return res.json("fail");
        };
        console.log(result1);
        res.json("success");
      });
    } catch (e) {
      res.json("fail");
    }
  } else {
    res.json("fail");
  }
});

app.get('/getScore', async (req, res) => {
  const { start, limit, gameName } = req.query;
  // get total count
  let sql = `SELECT address, MAX(score) as score FROM scores GROUP BY address`;
  const totalCntResult = await executeQuery(sql);
  const totalCnt = totalCntResult.length;
  sql = `SELECT address, score from (SELECT address, MAX(score) as score FROM scores GROUP BY address) as t1 ORDER BY t1.score DESC LIMIT ${start}, ${limit}`;
  connection.query(sql, async (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      const tmpArr = []
      for (let i = 0; i < result.length; i++) {
        sql = `SELECT address, createdAt, score FROM scores WHERE address='${result[i].address}' AND score=${result[i].score} ORDER BY createdAt LIMIT 1`;
        const result1 = await executeQuery(sql);
        tmpArr.push({ address: result1[0].address, score: result1[0].score, createdAt: result1[0].createdAt });
      }
      res.json({list: tmpArr, totalCnt});
    } else {
      res.json([]);
    }
  })
});

app.get('/getGameScore', async (req, res) => {
  const { start, limit, gameName } = req.query;
  // get total count
  let sql = `SELECT address, MAX(score) as score FROM ${gameName}_scores GROUP BY address`;
  const totalCntResult = await executeQuery(sql);
  const totalCnt = totalCntResult.length;
  sql = `SELECT address, score from (SELECT address, MAX(score) as score FROM ${gameName}_scores GROUP BY address) as t1 ORDER BY t1.score DESC LIMIT ${start}, ${limit}`;
  connection.query(sql, async (err, result) => {
    if (err) {
      console.log(err)
      return res.json([]);
    };
    if (result.length > 0) {
      const tmpArr = []
      for (let i = 0; i < result.length; i++) {
        sql = `SELECT address, createdAt, score FROM ${gameName}_scores WHERE address='${result[i].address}' AND score=${result[i].score} ORDER BY createdAt LIMIT 1`;
        const result1 = await executeQuery(sql);
        tmpArr.push({ address: result1[0].address, score: result1[0].score, createdAt: result1[0].createdAt });
      }
      res.json({list: tmpArr, totalCnt});
    } else {
      res.json([]);
    }
  })
});

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

function hashString(input) {
  const sha256 = crypto.createHash('sha256');
  sha256.update(input, 'utf8');
  return sha256.digest('hex');
}

function handleDisconnect() {
  connection = mysql.createConnection(configuration);

  connection.connect(function(err) {
    if (err) {
      console.log("error when connecting to db:", err);
      setTimeout(handleDisconnect, 2000);
    }else{
        console.log("connection is successfull");
    }
  });
  connection.on("error", function(err) {
    console.log("db error", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

const delay = ms => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// Execute the query using await
const executeQuery = (sql) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};