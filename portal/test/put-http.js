var http = require('http');

var testdoc = JSON.stringify({
    "Subject":"I like Plankton",
    "Author":"Rusty",
    "PostedDate":"2006-08-15T17:30:12-04:00",
    "Tags":["plankton", "baseball", "decisions"],
    "Body":"I decided today that I don't like baseball. I like plankton."
});

var client = http.createClient(5984, 'localhost'); 
var auth = 'Basic ' + new Buffer('steve:password').toString('base64');

for (var i=0; i<= 1; i++) {
    var uri = '/vio_usage/testdoc_' + parseInt(Math.random()*1000000, 10);
    console.log(uri);
    console.log(Buffer.byteLength(testdoc));

    var req = client.request('PUT', uri, {
        'Content-Length': Buffer.byteLength(testdoc),
        'Content-Type': 'application/json',
        'Authorization' : auth
    });

    req.addListener('response', function(res) {
    
        resp = '';
            
        res.addListener("data", function(chunk) {
            //size += Buffer.byteLength(''+chunk);
            resp += chunk;
        });

        res.addListener("end", function() {
        
            console.log(resp);
        });
    
    });

    req.write(testdoc);
    req.end();
}