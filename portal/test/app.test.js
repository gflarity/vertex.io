// Run $ expresso
/**
 * Module dependencies.
 */

var app = require('../app'),
assert = require('assert');

TESTUSER = "testuser5"
TESTPASS = "omgpass"
TEST_API_KEY = "72f67b798d29896ce49f0bc81c2efb33"
TEST_DB_NAME = "testdb"
AUTH = 'Basic ' + new Buffer(TESTUSER + ':' + TESTPASS).toString('base64');

module.exports = {

    'GET /api/v1/<username>/db/<db>/ with API_KEY': function() {
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/?api_key=' + TEST_API_KEY
        },
        {
            status: 200
        },
        function(res) {
            assert.includes(res.body, "\"db_name\":\"" + TESTUSER + "_" + TEST_DB_NAME + "\"");
        }
        );
    },

    'GET /api/v1/<username>/db/<db>/ with invalid API_KEY': function() {
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/?api_key=' + TEST_API_KEY + 'soijfew'
        },
        {
            status: 400
        },
        function(res) {
            assert.includes(res.body, "Invalid API key");
        });
    },

    'GET /api/v1/<username>/db/<db>/ no API_KEY': function() {
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/'
        },
        {
            status: 302
        },
        function(res) {
            assert.includes(res.body,
            '{"error":"unauthorized","reason":"You are not authorized to access this db."}');
        });
    },

    'GET /api/v1/<username>/db/<db>/_utils with API_KEY': function() {
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/_utils?api_key=' + TEST_API_KEY
        },
        {
            status: 400
        },
        function(res) {
            assert.includes(res.body, "API key access prohibited");
        });
    },

    'PUT /api/v1/<username>/db/<db>/_design/test with API_KEY': function() {
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/_design/noexist?api_key=' + TEST_API_KEY,
            method: 'PUT',
            data: "{ 'test': 1 }"
        },
        {
            status: 400
        },
        function(res) {
            assert.includes(res.body, "API key access prohibited");
        });
    },

    'PUT /api/v1/<username>/db/<db>/_design/test with Basic Auth': function() {

        var test_design_doc = {
            test: 1
        };
        test_design_doc = JSON.stringify(test_design_doc);
        assert.response(app,
        {
            url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/_design/noexist',
            method: 'PUT',
            data: test_design_doc,
            headers: {
                'Authorization': AUTH,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(test_design_doc)
            }
        },
        {
            status: 201
        },
        function(res) {
            //console.log(res.body);
            var rev = JSON.parse(res.body).rev;
            assert.includes(res.body, "\"ok\":true");

            // on success attempt to delete the design doc using API_KEY access
            //'DELETE /api/v1/<username>/<db>/_design/test with API_KEY' : function() {
            assert.response(app,
            {
                url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/_design/noexist?api_key=' + TEST_API_KEY,
                method: 'DELETE'
            },
            {
                status: 400
            },
            function(res) {
                assert.includes(res.body, "API key access prohibited");

                // on test success, actually delete the doc
                //'DELETE /api/v1/<username>/<db>/_design/test with Basic Auth' : function() {
                assert.response(app,
                {
                    url: '/api/v1/' + TESTUSER + '/db/' + TEST_DB_NAME + '/_design/noexist?rev=' + rev,
                    method: 'DELETE',
                    headers: {
                        'Authorization': AUTH
                    }
                },
                {
                    status: 200
                },
                function(res) {
                    assert.includes(res.body, "\"ok\":true");
                });
                //}
            });
            //}
        });
    },

    /*    

 ,*/

};