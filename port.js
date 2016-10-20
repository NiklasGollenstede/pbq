(function(global) { 'use strict'; const factory = function es6lib_port(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Wrapper class for browser WebSockets, node js Streams, web-extension runtime.Ports and similar ports,
 * to provide a more high level API with requests to named handlers and Promises to their replies.
 */
const Port = class Port {

	/**
	 * Takes one end of a communication channel and prepares it to send and receive requests.
	 * @param  {object}  port     The low-level port object that is connected to the communication channel.
	 * @param  {class}   adapter  Optional. A simple adapter class to provide a common interface for different types of low level ports.
	 *                            This can ether be one of
	 *                                Port.web_Port         for  browser MessageChannels and WebSockets,
	 *                                Port.web_ext_Port     for  (browser/chrome).runtime.Port object in Chromium, Firefox and Opera extensions,
	 *                                Port.web_ext_Runtime  for  browser.runtime/tabs.on/sendMessage API in Firefox extensions (in Chromium and Opera this needs to be Promise-wrapped),
	 *                                Port.node_Stream      for  node js DuplexSteams,
	 *                            or any other class that implements the PortAdapter interface.
	 *                            Defaults to Port.web_Port, so that browser and node js 'ws' WebSockets and MessageChannels can be handled.
	 * @return {Port}             The new Port instance.
	 */
	constructor(port, adapter = Port.web_Port) {
		const self = new _Port(this, port, adapter);
	}

	/**
	 * Adds a named message handler.
	 * @param  {string}    name     Optional. Non-empty name of this handler which can be used
	 *                              by .request() and .post() to call this handler. defaults to `handler`.name.
	 * @param  {function}  handler  The handler function. It will be called with JSON-clones of all additional arguments
	 *                              provided to .request() or .post() and may return a Promise to asynchronously return a value.
	 * @param  {any}       thisArg  `this` to pass to the handler when called.
	 * @return {MessageHandler}     Self reference for chaining.
	 * @throws {Error}              If there is already a handler registered for `name`.
	 */
	addHandler(/*name, handler, thisArg*/) {
		const self = Self.get(this);
		self.addHandler(...arguments);
		return this;
	}

	/**
	 * Adds multiple named message handlers.
	 * @param  {string}        prefix    Optional prefix to prepend to all handler names specified in `handlers`.
	 * @param  {object|array}  handlers  Ether an array of named functions or an object with methods. Array entries / object properties that are no functions will be ignores.
	 * @param  {any}           thisArg   Optional. `this` to pass to the handler when called. Defaults to `handlers` argument in undefined.
	 * @return {MessageHandler}          Self reference for chaining.
	 * @throws {Error}                   If there is already a handler registered for any `prefix` + handler.name; no handlers have been added.
	 */
	addHandlers(/*prefix, handlers, thisArg*/) {
		const self = Self.get(this);
		self.addHandlers(...arguments);
		return this;
	}

	/**
	 * Removes a named handler.
	 * @param  {string}         name  The name of the handler to be removed.
	 * @return {MessageHandler}       Self reference for chaining.
	 */
	removeHandler(name) {
		const self = Self.get(this);
		self.handlers.delete(name);
		return this;
	}

	/**
	 * Queries the existence of a named handler.
	 * @param  {string}  name  The name of the handler to query.
	 * @return {bool}          true iff a handler is listening on this port.
	 */
	hasHandler(name) {
		const self = Self.get(this);
		return self.handlers.has(name);
	}

	/**
	 * Calls a handler on the other end of this port and returns a Promise to its return value.
	 * @param  {object}  options  Optional, may be omitted. If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 * @return {Promise}          Promise that rejects if the request wasn't handled or if the handler threw
	 *                            and otherwise resolves to the handlers return value.
	 */
	request(/*name, ...args*/) {
		const self = Self.get(this);
		return self.request(...arguments);
	}

	/**
	 * Calls a handler on the other end of this port without waiting for its return value and without guarantee that a handler has in fact been called.
	 * @param  {object}  options  Optional, may be omitted. If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 */
	post(/*name, ...args*/) {
		const self = Self.get(this);
		self.post(...arguments);
		return this;
	}

	/**
	 * Destroys the Port instance and the underlying PortAdapter.
	 * Gets automatically called when the underlying port closes.
	 * After the instance is destroyed, all other methods on this instance will throw. Any further calls to .destroy() will be ignored.
	 * @return {[type]} [description]
	 */
	destroy() {
		const self = Self.get(this);
		self && self.destroy();
	}
};

/**
 * Interface class that can be implemented to provide compatibility for low level ports that don't work with any of the predefined adapters.
 * The implementation can be freely chosen as long as the interface matches the specification below.
 */
class PortAdapter {

	/**
	 * The constructor gets called with three arguments.
	 * @param  {any}       port    The value that was passed as the first argument to the new Port() call where this class was the second argument.
	 *                             Should be the low level port object.
	 * @param  {function}  onData  Function that gets called exactly once for every call to .send() on the other end of the channel.
	 *                             The arguments must be JSON clones of the arguments provided to .call().
	 * @param  {function}  onEnd   Function that should be called at least once when the underlying port closes.
	 * @return {object}            Any object with .send() and .destroy() methods as specified below.
	 */
	constructor(port, onData = (name, id, args) => { }, onEnd = () => { }) { }

	/**
	 * Needs to serialize and send it's arguments to make them available to the onData() callback on the other end of the channel.
	 * @param  {string}   name     Arbitrary utf8 string.
	 * @param  {number}   id       A 64-bit float.
	 * @param  {Array}    args     Array of object that should be JSONable.
	 * @param  {object}   options  The options object passed as the first argument to Port.send/post(), or null.
	 */
	send(name, id, args, options) { }

	/**
	 * Gets called exactly once when the Port object gets .destroy()ed.
	 * Should close the underlying connection if it is still open.
	 * Will be called during or after the onEnd() callback.
	 * The call to .destroy() will be the last access of this object made by the Port instance that created it.
	 */
	destroy() { }
}

///////// start of private implementation /////////

/**
 * PortAdapter implementation to wrap MessageChannels and WebSockets.
 */
Port.web_Port = class web_Port /*implements PortAdapter*/ {

	constructor(port, onData, onEnd) {
		this.port = port;
		port.onmessage = ({ data, }) => onData.apply(null, JSON.parse(data));
		port.onclose = () => onEnd();
	}

	send(name, id, args) {
		this.port.send(JSON.stringify([ name, id, args, ]));
	}

	destroy() {
		this.port.onmessage = null;
		this.port.onclose = null;
		this.port.close();
	}
};

/**
 * PortAdapter implementation to wrap (browser/chrome).runtime.Port object in Chromium, Firefox and Opera extensions.
 */
Port.web_ext_Port = class web_ext_Port /*implements PortAdapter*/ {

	constructor(port, onData, onEnd) {
		this.port = port;
		port.onMessage.addListener(this.onData = data => onData.apply(null, data));
		port.onDisconnect.addListener(this.onEnd = () => onEnd());
	}

	send(name, id, args) {
		this.port.postMessage([ name, id, args, ]);
	}

	destroy() {
		this.port.onMessage.removeListener(this.onData);
		this.port.onDisconnect.removeListener(this.onEnd);
		this.port.disconnect();
	}
};

/**
 * PortAdapter implementation to wrap (browser/chrome).runtime.Port object in Chromium, Firefox and Opera extensions.
 */
Port.web_ext_Runtime = class web_ext_Runtime /*implements PortAdapter*/ {

	constructor(api, onData) {
		this.api = api;
		this.onData = (data, sender, reply) => onData(...data, sender, (...args) => reply(args)) !== false;
		api.runtime.onMessage.addListener(this.onData);
		this.sendMessage = api.runtime.sendMessage;
		this.sendMessageTab = api.tabs ? api.tabs.sendMessage : () => { throw new Error(`Can't send messages to tabs (from within a tab)`); };
	}

	send(name, id, args, tab) {
		let promise;
		if (tab !== null) {
			const { tabId, frameId, } = tab;
			promise = this.sendMessageTab(tabId, [ name, id, args, ], frameId ? { frameId, } : { });
		} else {
			promise = this.sendMessage([ name, id, args, ]);
		}
		if (id === 0) { return; } // is post
		promise.then(this.onData).catch(error => this.onData('', -id, [ error, ]));
	}

	destroy() {
		this.api.runtime.onMessage.removeListener(this.onData);
	}
};

/**
 * PortAdapter implementation to wrap node js DuplexSteams.
 * Calls onEnd() from both 'end' and 'close' events.
 */
Port.node_Stream = class node_Stream /*implements PortAdapter*/ {

	constructor(port, onData, onEnd) {
		this.port = port;
		port.on('data', this.onData = data => onData.apply(null, JSON.parse(data.toString('utf8'))));
		port.once('end', this.onEnd = () => onEnd());
		port.once('close', this.onEnd);
	}

	send(name, id, args) {
		this.port.write(JSON.stringify([ name, id, args, ]), 'utf8');
	}

	destroy() {
		this.port.removeListener('data', this.onData);
		this.port.removeListener('end', this.onEnd);
		this.port.removeListener('close', this.onEnd);
		this.port.end();
	}
};

// holds references between public interface and private implementation
const Self = new WeakMap;

// private implementation class
class _Port {
	constructor(self, port, adapter) {
		this.port = new adapter(port, onData.bind(this), onEnd.bind(this));
		this.requests = new Map; // id ==> PromiseCapability
		this.handlers = new Map; // name ==> [ function, thisArg, ]
		this.lastId = 0;
		Self.set(this, self);
		Self.set(self, this);
	}
	nextId() { return ++this.lastId; }

	addHandler(name, handler, thisArg) {
		if (arguments.length === 1) { handler = name; name = handler.name; }
		if (!name || typeof name !== 'string') { throw new TypeError(`Handler names must be non-empty strings`); }
		if (typeof handler !== 'function') { throw new TypeError(`Message handlers must be functions`); }
		if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
		this.handlers.set(name, [ handler, thisArg, ]);
	}
	addHandlers(prefix, handlers, thisArg) {
		if (arguments.length === 1) { handlers = prefix; prefix = ''; }
		if (typeof prefix !== 'string') {
			if (typeof prefix === 'object') {
				prefix = '';
				handlers = arguments[0];
				thisArg = arguments[1] !== undefined ? arguments[1] : arguments[0];
			} else {
				throw new TypeError(`Handler name prefixes must be strings (or omitted)`);
			}
		} else if (typeof handlers !== 'object') {
			throw new TypeError(`'handlers' argument must be an object (or Array)`);
		} else {
			thisArg === undefined && (thisArg = handlers);
		}

		const add = (
			Array.isArray(handlers)
			? handlers.map(f => [ f.name, f, ])
			: Object.keys(handlers).map(k => [ k, handlers[k], ])
		).filter(([ , f, ]) => typeof f === 'function');
		add.forEach(([ name, handler, ]) => {
			if (!name || typeof name !== 'string') { throw new TypeError(`Handler names must be non-empty strings`); }
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
		});
		add.forEach(([ name, handler, ]) => this.handlers.set(prefix + name, [ handler, thisArg, ]));
	}
	request(name, ...args) {
		const request = new PromiseCapability;
		const id = this.nextId();
		this.requests.set(id, request);
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		this.port.send(name, id, args, options);
		return request.promise;
	}
	post(name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		this.port.send(name, 0, args, options);
	}
	destroy() {
		const self = Self.get(this);
		if (!self) { return; }
		const destroyed = new Error('Port destroyed');
		this.requests.forEach(_=>_.reject(destroyed));
		this.requests.clear();
		this.handlers.clear();
		this.port.destroy();
		Self.delete(self);
		Self.delete(this);
	}
}

function onData(name, id, args, altThis, reply) { try {
	if (name) {
		if (!this.handlers.has(name)) { throw new Error(`No such handler "${ name }"`); }
		const [ handler, thisArg, ] = this.handlers.get(name);
		const value = handler.apply(thisArg != null ? thisArg : altThis, args);
		if (id === 0) { return false; }
		reply || (reply = this.port.send.bind(this.port));
		Promise.resolve(value).then(
			value => reply('', +id, [ value, ]),
			error => reply('', -id, [ toJson(error), ])
		);
	} else {
		if (!id) { throw new Error(`Bad request`); }
		const threw = id < 0;
		const request = this.requests.get(threw ? -id : id);
		if (!request) { throw new Error(`Bad response id`); }
		if (threw) {
			request.reject(fromJson(args[0]));
		} else {
			request.resolve(args[0]);
		}
	}
} catch (error) {
	if (id) {
		this.port.send('', -id, [ toJson(error), ]);
	} else {
		console.log('Uncaught error in handler (post)', error);
	}
} }

function onEnd() {
	this.destroy();
}


function PromiseCapability() {
	this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
}

// TODO: document the use of these functions:
function toJson(value) {
	return JSON.stringify(value, (key, value) => {
		if (!value || typeof value !== 'object') { return value; }
		if (value instanceof Error) { return '$_ERROR_$'+ JSON.stringify({ name: value.name, message: value.message, stack: value.stack, }); }
		return value;
	});
}
function fromJson(string) {
	if (typeof string !== 'string') { return string; }
	return JSON.parse(string, (key, value) => {
		if (!value || typeof value !== 'string' || !value.startsWith('$_ERROR_$')) { return value; }
		const object = JSON.parse(value.slice(9));
		const Constructor = typeof object.name === 'string' && typeof global[object.name] === 'function' ? global[object.name] : Error;
		const error = Object.create(Constructor.prototype);
		Object.assign(error, object);
		return error;
	});
}

return Port;

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; } } })((function() { return this; })());
