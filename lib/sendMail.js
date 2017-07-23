var AWS = require ("aws-sdk"); 
var utils = require ("../lib/utils.js");
var ses = new AWS.SES ({
	apiVersion: "2010-12-01",
	region: "us-east-1"
	});

exports.send = sendMail;

function sendMail (recipient, subject, message, sender, callback) {
	var theMail = {
		Source: sender,
		ReplyToAddresses: [sender],
		ReturnPath: sender,
		Destination: {
			ToAddresses: [recipient]
			},
		Message: {
			Body: {
				Html: {
					Data: message
					},
				Text: {
					Data: utils.stripMarkup (message)
					}
				},
			Subject: {
				Data: subject
				}
			},
		};
	ses.sendEmail (theMail, function (err, data) { 
		if (err) {
			console.log ("\nsendMail: err.message == " + err.message);
			}
		else {
			console.log ("\nsendMail: data == " + JSON.stringify (data, undefined, 4));
			}
		});
	}
