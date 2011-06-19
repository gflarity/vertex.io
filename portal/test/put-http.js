var http = require('http');

var testdoc = JSON.stringify({
    "Subject":"I like Plankton",
    "Author":"Rusty",
    "PostedDate":"2006-08-15T17:30:12-04:00",
    "Tags":["plankton", "baseball", "decisions"],
    "Body":"I decided today that I don't like baseball. I like plankton."
});

var TOTAL = 30;
console.log(Buffer.byteLength(testdoc)*TOTAL);

var client = http.createClient(80, 'localhost'); 
var auth = 'Basic ' + new Buffer('steve:password').toString('base64');
var total_out = 0;

for (var i=0; i< TOTAL; i++) {
    var uri = '/db/testapp/testdoc_' + parseInt(Math.random()*1000000, 10);
    //console.log(uri);
    //console.log(Buffer.byteLength(testdoc));

    var req = client.request('PUT', uri, {
        'Content-Length': Buffer.byteLength(testdoc),
        'Content-Type': 'application/json',
        'Authorization' : auth
    });

    req.addListener('response', function(res) {
    
        resp = '';
            
        res.addListener("data", function(chunk) {
            total_out += Buffer.byteLength(''+chunk);
            resp += chunk;
        });

        res.addListener("end", function() {
        
            console.log(resp);
            console.log(total_out);
        });
    
    });

    req.write(testdoc);
    req.end();
}