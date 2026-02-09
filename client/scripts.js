var urlStats = "//s3.amazonaws.com/scripting.com/code/servermonitor/stats.json"; 
var urlServerList = "//s3.amazonaws.com/scripting.com/code/servermonitor/serverlist.json"; 
var ctUpdates = 0;
var stats = undefined;
var urlServerStats = "http://modena.scripting.com:1410/stats"; //used to see if server is alive
var flServerIsAlive = true;

function setFlServerIsAlive () {
	readHttpFileThruProxy (urlServerStats, undefined, function (jsontext) {
		flServerIsAlive = jsontext !== undefined;
		});
	}
function howLongString (when) {
	function firstPart (num) {
		return (stringNthField (num.toString (), ".", 1));
		}
	var secs = firstPart (secondsSince (when));
	var minutes = firstPart (secs / 60);
	var hours = firstPart (minutes / 60);
	var days = firstPart (hours / 24);
	
	var s = secs + " seconds";
	if (minutes > 3) {
		s = minutes + " minutes";
		}
	if (hours > 3) {
		s = hours + " hours";
		}
	if (days > 2) {
		s = days + " days"
		}
	return (s);
	}
function updateServerStatusMsg () {
	function msg (s) {
		if (s != $("#idServerStatusMsg").html ()) {
			$("#idServerStatusMsg").html (s);
			}
		}
	if (flServerIsAlive) {
		if (stats !== undefined) {
			msg ("Server has been been running for: " + howLongString (stats.whenLastServerStart) + ".");
			}
		}
	else {
		msg ("Server is not running.");
		}
	}
function viewTable () {
	var htmltext = "", indentlevel = 0, now = new Date ();
	function add (s) {
		htmltext +=  filledString ("\t", indentlevel) + s + "\n";
		}
	function viewTimeString (when, flbold) {
		if (when === "1970-01-01T00:00:00.000Z") {
			return ("");
			}
		var s = getFacebookTimeString (when);
		if (s == "Just now") {
			s = "now";
			}
		if (flbold) {
			return ("<span class=\"spBold\">" + s + "</span>");
			}
		else {
			return (s);
			}
		}
	function viewNumber (num, flbold) {
		num = Number (num);
		if (num == 0) {
			return ("");
			}
		else {
			if (flbold) {
				return ("<span class=\"spBold\">" + num.toString () + "</span>");
				}
			else {
				return (num.toString ());
				}
			}
		}
	function formatDateTime (d) {
		d = new Date (d);
		return (d.toLocaleDateString () + " at " + d.toLocaleTimeString ());
		}
	console.log ("\nviewTable: " + now.toLocaleTimeString ());
	readHttpFile (urlServerList, function (jsontext) {
		var serverlist = JSON.parse (jsontext);
		function serverStillExists (name) {
			name = name.toLowerCase ();
			for (var x in serverlist.theMachines) {
				if (serverlist.theMachines [x].toLowerCase () == name) {
					return (true);
					}
				}
			return (false);
			}
		console.log ("viewTable: serverlist == " + jsonStringify (serverlist));
		readHttpFile (urlStats, function (jsontext) {
			stats = JSON.parse (jsontext);
			updateServerStatusMsg ();
			console.log ("viewTable: stats == " + jsonStringify (stats));
			
			function addServersTable () {
				add ("<table class=\"table\">"); indentlevel++;
				//header
					add ("<tr>");
					add ("<td><b>Server</b></td>");
					add ("<td><b>Checks</b></td>");
					add ("<td><b>Errors</b></td>");
					add ("<td><b>When</b></td>");
					add ("<td><b>Secs</b></td>");
					add ("<td><b>Machine</b></td>");
					add ("</tr>");
				
				var nameArray = new Array ();
				for (var x in stats.servers) {
					nameArray.push (x);
					}
				nameArray.sort ();
				for (var i = 0; i < nameArray.length; i++) {
					var x = nameArray [i];
					if (serverlist.theList [x] !== undefined) {
						var server = stats.servers [x], flbold = server.ctConsecutiveErrors > 0;
						var url = serverlist.theList [x].url;
						
						add ("<tr>"); indentlevel++;
						add ("<td><a href=\"" + url + "\" target=\"_blank\">" + x + "</a></td>"); 
						add ("<td class=\"tdNum\">" + viewNumber (server.ctChecksToday) + "</td>"); 
						add ("<td class=\"tdNum\">" + viewNumber (server.ctErrorsToday, flbold) + "</td>"); 
						
						//whenLastError
							if ((server.ctErrorsToday > 0) && (sameDay (server.whenLastError, now))) {
								add ("<td class=\"tdNum\">" + viewTimeString (server.whenLastError, flbold) + "</td>"); 
								}
							else {
								add ("<td>&nbsp;</td>"); 
								}
						
						add ("<td class=\"tdNum\">" + viewNumber (server.ctSecsLastCheck) + "</td>"); 
						add ("<td>" + server.serverName + "</td>"); 
						add ("</tr>"); indentlevel--;
						}
					}
				
				add ("</table>"); indentlevel--;
				}
			function addMachinesTable () {
				add ("<table class=\"table machineTable\">"); indentlevel++;
				//header
					add ("<tr>");
					add ("<td><b>Machine</b></td>");
					add ("<td><b>% free</b></td>");
					add ("<td><b>Checks</b></td>");
					add ("<td><b>When</b></td>");
					add ("</tr>");
				
				var nameArray = new Array ();
				for (var x in stats.machines) {
					if (serverStillExists (x)) { //12/11/19 by DW
						nameArray.push (x);
						}
					}
				nameArray.sort ();
				for (var i = 0; i < nameArray.length; i++) {
					var name = nameArray [i];
					var machine = stats.machines [name];
					add ("<tr>"); indentlevel++;
					add ("<td>" + name + "</td>"); 
					add ("<td class=\"tdNum\">" + viewNumber (machine.percent) + "</td>"); 
					add ("<td class=\"tdNum\">" + viewNumber (machine.ctUpdates) + "</td>"); 
					add ("<td>" + viewTimeString (machine.whenLastUpdate) + "</td>"); 
					add ("</tr>"); indentlevel--;
					}
				
				
				
				add ("</table>"); indentlevel--;
				}
			
			addMachinesTable (); //12/6/18 by DW
			addServersTable ();
			
			add ("<div class=\"divLegend\">"); indentlevel++;
			add ("<p><b>" + stats.productName + " v" + stats.version + "</b>.</p>");
			add ("<p>JSON file with <a href=\"" + urlStats + "\" target=\"_blank\">stats</a> and the <a href=\"" + urlServerList + "\" target=\"_blank\">server list</a>.</p>");
			//servername -- 12/24/18 by DW
				var servername = serverlist.theMachines [stats.ipAddressServer]
				if (servername === undefined) {
					servername = stats.ipAddressServer;
					}
				add ("<p>ServerMonitor is running on: " + servername + ".</p>");
			add ("<p>Server has been up since: " + formatDateTime (stats.whenLastServerStart) + ".</p>");
			add ("<p>Last update on server: " + formatDateTime (stats.whenLastSave) + ".</p>");
			add ("<p>Number of times this page has updated: " + ++ctUpdates + ".</p>");
			add ("</div>"); indentlevel--;
			
			$("#idServerMonitorTable").html (htmltext);
			});
		});
	}
function everyMinute () {
	viewTable ();
	setFlServerIsAlive ();
	}
function everySecond () {
	updateServerStatusMsg ();
	}
function startup () {
	console.log ("startup");
	viewTable ();
	setFlServerIsAlive ();
	runEveryMinute (everyMinute);
	self.setInterval (everySecond, 1000); 
	}
