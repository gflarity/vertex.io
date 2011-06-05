
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var fs = require('fs');

var app = module.exports = express.createServer();

var APPS_HOME = '/Users/Steve/dev/secretproj/restapp/sandbox'

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

app.register('.html', require('ejs'));

// Routes

app.get('/', function(req, res){
  res.render('index', {
    locals : {}
  });
});

app.get('/login', function(req, res){
    
    var apps = [];
    var entries = fs.readdirSync(APPS_HOME);
    for (var i = 0; i < entries.length; i++ ) {
        name = entries[i];
        //console.log(name);
        var full_path = APPS_HOME + '/' + name;
        var stats = fs.statSync(  full_path );
        if ( stats.isDirectory() ) {
            apps.push(name);
        }
    } 
    
  res.render('login', {
    locals : { 'myapps' : apps}
  });
});

app.get('/us', function(req, res){
  res.render('us', {
    locals : {}
  });
});

app.get('/pricing', function(req, res){
  res.render('pricing', {
    locals : {}
  });
});

app.get('/competition', function(req, res){
  res.render('competition', {
    locals : {}
  });
});

app.get('/tech', function(req, res){
  res.render('technologies', {
    locals : {}
  });
});

app.get('/solution', function(req, res){
  res.render('solution', {
    locals : {}
  });
});

app.get('/why', function(req, res){
  res.render('why', {
    locals : {}
  });
});

app.get('/create', function(req, res){

    var client = http.createClient(3001, 'localhost'); 
    
    client.addListener('error', function(connectionException){
        if (connectionException.errno === process.ECONNREFUSED) {
            console.log('ECONNREFUSED: connection refused to '
                +client.host
                +':'
                +client.port);
        } else {
            console.log(connectionException);
        }
    });
    
    //console.log('/?' + req.param('command') + '&' + req.param('args'));
    var request = client.request("GET", '/?command=' + req.param('command') + '&args=sandbox/' + req.param('args'));
    
    request.addListener('response', function(response) {
        
        var responseBody = "";

        response.addListener("data", function(chunk) {
            responseBody += chunk;
        });

        response.addListener("end", function() {
            console.log(responseBody)
            var response_json = JSON.parse(responseBody);
            var returncode = parseInt(response_json.returncode, 10);
            console.log(response_json.output + '\n' + response_json.error);
            if (returncode == 0)
                res.redirect('http://localhost:3000/');
            else
                res.redirect('/login');
        });
    });

    request.end();
    
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(2999);
  console.log("Express server listening on port %d", app.address().port);
}
