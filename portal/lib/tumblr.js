// Include the necessary modules.
var http = require( "http" );
 
 
// ---------------------------------------------------------- //
// ---------------------------------------------------------- //
 
 
// Define the Tumblr RSS URL that we are going to be feeding into
// this site.
var tumblrRSS = "http://blog.vertex.io/rss";
 
// I am the locally cached RSS items.
var rssItems = [];
 
// I am the current index of the RSS items (each request will move
// this index forward one index).
var rssIndex = 0;
 
 
// ---------------------------------------------------------- //
// ---------------------------------------------------------- //
 
 
// I am a place-holder function that does nothing more than provide
// an invocation API (can be used to simplify callback logic).
function noop(){
	// Left intentionally blank.
}
 
 
// I am a helper function that simplifies the HTTP request,
// encapsulating the concatenation of response data packets into
// a single callback.
function httpGet( httpOptions, callback ){
 
	// Make the request with the given options.
	var request = http.request( httpOptions );
 
	// Flush the request (we aren't posting anything to the body).
	request.end();
 
	// Bind to the response event of the outgoing request - this will
	// only fire once when the response is first detected.
	request.on(
		"response",
		function( response ){
 
			// Now that we have a response, create a buffer for our
			// data response - we will use this to aggregate our
			// individual data chunks.
			var fullData = [ "" ];
 
			// Bind to the data event so we can gather the response
			// chunks that come back.
			response.on(
				"data",
				function( chunk ){
 
					// Add this to our chunk buffer.
					fullData.push( chunk );
 
				}
			);
 
			// When the response has finished coming back, we can
			// flatten our data buffer and pass the response off
			// to our callback.
			response.on(
				"end",
				function(){
 
					// Compile our data and pass it off.
					callback( fullData.join( "" ) );
 
				}
			);
 
		}
	);
 
}
 
 
// I load the RSS feed from TUMBLR using Yahoo! Query Language (YQL).
// When the RSS feed has been pulled down (as JSON), it is passed
// off to the callback.
function getRSS( callback ){
 
	// Define the YQL query. Since this is going to become a URL
	// component itself, be sure to escape all the sepcial
	// characters.
	var yqlQuery = encodeURIComponent(
		"SELECT * FROM xml WHERE url = '" +
		tumblrRSS +
		"'"
	);
 
	// Make the request and pass the callback off as the callback
	// we are going to use with the RSS HTTP request.
	httpGet(
		{
			method: "get",
			host: "query.yahooapis.com",
			path: ("/v1/public/yql?q=" + yqlQuery + "&format=json"),
			port: 80
		},
		callback
	);
 
}
 
 
// I load the remote RSS feed locally.
function loadRSS( callback ){
 
	// Get the remote Tumblr RSS data. When it had been loaded,
	// store it locally.
	getRSS(
		function( rssData ){
 
			// Deserialize the RSS JSON.
			var rss = JSON.parse( rssData );
 
			// Make sure that there are RSS items.
			if (
				rss.query.results.rss.channel.item &&
				rss.query.results.rss.channel.item.length
				){
 
				// Copy the RSS items reference to the local
				// collection.
				rssItems = rss.query.results.rss.channel.item;
 
			}
 
			// Whether or not we received any valid RSS items, we've
			// done as much as we can at this point. Invoke the
			// callback.
			(callback || noop)();
 
		}
	);
 
}
 
 
// ---------------------------------------------------------- //
// ---------------------------------------------------------- //
 
 
// I get the next item in the RSS collection (or return null).
function getNextItem(){
 
	// Check to make sure that we have at least one RSS item. If
	// not, then return null.
	if (!rssItems.length){
		return;
	}
 
	// Increment the index - each request further traverses the
	// RSS feed.
	rssIndex++;
 
	// Check the index bounds - if we've gone too far, simply loop
	// back around to zero.
	if (rssIndex >= rssItems.length){
 
		// Loop back around.
		rssIndex = 0;
 
	}
 
	// Return the description of the current item.
	return( rssItems[ rssIndex ].description );
 
}
 
 
// ---------------------------------------------------------- //
// ---------------------------------------------------------- //
 
 
// I initialize the component and return an API for data interaction.
exports.load = function( callback ){
 
	// Create a simple API for our Tumblr service.
	var localAPI = {
		next: getNextItem
	};
 
	// Load the RSS feed (grabs the remote RSS data and caches it
	// locally for serving. Once it has loaded, pass off the local
	// API to the callback. This way, the calling context can use
	// either the RETURN value or the CALLBACK value.
	loadRSS(
		function(){
			(callback || noop)( localAPI );
		}
	);
 
	// Set up an interval to check for a new RSS feed every hour.
	// This will completely replace the locally cached data.
	setInterval(
		loadRSS,
		(1 * 60 * 60 * 1000)
	);
 
	// Return a simple interface to our Tumblr object.
	return( localAPI );
 
};