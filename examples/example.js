var Amber = require('amberchat');

/*
	We create a new Amber.Bot() and a new sesison.
*/

var bot = new Amber.Bot();
var session = bot.createSession();

var request = require('request');

bot.setTargetParser(function(message, callback) {
	request('LUIS ENDPOINT HERE&q=' + encodeURIComponent(message), function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var response = JSON.parse(body);
			var target = response.intents[0].intent;
			var entities = response.entities;
			var tokens = {};
			for (var i = 0; i < entities.length; i++) {
				var key = entities[i].type;
				var value = entities[i].entity;
				tokens[key] = value;
			}
			callback(target, tokens);
		}
	});
});

bot.addRequire({
	name:'name',
	filter:function(session, name, callback) {
		/*
			Everything is passed in as plain text. This function
			takes a proposed name, converts it to the proper format
			(in this case, the same format), and returns that indeed, 
			we have fulfilled this requirement.
		*/
		callback(true, name);
	},
	toGet:function(session, callback) {
		/*
			This is called if Amber is missing some required requirement.
			In here, we prompt the user for their name and then
			return that yes, the requirement is fulfilled by name.
		*/
		session.prompt('What is your name?', function(name) {
			callback(true, name);
		});
	}
});

bot.addTarget({
	name:'greeting',
	requires:['name'],
	onExecute:function(session, callback) {
		/*
			We are guaranteed at this point to have 
			the user's name. We send a message to the user
			using their name and then return out of this target.
		*/
	    session.sendMessage('Well, hello there ' + session.get('name') + '!');
	    callback();
	}
});

bot.addTarget({
	name:'None',
	onExecute:function(session, callback) {
		/*
			Default target because this is what LUIS sends 
			everything else to.
		*/
	    session.sendMessage("I don't understand what you are trying to say.");
	    callback();
	}
});


/*
	These functions set our bot up to take input and output in terminal. Coding for Slack,
	for instance, is similar.
*/

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function input() {
	rl.question('', function(answer) {
		session.messageReceived(answer);
		input();
	});
}
input();

bot.setMessageSender(function(session, message) {
	console.log(message);
	session.messageSent();
});