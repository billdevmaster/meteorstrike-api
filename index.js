const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mysql = require('mysql');
const cors = require('cors');
const Web3 = require('web3');
const axios = require('axios');
require('dotenv').config();
const app = express();
const tokenAddress = "0x690c98145025dE4Ff90d4F5781f53aa35eF05544";
const adminAddress = "0xf3BD9c66deC63b71179De31de64Af518F0B79723";
const web3 = new Web3(new Web3.providers.HttpProvider("https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"));
const tokenABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
const contractInstance = new web3.eth.Contract(tokenABI, tokenAddress);
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

app.use(bodyParser.json());
app.use(cors({ origin: '*' }));
// Define a route
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.post('/saveGameData', async (req, res) => {
  const data = req.body;
  const hash = req.query.hash;
  const input = data.address + data.coins + secretEncryptionKey;
  const hashServer = hashString(input);
  let sql = "";
  if (hashServer == hash) {
    // save 
    sql = `SELECT * FROM gameData WHERE address='${data.address}'`;
    connection.query(sql, (err, result) => {
      if (err) throw err;
      if (result.length > 0) { // update
        sql = `UPDATE gameData SET 
          sound=${data.sound}, 
          music=${data.music}, 
          highscore=${data.highscore}, 
          playcount=${data.playcount}, 
          ads=${data.ads}, 
          coins=${data.coins}, 
          xp=${data.xp}, 
          level=${data.level}, 
          installDays=${data.installDays}, 
          selectedTheme='${data.selectedTheme}', 
          classicSevenBetStep=${data.classicSevenBetStep}, 
          volume=${data.volume} 
          WHERE address='${data.address}'`;
      } else { // insert
        sql = `INSERT INTO gameData (
          address, 
          sound, 
          music, 
          highscore, 
          playcount, 
          ads, 
          coins, 
          xp, 
          level, 
          installDays, 
          selectedTheme, 
          classicSevenBetStep, 
          volume) VALUES (
          '${data.address}', 
          ${data.sound}, 
          ${data.music}, 
          ${data.highscore}, 
          ${data.playcount}, 
          ${data.ads}, 
          ${data.coins}, 
          ${data.xp}, 
          ${data.level}, 
          ${data.installDays}, 
          '${data.selectedTheme}', 
          ${data.classicSevenBetStep}, 
          ${data.volume})`;
      }
      connection.query(sql, (err1, result1) => {
        if (err1) throw err1;
        console.log(result1);
        res.json("success");
      });
    });
  }
});

app.get('/getGameData', (req, res) => {
  const address = req.query.address;
  const sql = `SELECT * FROM gameData WHERE address='${address}'`;
  connection.query(sql, (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      let retData = {...result[0], rate};
      res.json(retData);
    } else {
      res.json({
        rate,
        sound: "1",
        music: "1",
        highscore: 0,
        playcount: 0,
        ads: "1",
        coins: 0,
        xp: 0,
        level: 0,
        installDays: 0,
        selectedTheme: "",
        classicSevenBetStep: 0,
        volume: 0
      });
    }
  })
});

app.post('/sellCoins', async (req, res) => {
  const amount = req.query.amount * rate;
  const address = req.query.address;
  const encodedFunction = contractInstance.methods.transfer(address, Web3.utils.toWei(amount.toString(), 'ether')).encodeABI();
  let trxHash = "";
  const txObject = {
    to: tokenAddress,
    data: encodedFunction,
    gas: 200000, // Set an appropriate gas limit
    gasPrice: web3.utils.toWei('10', 'gwei'), // Convert gas price to Wei
  };
  try {
    const account = web3.eth.accounts.privateKeyToAccount(process.env.mnemonic);
    const signedTx = await account.signTransaction(txObject);
    web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('transactionHash', (hash) => {
      trxHash = hash;
    })
    .on('receipt', (receipt) => {
      return res.send(`success:${trxHash}`);
    })
    .on('error', (error) => {
      console.log(error)
      return res.send("error:")
    });

  } catch (e) {
    console.log(e)    
  }
})

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

async function detectTransactions() {
  
  let lastBlock = await web3.eth.getBlockNumber();
  console.log(lastBlock);
  while(true) {
    try {
      const resp = await axios.get(`https://api-goerli.etherscan.io/api?module=logs&action=getLogs&fromBlock=${lastBlock + 1}&address=${tokenAddress}&apikey=TEJSMRD3P2TQYCCIT5XC7C3K5U11CE4QSG`);

      if (resp.data.result?.length > 0) {
        for (let i = 0; i < resp.data.result.length; i++) {
          const trxHash = resp.data.result[i].transactionHash;
          const transaction = await web3.eth.getTransaction(trxHash);
          const input = transaction.input;

          if (input.slice(0, 10) === '0xa9059cbb' && transaction.to.toLowerCase() == tokenAddress.toLowerCase()) { // transfer function
            const recipient = '0x' + input.slice(34, 74);
            const from = transaction.from;
            const amount = web3.utils.toBN('0x' + input.slice(74));
            const addedCoinAmount = web3.utils.fromWei(amount, "ether") * (1 / rate);
            
            let sql = "";
            let address = "";
            let type = "";
            if (recipient.toLowerCase() == adminAddress.toLowerCase()) { // buy coins
              address = from.toLowerCase();
              type = "buy";
              sql = `SELECT * FROM gameData WHERE address='${from.toLowerCase()}'`;
              connection.query(sql, (err1, result1) => {
                if (err1) throw err1;
                if (result1.length > 0) {
                  sql = `UPDATE gameData SET coins=coins + ${addedCoinAmount} WHERE address='${from.toLowerCase()}'`;
                } else {
                  sql = `INSERT INTO gameData (address, coins) VALUES ('${from.toLowerCase()}', ${addedCoinAmount})`;
                }
                connection.query(sql, (err, result) => {
                  if (err) throw err;
                  insertLog(address, type, amount, trxHash, addedCoinAmount)
                })
              })
            } else { // sell coins
              address = recipient.toLowerCase();
              type = "sell";
              let sql = `UPDATE gameData SET coins=coins - ${addedCoinAmount} WHERE address='${recipient.toLowerCase()}'`;
              
              connection.query(sql, (err, result) => {
                if (err) throw err;
                insertLog(address, type, amount, trxHash, addedCoinAmount)
              })
            }
          }
          const blockNumber = parseInt(resp.data.result[i].blockNumber, 16);
          lastBlock = blockNumber;
        }
      } else {
        await delay(1000);
      }
    } catch (e) {
      console.log(e);
    }
  }
}

const delay = ms => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const insertLog = function (address, transaction_type, token_amount, transaction_hash, coins_amount) {
  let sql = `INSERT INTO logs (address, transaction_type, token_amount, transaction_hash, coins_amount, token_num) 
              VALUES ('${address}', '${transaction_type}', ${token_amount}, '${transaction_hash}', ${coins_amount}, ${web3.utils.fromWei(token_amount, "ether")})`;
  connection.query(sql, (err, result) => {
    if (err) throw err;
  })
}

detectTransactions();
