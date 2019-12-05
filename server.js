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

// constants
const TWO_HOURS = 1000 * 60 * 60 * 2;
const{
        SESS_LIFETIME = TWO_HOURS
} = process.env

// Variables for distributed stuffs
var jobs = [];          // JSON object that holds the jobs (urls) submitted by user. 
                        // To be passed to home.ejs everytime we render

var worker_ips = [];    // Array that stores the IPs of all the workers


const redirectLogin = function(req, res, next){
        if(!req.session.userId){
                res.redirect('/login')
        }
        else{
                next()
        }
}

const redirectHome = function(req, res, next){
        if(req.session.userId){
                res.redirect('/')
        }
        else{
                next()
        }
}

app.use(session({
        name: 'sid',
        resave: false,
        saveUninitialized: false,
        secret: 'key',
        //store: 
        cookie:{
                sameSite: true,
                secure: false
        }
}));

async function update_jobs(user, json) {
    jobs.push(json);

    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        console.log("Saving jobs to Mongo");
        var dbo = db.db("ST");
        var doc = {username: user, job_queue: jobs};
        console.log(doc);
        dbo.collection("jobs_sess").updateOne({username: user},
                                             {$set: doc}, {upsert: true});
        db.close();
    })
}

function split_typos(typos, num_splits) {
    var ret = [];
    var split_size = ret.length / num_splits;
    
    for(i = 0; i < num_splits.length; i+=split_size) {
        ret.push(typos.slice(i, i+split_size));
    }

    return ret;
}

/* ROUTES */

// login request
app.get('/login', redirectHome, function(req,res){
        res.render('login.ejs',{error: msg});
    //res.sendFile(__dirname + "/views/login.ejs");
});

app.post('/login', redirectHome, function(req, res){
        var username = req.body.username;
        var password = req.body.password;
    
    console.log(username);
    console.log(password);

    if(!username){
        console.log("User undefined");
        msg = "Invalid Usesrname/Password";
        res.redirect('/login');
    }
    else if(!password){
        console.log("Password undefined");
        msg = "Invalid Usesrname/Password";
        res.redirect('/login');
    }
    else{
        MongoClient.connect(url, function(err, db){
                    if(err) throw err;
                    console.log("database connected");
                    var dbo = db.db("ST");
                    dbo.collection("collection").findOne({username:username}, function(err,result){
                            if(err) throw err;

                if (!(result)) {
                    console.log("No user with that username exists in the database.");
                    msg = "Invalid Username";
                    res.redirect('/login');
                } else {

                                console.log("user found");
                    if(!(result.password)){
                                console.log("Password undefined");
                                msg = "Invalid Usesrname/Password";
                                res.redirect('/login');
                        }           
                                if(password === result.password){
                                        console.log("password matched");
                                        req.session.userId = result.username;
                                        msg = '';
                                        jobs=[];
                                        res.redirect('/');
                                }
                                else{
                                        console.log("password not matching");
                                        msg = 'Incorrect Username/Password';
                                        res.redirect('/login');
                                }
                }
                    });

                // Populate Jobs
        dbo.collection("jobs_sess").findOne({username: username}, function(err,result){
            if (err) throw err;
            if (result) {
                console.log("User jobs loaded");
                jobs = result.job_queue;
            }
            db.close();
        });
    });

    }
});

// Logout
app.get('/logout', redirectLogin, function(req, res){
        console.log(typeof req.session.userId + req.session.userId);
        if(req.session){
            MongoClient.connect(url, function(err, db) {
                    if (err) throw err;
                    console.log("Saving jobs to Mongo");
                    var dbo = db.db("ST");
                    var doc = {username: req.session.userId, job_queue: jobs};
                    console.log(doc);
                    dbo.collection("jobs_sess").updateOne({username: req.session.userId},
                                                         {$set: doc}, {upsert: true});
                    db.close();

                    req.session.destroy(function(err){
                        if(err){
                            throw err;
                            res.json({status: "error"});
                        }
                        msg = '';
                        res.redirect('/login');
                    });
            });

        }
        else{
                res.json({status: "error"});
        }
});

// register request
app.get('/register', function(req, res) {
    res.render('register.ejs', { error: msg_register });
});

// make a new account
app.post('/register', function(req, res) {
    var user = req.body.username;
    var pass = req.body.password;

    if (!user) {
        console.log("Username isn't set on the new account");
        msg = "Invalid Username";
        res.redirect('/register');
    } else if (!pass) {
        console.log("Password isn't set on the new account");
        msg = "Invalid Password";
        res.redirect('/register');
    }

    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        console.log("Looking in Mongo Database.");
        var dbo = db.db("ST");

        dbo.collection("collection").findOne({username: user}, function(err, result){
            if (err) throw err;
            if (result) { // if user of that name exists then make them login
                console.log("someone with that username already exists");
                msg = 'Already registered. Please Login';
                res.redirect('/login');
            } else {
                console.log("adding the user and pass to the list of users");
                var newUser = { username: user, password: pass };
                dbo.collection("collection").insertOne(newUser, function(err, result) {
                    if (err) throw err;
                    console.log("user has been inserted into the database");
                    msg = '';
                    res.redirect('/login');
                });
            }

            db.close();

        });
    });
});


// get request for css file
app.get('/css/anime.css', function(req,res){
        res.writeHead(200,{'Content-type' : 'text/css'});
        var fileContents = fs.readFileSync('css/anime.css', {encoding: 'utf8'});
        res.write(fileContents);
        res.end();
});

// get request for home page
app.get('/', redirectLogin, function(req,res){
    const{userId} = req.session;
    res.render('home.ejs', {jobs: jobs.reverse()});
    //res.sendFile(__dirname + "/views/home.html")
});

// JSON API: {username: , query: , suspect:, image:}
app.post('/from_worker', function(req, res) {
    var user = req.body.username;
    var requested_url = req.body.query;
    var sus = req.body.suspect;
    var fpath = req.body.path;
    MongoClient.connect(url, function(err, db){
        if(err)throw err;
        var dbo = db.db("ST");
        var doc = {username: user, query: requested_url, suspect: sus, path: fpath};
        // dbo.collection("screenshots").insertOne(doc, function(err,res){
        //              if(err)throw err;
        //              db.close();
        //      });
        // Update does not allow duplicates
        dbo.collection("screenshots").updateOne(doc, {$set: doc}, {upsert: true});
        db.close();
    });
});

// Responds with a view
// Format: /suspect?url=
app.get('/suspect', function(req, res){
    var origin = req.query.url;
    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("ST");
        var sql_query = {query: origin};
        var cursor = dbo.collection("screenshots").find(sql_query).toArray(function (err, results) {
            suspects = [];
            for (i = 0; i < results.length; i++) {
                suspects.push({url: results[i].suspect, screenshot: results[i].path});
            }
            
            res.render('table.ejs', suspects);
            
        });
    })
});

app.get('/render_raw', function(req, res){
    var html = require("html");
    var suspect = req.query.suspect;
    
    res.set('Content-type', 'text/plain');

    request({
        uri: suspect,
    }, function(err, resp, body){
        res.send(html.prettyPrint(body, {indent_size: 2}));
    });

})


// algo
// var typo_url = [];
app.post('/', function(req, res) {
    var url = req.body.url.toLowerCase();
    // var nl_cr_regex = new RegExp("\r*\n")
    // var ips = req.body.ips.split(nl_cr_regex);
    var typo_url=[];
    console.log("input url: " + url);
    // console.log("input ips:");
    // console.log(ips);
    
    var valid_url = [];
    if(url.indexOf("www.") != 0) {
        valid_url[0] = "www."+url;
        valid_url[1] = url;
    } else {
        valid_url[0] = url;
        valid_url[1] = url.slice(4);
    }
    console.log(valid_url);

    // character set for url: (0-9), (a-z), -, ., _, ~  
    var typo_keys = {
        a: ['q','w','s','z'],
        b: ['g','h','n','v'],
        c: ['x','d','f','v'],
        d: ['s','e','r','f','c','x'],
        e: ['w','3','4','r','d','s'],
        f: ['d','r','t','g','v','c'],
        g: ['f','t','y','h','b','v'],
        h: ['g','y','u','j','n','b'],
        i: ['u','8','9','o','k','j'],
        j: ['h','u','i','k','m','n'],
        k: ['j','i','o','l','m'],
        l: ['k','o','p','.'],
        m: ['n','j','k'],
        n: ['b','h','j','m'],
        o: ['i','9','0','p','l','k'],
        p: ['o','0','-','_','l'],
        q: ['1','2','w','a'],
        r: ['e','4','5','t','f','d'],
        s: ['a','w','e','d','x','z'],
        t: ['r','5','6','y','g','f'],
        u: ['y','7','8','i','j','h'],
        v: ['c','f','g','b'],
        w: ['q','2','3','e','s','a'],
        x: ['z','s','d','c'],
        y: ['t','6','7','u','h','g'],
        z: ['a','s','x'],
        0: ['9','-','_','p','o'],
        1: ['~','2','q'],
        2: ['1','3','w','q'],
        3: ['2','4','e','w'],
        4: ['3','5','r','e'],
        5: ['4','6','t','r'],
        6: ['5','7','y','t'],
        7: ['6','8','u','y'],
        8: ['7','9','i','u'],
        9: ['8','0','o','i'],
        '-': ['_','0','p'],
        '.': ['l'],
        '_': ['-','0','p'],
        '~': ['1']
    };
    
    var url_len, replacec, dup, i, j, k, a, b, c, prevc=null, num_adjkeys, nextc;
    for(i=0; i<2; ++i) {
        url = valid_url[i];
        url_len = url.length;
        
        for(j=0; j<url_len; ++j) {
            dup = false;
            a = url.substring(0, j);
            b = url.substring(j+1);
            c = url.substring(j);
            replacec = url.charAt(j);
            //console.log("a:"a+" b:"+b+" c:"+c);
            
            // omission & missing dot
            if(prevc == null || prevc != null && prevc != replacec) {
                typo_url.push(a+b);
                dup = true;
            }

            num_adjkeys = typo_keys[replacec].length;
            
            // console.log(num_adjkeys);
            for(k=0; k<num_adjkeys; ++k) {
                // replacement (replace adjacent characters on kb)
                typo_url.push(a + typo_keys[replacec][k] + b);
                // insertion
                typo_url.push(a + typo_keys[replacec][k] + c);
                // console.log(a + typo_keys[replacec][k] + c);
                if(dup) {
                    typo_url.push(a + replacec + typo_keys[replacec][k] + b);
                    // console.log(a+replacec+typo_keys[replacec][k]+b);
                }
            }

            // permutation (swap consec char)
            if(j < url_len-1) {
                if(replacec != (nextc = url.charAt(j+1))) {
                    typo_url.push(a + nextc + replacec + url.substring(j+2));
                    // console.log(a+nextc+replacec+url.substring(j+2));
                }
            }

            prevc = replacec;
        }
    }
    typo_url.sort();
    // typo_url=["www.google.com"];
    // console.log(typo_url);
    console.log(typo_url.length);
    var original_url = req.body.url.toLowerCase();


    // split_typ_arr = split_typos(typo_url, 10);
    var block_sz = (typo_url.length/390) + 2;
    
    for(i = 0; i < typo_url.length; i+=block_sz) {
        request.post('http://130.245.169.243/crawl').form({
                                    requested: original_url, 
                                    url: typo_url.slice(i, i+block_sz), 
                                    username:"user"});   
    }
    res.render('loading.ejs');
    update_jobs(req.session.userId, {url: req.body.url, status: 'Crawling'})
    // res.render('home.ejs', {jobs: jobs});
    //crawl(typo_url);
    //res.sendFile(__dirname + '/tmp/stonybrook.png');
});


// app runs on PORT 8080
app.listen(8080); 
