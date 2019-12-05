// required components
var express = require('express');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var session = require('express-session');
var fs = require('fs');
var request = require('request');

var http = require('https')

// app
var app = express();
var msg = '';
var msg_register = '';

// Socket for updating table
// var socket_http = require('http').createServer(app);
// var io = require('socket.io').listen(socket_http);
// socket_http.listen(app.get('port'));
// io.on('connection', function(socket){
//     console.log('recieved connection');
// });

// additional functions required for the app
app.use(bodyParser.urlencoded({ extended:true }));
app.use(bodyParser.json());
app.use(express.static('css'));
app.use(express.static('views'));
// Added this to allow easy grabbing of images
app.use(express.static('tmp'));

// Make html pretty
app.set('view options', {pretty: true});

// Mongo connection
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

// headless chrome crawler
const HCCrawler = require('headless-chrome-crawler');
const PATH = './tmp/';


// Init headless chrome crawler
(async () => {
    crawler = await HCCrawler.launch({
        args: ['--no-sandbox','--ignore-certificate-errors',],
        ignoreHTTPSErrors: true,
        maxConcurrency: 10,
        onSuccess: result => {
                console.log(`Success: screenshot saved as ${PATH}${result.options.saveAs} for ${result.options.url}.`);
                // Post back to master
                request.post('http://130.245.169.243/from_worker').form({
                    username: result.options.username, 
                    query: result.options.orig_url, 
                    suspect: result.options.url, 
                    path: result.options.saveAs
                });

                // io.emit('update', {url: result.options.url, screenshot: result.options.saveAs});
                return true;
        },
        onError: result => {
                // console.warn(result);
                return false;
        },
        preRequest: options => {
                if(!options.saveAs) {
                        console.log("Skipping request");
                        return false; // SKIP REQUEST BY RETURNING FALSE
                }                           
                options.screenshot = {path: `${PATH}${options.saveAs}`};
                return true;
        }
    });
})();


app.get('/crawl', function(req, res) {
    res.end("ok");
});

// crawl the webpage
app.post('/crawl', function(req,res){
    var username = req.body.username;
    var requested_url = req.body.requested;
    var typo_url = JSON.stringify(req.body.url);
    typo_url = JSON.parse(typo_url);
    // console.log("----Crawl Post Request----");
    // console.log("URL: " + typo_url);

    crawl();
    res.end("ok");
    async function crawl() {
        // console.log("crawling");
        // console.log(`Queuing URL: ${typo_url[0]}`);
        for (i = 0; i < typo_url.length; i++) {
            var save_path = typo_url[i] + '.png';
            crawler.queue({url: 'https://'+typo_url[i], 
                                                saveAs: save_path,
                                                timeout: 3000,
                                                retryDelay: 100,
                                                waitUntil: ["load", "domcontentloaded", "networkidle0"],
                                                obeyRobotsTxt: 'false',
                                                requestingUser: username,
                                                orig_url: requested_url
                                            });
        }
            // var status = await crawler.queue({url: 'https://google.com', saveAs: typo_url[0]+'.png', timeout: 3000, obeyRobotsTxt: 'false'});
            // console.log("Im REALLY not crawling anymore");        
    }
})




// app runs on PORT 8080
app.listen(8084);
