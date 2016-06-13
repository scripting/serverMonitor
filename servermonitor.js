var myProductName = "Server Monitor", myVerion = "0.40g";


var request = require ("request");
var fs = require ("fs");
var utils = require ("./lib/utils.js");
var s3 = require ("./lib/s3.js");
var rss = require ("./lib/rss.js");
var dateFormat = require ("dateformat");

var stats = {
	productName: myProductName, version: myVerion,
	ctServerStarts: 0, whenLastServerStart: new Date (0),
	ctChanges: 0, whenLastChange: new Date (0),
	ctSaves: 0, whenLastSave: new Date (0),
	servers: {
		}
	};
var flStatsDirty = false;
var fnameStats = "stats.json";
var s3statspath = "/fargo.io/testing/servermonitor/stats.json";

var urlServerList = "http://fargo.io/testing/servermonitor/serverlist.json"; 
var servers;
var whenLastEveryMinute = new Date ();

function statsChanged () {
	stats.ctChanges++;
	stats.whenLastChange = new Date ();
	flStatsDirty = true;
	}
function checkServer (theServer, callback) {
	var theStats = stats.servers [theServer.name], now = new Date ();
	if (theStats === undefined) {
		theStats = {
			ctChecks: 0, ctChecksToday: 0,
			whenLastCheck: new Date (0),
			ctErrors: 0, ctConsecutiveErrors: 0, ctErrorsToday: 0,
			whenLastError: new Date (0),
			ctSecsLastCheck: 0
			};
		stats.servers [theServer.name] = theStats;
		}
	if (theStats.ctChecksToday === undefined) {
		theStats.ctChecksToday = 0;
		}
	if (theStats.ctErrorsToday === undefined) {
		theStats.ctErrorsToday = 0;
		}
	theStats.ctChecks++;
	theStats.ctChecksToday++;
	theStats.whenLastCheck = now;
	statsChanged ();
	request (theServer.url, function (err, response, s) {
		if (err) {
			theStats.ctErrors++;
			theStats.ctConsecutiveErrors++;
			theStats.ctErrorsToday++;
			theStats.whenLastError = now;
			console.log (theServer.name + " is not OK. err == " + err.message);
			}
		else {
			theStats.ctConsecutiveErrors = 0;
			console.log (theServer.name + " is OK.");
			}
		theStats.ctSecsLastCheck = utils.secondsSince (now);
		statsChanged ();
		if (callback !== undefined) {
			callback ();
			}
		});
	}
function everySecond () {
	if (flStatsDirty) {
		stats.ctSaves++;
		stats.whenLastSave = new Date ();
		stats.productName = myProductName;
		stats.version = myVerion;
		
		var jsontext = utils.jsonStringify (stats);
		fs.writeFile (fnameStats, jsontext, function (err) {
			if (err) {
				console.log ("everySecond: error writing stats file == " + err.message);
				}
			});
		s3.newObject (s3statspath, jsontext);
		flStatsDirty = false;
		}
	}
function everyMinute () {
	var now = new Date ();
	console.log ("\neveryMinute: " + now.toLocaleTimeString () + ", v" + myVerion);
	//rollovers
		if (!utils.sameDay (now, whenLastEveryMinute)) {
			for (x in stats.servers) {
				var server = stats.servers [x];
				server.ctChecksToday = 0;
				server.ctErrorsToday = 0;
				}
			}
		whenLastEveryMinute = now;
	request (urlServerList, function (err, response, jsontext) {
		if (err) {
			console.log ("\neveryMinute: error reading serverlist == " + err.message);
			}
		else {
			var servers = JSON.parse (jsontext);
			for (var x in servers.theList) {
				checkServer (servers.theList [x]);
				}
			}
		});
	}
function startup () {
	console.log ("\n" + myProductName + " v" + myVerion);
	fs.readFile (fnameStats, function (err, data) {
		if (!err) {
			stats = JSON.parse (data.toString ());
			}
		
		stats.ctServerStarts++;
		stats.whenLastServerStart = new Date ();
		statsChanged ();
		
		everyMinute ();
		setInterval (everySecond, 1000); 
		setInterval (everyMinute, 60000); 
		});
	}
startup ();
