
// **** Shopify Private App for Getting Crypto Prices
// and Updating Product Prices in Shopify Store *****

// INDEX.JS (MAIN FILE)

// INSTALL DEPENDENCIES
// All of these dependencies can be found on npmjs.com
const express = require('express'); // Install request (jquery for node)
const app = express();  // Establish the express app
var request = require('request'); // Library for making API calls
var bodyParser = require('body-parser'); // For decoding JSON
var schedule = require('node-schedule'); // For running cron jobs
var cors = require('cors');

app.use(cors());
require('dotenv').config(); // Require local config file. .env files aren't publicly available so good for API Keys etc.

var port = 3000;
var shopURL = "cryptofiat.myshopify.com";

// API CREDENTIALS FOR ACCESSING THE STORE (Need to update the .env file with your own private app credentials)
const API_KEY = process.env.API_KEY;
const PASSWORD = process.env.PASSWORD;

// This is an array of the products that will get updated.
// Array meaning you can have a list of Ids like ["123", "1234", "4315"] and reference in a loop or by productId[0]

// TODO: Update with your own product id's
//This dictionary stores the ID's for products on the store
var productDict = {
  "btc" : 24432181250,
  "eth" : 24432148482,
  "dash" : 24432050178,
  "ltc" : 24432115714,
  "xrp" : 24432017410
};

var prices = {
  "BTC" : 0,
  "ETH" : 0,
  "DASH" : 0,
  "LTC" : 0,
  "XRP" : 0,
};

// This is needed because Coinmarketcap uses bitcoin names, but you're using
// the codes in the variant names.
var coinCodes = {
  "BTC" : "bitcoin",
  "ETH" : "ethereum",
  "DASH" : "dash",
  "LTC" : "litecoin",
  "XRP" : "ripple"
};

// How much extra to add to each product
var profitMultiplier = 1.1; // 10%;

// DETECT IF IT'S RUNNING ON LOCAL ENVIRONMENT OR HEROKU
if (app.get('env') === 'development') {
  // Settings for local
  require('dotenv').config(); // Load env file
  port = 3000;
} else {
  // Settings for Heroku
  port = process.env.PORT;
};

function cryptoCron() {
  // CRON JOB
  // This will run every 10 seconds to get bitcoin price
  // var timer = '*/10 * * * * *'; // For info on timer see https://www.npmjs.com/package/node-schedule
  var timer = '* */1 * * * '; // 1 minute
  // var timer = '* * * * * 1'

  var myCron = schedule.scheduleJob(timer, function() {
    console.log('Running Cron');
    // For each product ID in the productID array that gets returned, get data
    for (var key in productDict) {
      getProductPrice(productDict[key], function(data) {
        var p = JSON.parse(data);
        var productVariants = p.product.variants;

        // First check that the price is correct
        var split = productVariants[0].title.split(" ");
        var qty = split[0];
        var coinCode = split[1];

        var q = qty * (1 / qty); // Make sure we're looking at one of the coin to check price

        // Check if the crypto price matches
        getCryptoPrice(coinCodes[coinCode], function(data){
          var coinMarketPrice = data[0].price_cad;
          prices[coinCode] = data[0].price_cad;
          // console.log(coinMarketPrice);
          // Check if price !== Coin Market Price. * qty is added so that if we're
          // checking a variant that is 0.5 btc or 100 btc it will still work.
          if (((productVariants[0].price * qty) / profitMultiplier)  !== (coinMarketPrice * qty)) {
            // For each of the variants in the product get the code and the price.
            productVariants.forEach(function(v) {
              var split = v.title.split(" "); // Seperate the code by the space (" ")
              var qty = split[0]; // btc
              var price = (coinMarketPrice * qty) * profitMultiplier;
              // console.log(coinMarketPrice * qty , v.price);
              updateVariantPrice(v.id, price);
              // console.log("Qty: ", qty," Code: ", coinCode, q);
            });
          } else {
            console.log("Prices Match!");
          }
        });

      });
    };
  })
};

function getAllCryptoPrice(callback) {
  // FUNCTION TO GET CRYPTO PRICE.
  // When this function is called, it makes an API call CoinMarketCap and returns JSON
  // callback is what is done after the API all returns.
  // This function essentially returns the same data as if you were to visit this URL - https://api.coinmarketcap.com/v1/ticker/?convert=CAD&limit=10
  // The data it returns is an array of objects. Which means each cryptoprice is at a different index.

  request({
    url : "https://api.coinmarketcap.com/v1/ticker/?convert=CAD&limit=20",
    method: "GET",
    dataType: "json"
  }, function(err, resp) {
    if (err) {
      // Something went wrong. Log to console.
      console.log(err);
    } else {
      var data = JSON.parse(resp["body"]); // The response is a HTTPS response object, so we want to let it know it's JSON and parse just the body as such
      callback(data); // Return the data to our callback so it can do stuff with it.
    }
  });
};

function getCryptoPrice(coinName, callback) {
  // This function returns a specific crypto price by their id (case sensitive).
  // Valid values examples: bitcoin, ethereum, ripple etc
  // Send an API request to coinmarketcap
  console.log('Getting ' + coinName + " price!" )
  request({
    url : "https://api.coinmarketcap.com/v1/ticker/" + coinName + "/?convert=CAD&limit=10",
    method: "GET",
    dataType: "json"
  }, function(err, resp) {
    if (err) {
      // Something went wrong. Log to console.
      console.log(err);
    } else {
      var data = JSON.parse(resp["body"]);
      callback(data);
    }
  });
};

// Get's the products price from the store
function getProductPrice(productID, callback) {
  var requestURL = "https://" + process.env.API_KEY + ":" + process.env.PASSWORD + "@" + shopURL + "/admin/products/" + productID + ".json";
  request({
    url: requestURL,
    method: "GET",
    dataType: "json"
  }, function(err, resp) {
    if (err) {
      console.log(err)
    } else {
      data = resp["body"];
      callback(data);
    }
  });
};

function updateVariantPrice(variantId, newPrice, callback) {
  // Updates Variant Price


  var requestURL = "https://" + process.env.API_KEY + ":" + process.env.PASSWORD + "@" + shopURL + "/admin/variants/" + variantId + ".json";
  request({
    url: requestURL,
    method: "PUT",
    json: {
      "variant" : {
        "id" : variantId,
        "price" : newPrice
      }
    }
  }, function(err, resp) {
    if (err) {
      console.log(err)
    } else {
      // console.log(resp);
      data = resp["body"];
      // callback(data);
    }
  });
};

// These are specific Routes you can use to see the data for yourself by visiting localhost:3000 followed by the route.
app.get('/', function(req, res) {
  // Visiting this URL ('ie: localhost:3000') will display all crypto price data
  getAllCryptoPrice(function(data) {
    // data now contains all of our crypto price in a neat array. As seen here - https://api.coinmarketcap.com/v1/ticker/?convert=CAD&limit=10
    // data[0] = bitcoin dataType
    // data[1] = ethereum data
    // data[0].price_cad = bitcoin price in canadian
    // data[2].symbol = "XRP"

    // Because the data is returned in an array, this program assumes that Bitcoin
    // will always be priced the highest, and therefore the first in the array.
    // To be safe it would be smarter to loop over them all
    res.send(data);
  })
});

app.get('/exchangeprice/:coinId', function(req, res) {
  // Get Specific Coin Price from Exchange

  // visit localhost:3000/bitcoin or localhost:3000/ethereum to see just that specific price
  // This function uses query parameters to get the coinId variable which is passed to getCryptoPrice function
  getCryptoPrice(req.params.coinId, function(data) {
    res.send(data);
  });
});

app.get('/shopprice/:coinId', function(req, res) {
  // Current price in Shopify. Will list all the product data in the productID Array
  var productId = productDict[req.params.coinId];
  getProductPrice(productId, function(data) {
    res.send(data);
  });
});

app.get('/storedPrice/:coinId', function(req, res){
    // Sends the most recently stored price for that coin
    res.send(prices[req.params.coinId]);
});

app.listen(port, function() {
  cryptoCron(); // Start running our cronJob
  console.log("Crypto App running on port: " + port);
})
