var fuzzy = require('fuzzystringcompare');
var Fifo = require('fifo');

/**
	Amber
	@class Amber
*/
var Amber = {
	/**
		Am Amber Bot.
		@class Bot
		@namespace Amber
		@for Amber
		@constructor
	*/
	Bot:function() {
		var bot = this;
		this._targets = {};
		this._requires = {};
		this._sessions = [];
		/**
			Add a target to the chat bot.
			@method addTarget
			@for Amber.Bot
			@param {Object} params
			@param {String} params.name The name of the target
			@param {Array} params.requires An array of Strings of the required information
				to reach this target.
			@param {Object} [params.beforeRequire] Called before a requirement's `toGet` method 
				is called. Each key is the name of the requirement and each value is a callback with 
				the following arguments.
			@param {Session} params.beforeRequire.session
			@param {Function} params.beforeRequire.callback Call when done.
			@param {Object} [params.beforeRequire.callback.value] A value for the requirement. 
				If a value is passed in, toGet will not be called.
			@param {Function} [params.hasAccess] A function that returns whether the given session 
				has access to this target.
			@param {Session} params.hasAccess.session
			@param {Function} params.onExecute Called when all requirements are met.
			@param {Session} params.onExecute.session
			@param {Function} params.onExecute.callback Call when the target is done executing.
			@param {String} [params.onExecute.callback.next] The next target to path to.
			@example
				{
					name:'greeting',
					requires:['name'],
					onExecute:function(session, callback) {
						session.sendMessage('Hello there, ' + session.get('name'));
						callback();
					}
				}
		*/
		this.addTarget = function(params) {
			bot._targets[params.name] = {
				name:params.name,
				requires:params.requires,
				onExecute:params.onExecute,
				beforeRequire:params.beforeRequire,
				hasAccess:params.hasAccess
			};
		};
		/**
			Add a requirement to the bot.
			@method addRequire
			@param {Object} params
			@param {String} params.name The name of the requirement. To create a persistant requirment (it will not be erased between queries), start the name with a '+'.
			@param {Session} [params.requries] An array of requirements 
				that need to be completed before this requirement can 
				be fulfilled.
			@param {Function} [params.filter] Called when a requirement is met externally.
			@param {String} params.filter.value The value passed in externally to meet the
				requirement.
			@param {Session} params.filter.session
			@param {Object} params.filter.value
			@param {Function} params.filter.callback
			@param {Boolean} params.filter.callback.success Whether this input can 
				successfully meet the requirement.
			@param {Object} params.filter.callback.value The filtered version of the object.
			@param {Function} params.toGet Called to retrieve the value of the requirement.
			@param {Session} params.toGet.session
			@param {Function} params.toGet.callback
			@param {Boolean} params.toGet.callback.success Whether the value was retreived successfully.
				If false, exits the venture for the target.
			@param {Object} params.toGet.callback.value The value of the requirement.
			@example 
				{
					name:'name',
					requires:[],
					filter:function(session, name, callback) {
						callback(true, name);
					},
					toGet:function(session, callback) {
						session.prompt('What is your name?', function(name) {
							callback(true, name);
						});
					}
				}
		*/
		this.addRequire = function(params) {
			bot._requires[params.name] = {
				name:params.name,
				toGet:params.toGet,
				requires:params.requires,
				filter:params.filter
			};
		};
		/**
			Creates a new session.
			@method createSession
			@return {Bot.Session} Returns a new session.
		*/
		this.createSession = function() {
			/**
				A chatbot session, usually representing an instance of chat
				between a user and the chatbot.
				@class Session
				@namespace Amber.Bot
				@for Amber.Bot
			*/
			var session = {
				_navigate:function(target) {
					var target = bot._targets[target];
					if (target != undefined) {
						this._inRoute = true;
						var asyncLoop = function(counter) {
							if (target.requires == undefined || counter == target.requires.length) {
								target.onExecute(session, function(next) {
									bot._onTargetReach(target.name);
									if (next == undefined) {
										session._inRoute = false;
									} else {
										session._navigate(next);
									}
								});
								return;
							}
							var require = bot._requires[target.requires[counter]];
							session._doRequire(target, require, function() {
								asyncLoop(counter + 1);
							});
						}
						asyncLoop(0);
					} else {
						return false;
					}
				},
				_doRequire:function(target, require, callback) {
					var und = false;
					if (typeof require.name == Array) {
						for (var i = 0; i < require.name.length; i++) {
							if (require.name[i] == undefined) {
								und = true;
								break;
							}
						}
					} else {
						und = (session.get(require.name) == undefined);
					}
					var reqLoop = function(counter) {
						if (require.requires == undefined || counter == require.requires.length) {
							var fn = function() {
								require.toGet(session, function(success, value) {
									if (success) {
										if (typeof value == Array) {
											for (var i = 0; i < value.length; i++) {
												session.set(require.name[i], value[i]);
											}
										} else {
											session.set(require.name, value);
										}
										callback();
									} else {
										session._inRoute = false;
									}
								});
							}
							if (target != null && target.beforeRequire != undefined && 
							target.beforeRequire[require.name] != undefined) {
								target.beforeRequire[require.name](session, function(value) {
									if (value !== undefined) {
										if (typeof value == Array) {
											for (var i = 0; i < value.length; i++) {
												session.set(require.name[i], value[i]);
											}
										} else {
											session.set(require.name, value);
										}
										callback();
									} else {
										fn();
									}
								});
							} else {
								fn();
							}
						} else {
							session._doRequire(target, bot._requires[require.requires[counter]], function() {
								reqLoop(counter + 1);
							});
						}
					}
					if (und) {
						reqLoop(0);
					} else {
						callback();
					}
				},
				_data:{},
				/**
					Gets a value stored in the Session.
					@method get
					@for Amber.Bot.Session
					@param {String} key
					@returns {Object} Returns the value paired with the given key
						for this Session.
				*/
				get:function(key) {
					return this._data[key];
				},
				/**
					Set a value in the session.
					@method set
					@param {String} key
					@param {Object} value
				*/
				set:function(key, value) {
					this._data[key] = value;
				},
				/**
					Manually gather a requirement.
					@method getRequire
					@param {String} name
					@param {Function} callback Called when the requirment is obtained.
				*/
				getRequire:function(name, callback) {
					session._doRequire(null, bot._requires[name], callback);
				},
				_inRoute:false,
				_removeData:function() {
					for (var key in session._data) {
						if (key.charAt(0) != '+') {
							session._data[key] = undefined;
						}
					}
				},
				/**
					Method for inputting a message for processing by
					the chatbot
					@method messageReceived
					@param {String} message The message to be processed.
				*/
				messageReceived:function(message) {
					bot._shouldCancel(session, message, function(cancel) {
						if (!cancel) {
							if (!session._inRoute) {
								bot._targetParser(message, function(target, tokens) {
									if (bot._targets[target] != undefined &&
									bot._targets[target].hasAccess != undefined &&
									!bot._targets[target].hasAccess(session)) {
										session._navigate('None');
										return;
									}
									session._removeData();
									var numTokens = Object.keys(tokens).length;
									var numComplete = 0;
									for (var key in tokens) {
										var require = bot._requires[key];
										var value = tokens[key];
										if (require != undefined) {
											var createCallback = function(key) {
												var callback = function(success, filtered) {
													numComplete++;
													if (success) {
														session._data[key] = filtered;
													}
													if (numComplete == numTokens) {
														session._navigate(target);
													}
												};
												return callback;
											}
											if (require.filter != undefined) {
												require.filter(session, value, createCallback(key));
											} else {
												session._identityFilter(session, value, createCallback(key));
											}
										} else {
											numComplete++;
										}
									}
									if (numTokens == 0) {
										session._navigate(target);
									}
								});
							} else {
								if (session._promptData.waiting) {
									session._promptData.waiting = false;
									session._promptData.filter(session, message, function(success, value) {
										if (success) {
											session._promptData.callback(value);
										} else {
											session._promptData.waiting = true;
										}
									});
								}
							}
						} else {
							session._promptData.waiting = false;
							session._inRoute = false;
						}
					});
				},
				/**
					Send a message to this Session
					@method sendMessage
					@param {String} message The message to be sent.
				*/
				sendMessage:function(message) {
					session._messageQueue.push(message);
					if (session._messageQueue.first() == message) {
						bot._messageSender(session, message);
					}
				},
				/**
					Call this method each time a message is successfully sent. This is to ensure 
						messages are sent in order.
					@method messageSent
				*/
				messageSent:function() {
					session._messageQueue.shift();
					var next = session._messageQueue.first();
					if (next != null) {
						bot._messageSender(session, next);
					}
				},
				_messageQueue:Fifo(),
				_promptData:{
					callback:undefined,
					filter:null,
					data:null,
					waiting:false
				},
				_identityFilter:function(session, value, callback) {
					callback(true, value);
				},
				_selectionFilter:function(session, message, callback) {
					var index = parseInt(message);
					if (!isNaN(index) && index > 0 && index <= session._promptData.data.length) {
						callback(true, parseInt(message) - 1);
						return;
					}
					var closest = Amber.utils.getClosestOption(message, session._promptData.data);
					if (closest != Amber.utils.AMBIGUOUS && closest != Amber.utils.NOT_AN_OPTION) {
						callback(true, closest.index);
						return;
					} else {
						if (closest == Amber.utils.AMBIGUOUS) {
							session.sendMessage(bot._ambiguousMessage);
						}
						callback(false);
						return;
					}
				},
				_numberFilter:function(session, message, callback) {
					if (!isNaN(parseFloat(message))) {
						callback(true, parseFloat(message));
						return;
					} else {
						session.sendMessage(bot._notANumber);
						callback(false);
						return;
					}
				},
				/**
					A basic asynchronous prompt for information from the user.
					@method prompt
					@param {String} message Message to send (usually asking
						the user a question). If message is a null, it won't send 
						a message.
					@param {Function} callback The callback is called with a String argument
						containing the user's response.
				*/
				prompt:function(message, callback) {
					session._promptData.filter = session._identityFilter;
					session._promptData.callback = callback;
					session._promptData.waiting = true;
					if (message != null) {
						session.sendMessage(message);
					}
				},
				/**
					A prompt asking the user to choose from a selection of 
					choices. The user can respond by typing the index of
					the choice (indexed by 1) or by typing the choice itself.
					The choice with the shorted Levenshtein distance will be
					chosen.
					@method selectionPrompt
					@param {String} message Message to send (usually asking
						the user a question). If message is a null, it won't send 
						a message.
					@param {Array} options An array of strings representing
						the users options.
					@param {Boolean} [showMessage=true] Show the options to the user?
					@param {Function} callback The callback is called with an integer
						argument representing the index of the chosen option.
				*/
				selectionPrompt:function(message, options, p1, callback) {
					var showMessage = p1;
					if (callback == undefined) {
						callback = p1;
						showMessage = true;
					}
					session._promptData.filter = session._selectionFilter;
					session._promptData.callback = callback;
					session._promptData.data = options;
					session._promptData.waiting = true;
					if (message != null) {
						session.sendMessage(message);
					}
					if (showMessage) {
						session.sendMessage(bot._selectionMessage(options));
					}
				},
				/**
					An asynchronous prompt for numerical information from the user. Responses
					will be validated and if the user does not provide a numerical answer, 
					they will be prompted with a message and asked for another answer. This prompt
					can be set using Bot.setNotANumberMessage(message)
					@method numberPrompt
					@param {String} message Message to send (usually asking
						the user a question). If message is a null, it won't send 
						a message.
					@param {Function} callback The callback is called with a numerical argument
						containing the user's response.
				*/
				numberPrompt:function(message, callback) {
					session._promptData.filter = session._numberFilter;
					session._promptData.callback = callback;
					session._promptData.waiting = true;
					if (message != null) {
						session.sendMessage(message);
					}
				},
				/**
					A custom prompt.
					@method customPrompt
					@param {String} message Message to send (usually asking
						the user a question). If message is a null, it won't send 
						a message.
					@param {Function} filter
					@param {Session} filter.session
					@param {String} filter.message
					@param {Function} filter.callback
					@param {Boolean} filter.callback.success Is the message satisfactory?
					@param {Object} filter.callback.value The filtered value
					@example
						function filter(session, message, callback) {
							if (!isNaN(parseFloat(message))) {
								callback(true, parseFloat(message));
							} else {
								callback(false);
							}
						}
					@params {Function} callback The callback is called with an argument
						containing the user's filtered response.
				*/
				customPrompt:function(message, filter, callback) {
					session._promptData.waiting = true;
					session._promptData.filter = filter;
					session._promptData.callback = callback;
					if (message != null) {
						session.sendMessage(message);
					}
				}
			};
			return session;
		};
		this._messageSender = function(session, message) {
			console.log(message);
		};
		/**
			Set the callback for sending messages to the user.
			@method setMessageSender
			@for Amber.Bot
			@param {Function} sender `sender(session, message)` A callback
				that is passed a Session and the message to send.
		*/
		this.setMessageSender = function(sender) {
			this._messageSender = sender;
		};
		this._targetParser = function(message, callback) {
			callback(null);
		};
		/**
			Set the method that turns messages into targets.
			@method setTargetParser
			@param {Function} parser `parser(message, callback)` A callback 
				that is passed a message. When the target has been identified,
				call the callback with the target as an argument.
			@example
				bot.setTargetParser(function(message, callback) {
					if (message == 'hello') {
						callback('greeting', {});
					} else if (message == 'hello. my name is bob.') {
						callback('greeting', {'name':'bob'});
					} else {
						callback('none', {});
					}
				});
		*/
		this.setTargetParser = function(parser) {
			bot._targetParser = parser;
		};
		/**
			The default selection message renderer for convenience.
			@method defaultSelectionMessage
			@param {Array} options
			@return {String} The message
		*/
		this.defaultSelectionMessage = function(options) {
			var message = '';
			for (var i = 0; i < options.length; i++) {
				message += (i + 1) + ') ' + options[i];
				if (i < options.length - 1) {
					message += '\n';
				}
			}
			return message;
		};
		this._selectionMessage = this.defaultSelectionMessage;
		/**
			Set a custom selection message to present choices to users.
			@method setSelectionMessage
			@param {Function} f `f(options)` A callback that is passed the options and returns
				a String representation.
		*/
		this.setSelectionMessage = function(f) {
			bot._selectionMessage = f;
		};
		this._onTargetReach = function(target) {
			
		},
		/**
			Set a listener for reaching targets.
			@method setOnTargetReach
			@param {Function} f
			@param {String} f.target
		*/
		this.setOnTargetReach = function(f) {
			bot._onTargetReach = f;
		}
		/**
			Sets a method to decide if the current message received from 
				the user will cancel it.
			@method setCancelListener
			@param {Function} f
			@param {Session} session
			@param {String} message
			@param {Function} f.callback
			@param {Boolean} f.callback.cancel
		*/
		this.setCancelListener = function(f) {
			bot._shouldCancel = f;
		}
		this._shouldCancel = function(session, message, callback) {
			callback(false);
		}
		this._notANumber = 'Please enter a number!';
		this._notADate = 'Please enter a date!';
		this._ambiguousMessage = 'Please be more specific.';
		/**
			Set a message to be sent to the user when their answer to a
			Session.numberPrompt is not numerical
			@method setNotANumberMessage
			@param {String} message Message to send
		*/
		this.setNotANumberMessage = function(msg) {
			bot._notANumber = msg;
		};
		/**
			Set a message to be sent to the user when their answer to a
			Session.datePrompt is not a date
			@method setNotADateMessage
			@param {String} message Message to send
		*/
		this.setNotADateMessage = function(msg) {
			bot._notADate = msg;
		};
		/**
			Set a message to be sent to the user when their answer to a
			Session.selectionPrompt is ambiguous
			@method setAmbiguousMessage
			@param {String} message Message to send
		*/
		this.setAmbiguousMessage = function(msg) {
			bot._ambiguousMessage = msg;
		};
	},
	/**
		Utility module
		@class utils
		@for Amber
		@namespace Amber
	*/
	utils:{
		/**
			Gets the option with the highest similiarity.
			@method getClosestOption
			@for Amber.utils
			@param {String} input An input string
			@param {Array} options An array of Strings
			@returns {Object} returns
				`{
					index:0,
					similarity:4
				}`
				if the similarity rating is over the threshold set by
				`Amber.utils.setOptionDistanceThreshold`.
				If not, returns either `Amber.utils.AMBIGUOUS` or `Amber.utils.NOT_AN_OPTION`.
		*/
		getClosestOption:function(input, options) {
			for (var i = 0; i < options.length; i++) {
				options[i] = options[i].toString();
			}
			var maxIndex = 0;
			var values = [];
			var maxValue = fuzzy.similarity(options[0], input);
			values.push(maxValue);
			for (var i = 1; i < options.length; i++) {
				var dist = fuzzy.similarity(options[i], input);
				if (dist > maxValue) {
					maxValue = dist;
					maxIndex = i;
					if (maxValue == 1.0) {
						break;
					}
				}
				values.push(dist);
			}
			//console.log(values);
			for (var i = 0; i < values.length; i++) {
				if (i != maxIndex) {
					if (values[i] > Amber.utils._optionDistance && (values[i] == 1 || maxValue != 1)) {
						return Amber.utils.AMBIGUOUS;
					}
				}
			}
			if (maxValue > Amber.utils._optionDistance) {
				return {
					index:maxIndex,
					similarity:maxValue
				};
			}
			return Amber.utils.NOT_AN_OPTION;
		},
		_optionDistance:0.2,
		AMBIGUOUS:'ambiguous',
		NOT_AN_OPTION:'not_an_option',
		/**
			Set the threshold similarity for getClosestOption.
			@method setOptionDistanceThreshold
			@param {Number} threshold
		*/
		setOptionDistanceThreshold:function(threshold) {
			Amber.utils._optionDistance = threshold;
		}
	}
};

module.exports = Amber;