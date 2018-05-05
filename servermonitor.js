var myProductName = "Server Monitor", myVerion = "0.5.0";


var request = require ("request");
var fs = require ("fs");
var utils = require ("./lib/utils.js");
var s3 = require ("./lib/s3.js");
var rss = require ("./lib/rss.js");
var dateFormat = require ("dateformat");
var dns = require ("dns");
var sendMail = require ("./lib/sendmail.js");

var stats = {
	productName: myProductName, version: myVerion,
	ctServerStarts: 0, whenLastServerStart: new Date (0),
	ctChanges: 0, whenLastChange: new Date (0),
	ctSaves: 0, whenLastSave: new Date (0),
	ctReadListErrors: 0, ctServerReadErrors: 0,  //7/24/16 by DW
	servers: {
		}
	};
var flStatsDirty = false;
var fnameStats = "stats.json";
var s3statspath = "/fargo.io/testing/servermonitor/stats.json";
var flEveryMinuteScheduled = false;

var urlServerList = "http://fargo.io/testing/servermonitor/serverlist.json"; 
var servers;
var whenLastEveryMinute = new Date ();

var config = {};
var whenLastEmailSent = new Date (0), minSecsBetwEmails = 30 * 60; //at most one email every half hour
var fnameConfig = "config.json";
const connectionRefusedMsg = "connect ECONNREFUSED";

function sendMailAboutServer (theServer, message) {
	if ((config.emailSendTo !== undefined) && (config.emailSendTo !== undefined)) {
		if (utils.secondsSince (whenLastEmailSent) > minSecsBetwEmails) {
			try {
				var emailtext = "<p>There was a problem with a server: \"" + theServer.name + "\". </p><p>Message: \"" + message + "\"</p><p>To find out more visit http://sm.scripting.com/ </p>";
				whenLastEmailSent = new Date ();
				sendMail.send (config.emailSendTo, "serverMonitor problem", emailtext, config.emailSendFrom, function () {
					});
				}
			catch (err) {
				console.log ("sendMailAboutServer: error sending mail == " + err.message);
				}
			}
		}
	}
function statsChanged () {
	stats.ctChanges++;
	stats.whenLastChange = new Date ();
	flStatsDirty = true;
	}
function checkServer (theServer, theMachines, callback) {
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
		function reportError (msg) {
			theStats.ctErrors++;
			theStats.ctConsecutiveErrors++;
			theStats.ctErrorsToday++;
			theStats.whenLastError = now;
			console.log (theServer.name + " is not OK. err == " + msg);
			sendMailAboutServer (theServer, msg);
			}
		try {
			if (err) {
				reportError (err.message);
				}
			else {
				if (utils.beginsWith (s, connectionRefusedMsg)) {
					reportError (connectionRefusedMsg);
					}
				else {
					theStats.ctConsecutiveErrors = 0;
					console.log (theServer.name + " is OK.");
					}
				
				
				}
			theStats.ctSecsLastCheck = utils.secondsSince (now);
			statsChanged ();
			
			var urlparts = utils.urlSplitter (theServer.url), domain = urlparts.host;
			dns.lookup (domain, null, function (err, ip) {
				if (!err) {
					theStats.serverName = theMachines [ip];
					statsChanged ();
					}
				});
			if (callback !== undefined) {
				callback ();
				}
			}
		catch (err) {
			stats.ctServerReadErrors++;
			}
		});
	}

function readConfig (callback) {
	fs.readFile (fnameConfig, function (err, data) {
		if (!err) {
			config = JSON.parse (data.toString ());
			}
		if (callback !== undefined) {
			callback ();
			}
		});
	}
function readStats (callback) {
	fs.readFile (fnameStats, function (err, data) {
		if (!err) {
			stats = JSON.parse (data.toString ());
			if (stats.ctReadListErrors === undefined) { //7/24/16 by DW
				stats.ctReadListErrors = 0;
				}
			if (stats.ctServerReadErrors === undefined) { //7/24/16 by DW
				stats.ctServerReadErrors = 0;
				}
			stats.ctServerStarts++;
			stats.whenLastServerStart = new Date ();
			statsChanged ();
			}
		if (callback !== undefined) {
			callback ();
			}
		});
	}


function everyMinute () {
	var now = new Date ();
	readConfig (function () {
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
		try {
			request (urlServerList, function (err, response, jsontext) {
				if (err) {
					console.log ("\neveryMinute: error reading serverlist == " + err.message);
					stats.ctReadListErrors++;
					}
				else {
					var servers = JSON.parse (jsontext);
					for (var x in servers.theList) {
						checkServer (servers.theList [x], servers.theMachines);
						}
					}
				});
			}
		catch (err) {
			stats.ctReadListErrors++;
			}
		});
	}
function everySecond () {
	var now = new Date ();
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
	if (!flEveryMinuteScheduled) {
		if (now.getSeconds () == 0) {
			flEveryMinuteScheduled = true;
			setInterval (everyMinute, 60000); 
			everyMinute (); //do one right now
			}
		}
	}
function startup () {
	console.log ("\n" + myProductName + " v" + myVerion);
	readConfig (function () {
		console.log ("\nstartup: config == " + utils.jsonStringify (config));
		readStats (function () {
			everyMinute ();
			setInterval (everySecond, 1000); 
			});
		});
	}
startup ();
