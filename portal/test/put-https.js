var https = require('https');

var testdoc = JSON.stringify({
    "Subject":"I like Plankton",
    "Author":"Rusty",
    "PostedDate":"2006-08-15T17:30:12-04:00",
    "Tags":["plankton", "baseball", "decisions"],
    "Body":"I decided today that I don't like baseball. I like plankton."
});

for (var i=0; i<= 20; i++) {
    var uri = '/db/testapp/testdoc_' + parseInt(Math.random()*1000000, 10);
    console.log(uri);
    console.log(Buffer.byteLength(testdoc));

    var options = {
        'host': 'localhost',
        'port': 443,
        'path': uri,
        'method' : 'PUT',
        headers: {
            'Content-Length': Buffer.byteLength(testdoc),
            'Content-Type': 'application/json',
        }
    };

    var req = https.request(options, function(res) {
    
        resp = '';
            
        res.on("data", function(chunk) {
            //size += Buffer.byteLength(''+chunk);
            resp += chunk;
        });

        res.on("end", function() {
        
            console.log(resp);
        });
    
    });

    req.write(testdoc);
    req.end();
}