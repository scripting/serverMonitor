var myProductName = "Server Monitor", myVersion = "0.5.15"; 

const utils = require ("daveutils");
const s3 = require ("daves3");
const davehttp = require ("davehttp"); 
const rss = require ("./lib/rss.js");
const sendMail = require ("./lib/sendmail.js");
const request = require ("request");
const fs = require ("fs");
const os = require ("os");
const dateFormat = require ("dateformat");
const dns = require ("dns");

var stats = {
	productName: myProductName, version: myVersion,
	ctServerStarts: 0, whenLastServerStart: new Date (),
	ctChanges: 0, whenLastChange: new Date (0),
	ctSaves: 0, whenLastSave: new Date (0),
	ctReadListErrors: 0, ctServerReadErrors: 0,  //7/24/16 by DW
	ipAddressServer: undefined, //12/24/18 by DW -- so we can tell where servermonitor is running
	servers: {
		},
	machines: {
		}
	};
var flStatsDirty = false;
var fnameStats = "stats.json";

var servers;
var whenLastEveryMinute = new Date ();
var whenLastSaveStats = new Date ();

var config = {
	s3statspath: "/scripting.com/code/servermonitor/stats.json",
	urlServerList: "http://scripting.com/code/servermonitor/serverlist.json",
	httpServer: {
		port: 1410,
		flAllowAccessFromAnywhere: true
		}
	};
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
			console.log ("checkServer: " + now.toLocaleTimeString () + ", " + theServer.name + " is not OK. err == " + msg);
			if (theStats.ctConsecutiveErrors > 1) { //1/31/19 by DW
				sendMailAboutServer (theServer, msg);
				}
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
					}
				}
			theStats.ctSecsLastCheck = utils.secondsSince (now);
			statsChanged ();
			
			
			var urlparts = utils.urlSplitter (theServer.url), domain = urlparts.host;
			dns.lookup (domain, null, function (err, ip) {
				if (err) {
					console.log ("dns.lookup: err.message == " + err.message);
					}
				else {
					
					if (theMachines [ip] !== undefined) {
						theStats.serverName = theMachines [ip];
						}
					
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
function checkMachine (theMachine) {
	var url = "http://scripting.com/code/freediskspace/data/" + theMachine + ".json";
	request (url, function (err, response, jsontext) {
		try {
			if ((jsontext.length > 0) && (jsontext [0] == "{")) {
				var jstruct = JSON.parse (jsontext);
				if (stats.machines === undefined) {
					stats.machines = {}
					}
				stats.machines [theMachine] = jstruct;
				}
			}
		catch (err) {
			console.log ("checkMachine: err == " + err);
			}
		});
	}
function readConfig (callback) {
	fs.readFile (fnameConfig, function (err, data) {
		if (!err) {
			var jstruct = JSON.parse (data.toString ());
			for (var x in jstruct) {
				config [x] = jstruct [x];
				}
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
			statsChanged ();
			}
		if (callback !== undefined) {
			callback ();
			}
		});
	}
function saveStats (callback) { //2/26/19 by DW
	stats.ctSaves++;
	stats.whenLastSave = new Date ();
	stats.productName = myProductName;
	stats.version = myVersion;
	
	var jsontext = utils.jsonStringify (stats);
	fs.writeFile (fnameStats, jsontext, function (err) {
		if (err) {
			console.log ("saveStats: error writing stats file == " + err.message);
			}
		});
	s3.newObject (config.s3statspath, jsontext, undefined, undefined, function (err, data) {
		if (err) {
			console.log ("saveStats: err == " + utils.jsonStringify (err));
			}
		else {
			}
		});
	}
function startHttpServer () {
	davehttp.start (config.httpServer, function (theRequest) {
		switch (theRequest.lowerpath) {
			case "/stats":
				theRequest.httpReturn (200, "text/plain", utils.jsonStringify (stats));
				break;
			default: 
				theRequest.httpReturn (404, "text/plain", "Not found");
				break;
			}
		});
	}
function everyMinute () {
	var now = new Date ();
	readConfig (function () {
		//rollovers
			if (!utils.sameDay (now, whenLastEveryMinute)) {
				console.log ("everyMinute: " + now.toLocaleString () + ", v" + myVersion); //1/7/22 by DW
				for (x in stats.servers) {
					var server = stats.servers [x];
					server.ctChecksToday = 0;
					server.ctErrorsToday = 0;
					}
				}
			whenLastEveryMinute = now;
		request (config.urlServerList, function (err, response, jsontext) {
			if (err) {
				console.log ("\neveryMinute: error reading serverlist == " + err.message);
				stats.ctReadListErrors++;
				}
			else {
				try {
					var servers = JSON.parse (jsontext);
					for (var x in servers.theList) {
						checkServer (servers.theList [x], servers.theMachines);
						}
					for (var x in servers.theMachines) { //12/6/18 by DW
						checkMachine (servers.theMachines [x]);
						}
					}
				catch (err) {
					stats.ctReadListErrors++;
					}
				}
			});
		});
	}
function everySecond () {
	var now = new Date ();
	if (flStatsDirty) {
		if (utils.secondsSince (whenLastSaveStats) > 3) {
			saveStats ();
			whenLastSaveStats = new Date ();
			flStatsDirty = false;
			}
		}
	}
function getMyIpAddress () { //12/24/18 by DW
	var interfaces = os.networkInterfaces ();
	for (var devName in interfaces) {
		var iface = interfaces [devName];
		for (var i = 0; i < iface.length; i++) {
			var alias = iface [i];
			if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
				return (alias.address);
				}
		}
	return ("0.0.0.0");
	}
function startup () {
	console.log ("\n" + myProductName + " v" + myVersion + ", " + new Date ().toLocaleString ());
	readConfig (function () {
		console.log ("\nstartup: config == " + utils.jsonStringify (config));
		readStats (function () {
			stats.ipAddressServer = getMyIpAddress (); //12/24/18 by DW
			stats.ctServerStarts++;
			stats.whenLastServerStart = new Date ();
			statsChanged ();
			startHttpServer ();
			utils.runEveryMinute (everyMinute);
			setInterval (everySecond, 1000); 
			});
		});
	}
startup ();
