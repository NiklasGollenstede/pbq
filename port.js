(function(global) { 'use strict'; const factory = function es6lib_port(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
/* eslint-disable no-unused-vars */

/**
 * Wrapper class for browser WebSockets, node js Streams, web-extension runtime.Ports and similar ports,
 * to provide a more high level API with requests to named handlers and Promises to their replies.
 */
const Port = class Port {

	/**
	 * Takes one end of a communication channel and prepares it to send and receive requests.
	 * @param  {any}     port     The low-level port object that is connected to the communication channel. Its only use is as the argument to `Adapter`.
	 * @param  {class}   Adapter  A simple adapter class to provide a common interface for different types of low level ports.
	 *                            This can ether be one of (for details see below)
	 *                                Port.WebSocket        for  browser WebSockets,
	 *                                Port.MessagePort      for  browser MessagePorts,
	 *                                Port.node_Stream      for  node.js DuplexSteams,
	 *                                Port.web_ext_Port     for  (browser/chrome).runtime.Port object in Chromium, Firefox and Opera extensions,
	 *                                Port.web_ext_Runtime  for  browser.runtime/tabs.on/sendMessage API in Firefox extensions (in Chromium and Opera this needs to be Promise-wrapped),
	 *                            or any other class that implements the PortAdapter interface.
	 * @return {Port}             The new Port instance.
	 */
	constructor(port, Adapter) {
		new _Port(this, port, Adapter);
	}

	/**
	 * Adds a named message handler.
	 * @param  {string}    name     Optional. Non-empty name of this handler, which can be used
	 *                              by .request() and .post() to call this handler. Defaults to `handler`.name.
	 * @param  {RegExp}    names    Optional, instead of explicit name. Name wildcard: Messages with names that are
	 *                              not handled by a handler with a string name are handled by this handler if their name matches.
	 *                              The first argument to the handler will be the actual name.
	 * @param  {function}  handler  The handler function. It will be called with JSON-clones of all additional arguments
	 *                              provided to .request() or .post() and may return a Promise to asynchronously return a value.
	 * @param  {any}       thisArg  `this` to pass to the handler when called. If == null, it may be set by the PortAdapter.
	 * @return {MessageHandler}     Self reference for chaining.
	 * @throws {Error}              If there is already a handler registered for `name`.
	 */
	addHandler(/*name, handler, thisArg*/) {
		getPrivate(this).addHandler(...arguments);
		return this;
	}

	/**
	 * Adds multiple named message handlers.
	 * @param  {string}        prefix    Optional prefix to prepend to all handler names specified in `handlers`.
	 * @param  {object|array}  handlers  Ether an array of named functions or an object with methods. Array entries / object properties that are no functions will be ignores.
	 * @param  {any}           thisArg   `this` to pass to the handler when called. If == null, it may be set by the PortAdapter.
	 * @return {MessageHandler}          Self reference for chaining.
	 * @throws {Error}                   If there is already a handler registered for any `prefix` + handler.name; no handlers have been added.
	 */
	addHandlers(/*prefix, handlers, thisArg*/) {
		getPrivate(this).addHandlers(...arguments);
		return this;
	}

	/**
	 * Removes a named handler.
	 * @param  {string|RegExp}   name  The name of the handler to be removed.
	 * @return {MessageHandler}        Self reference for chaining.
	 */
	removeHandler(name) {
		getPrivate(this).removeHandler(name);
		return this;
	}

	/**
	 * Queries the existence of a named handler.
	 * @param  {string|RegExp}  name  The name of the handler to query.
	 * @return {bool}                 true iff a handler is listening on this port.
	 */
	hasHandler(name) {
		return getPrivate(this).hasHandler(name);
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
		return getPrivate(this).request(...arguments);
	}

	/**
	 * Calls a handler on the other end of this port without waiting for its return value and without guarantee that a handler has in fact been called.
	 * @param  {object}  options  Optional, may be omitted. If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 */
	post(/*name, ...args*/) {
		return getPrivate(this).post(...arguments);
	}

	/**
	 * Returns a frozen Promise that resolves when the Port gets .destroyed().
	 */
	get ended() {
		const self = Self.get(this);
		return self ? self.ended : Promise.resolve();
	}

	/**
	 * Tells whether the currently synchronously handled message is a request or post.
	 * @return {boolean}  If false, the current handler is called by a remote .post(), i.e. the return value of the handler is not used.
	 * @throws {Error}    If this Port is not currently in a synchronous call to a handler.
	 */
	isRequest() {
		return getPrivate(this).isRequest();
	}

	releaseCallback(func) {
		getPrivate(this).releaseCallback(func);
		return this;
	}

	/**
	 * Destroys the Port instance and the underlying PortAdapter.
	 * Gets automatically called when the underlying port closes.
	 * After the instance is destroyed, all other methods on this instance will throw.
	 * Never throws and any further calls to .destroy() will be ignored.
	 */
	destroy() {
		try {
			const self = Self.get(this);
			self && self.destroy();
		} catch (error) { reportError(error); }
	}
};

/**
 * Details on the Provided PortAdapter implementations:
 *
 *     Port.WebSocket:        Wraps WebSockets.
 *                            Uses JSON encoding.
 *
 *     Port.MessagePort:      Wraps MessagePorts.
 *                            Calls .start().
 *                            NOTE: There is no 'close' event, the application must take care to close BOTH ends of the channel.
 *
 *     Port.node_Stream:      Wraps node.js DuplexSteams.
 *                            Uses JSON encoding, reads and writes UTF-8 strings.
 *                            Calls onEnd() from both 'end' and 'close' events.
 *                            Always sends asynchronously.
 *
 *     Port.web_ext_Port:     Wraps (browser/chrome).runtime.Port object in Chromium, Firefox and Opera extensions.
 *
 *     Port.web_ext_Runtime:  Wraps the global browser/chrome api object in Chromium, Firefox and Opera extensions.
 *                            Listens for messages on api.runtime.onMessage and can
 *                            send messages via api.runtime.sendMessage and api.tabs.sendMessage, if available.
 *                            The `port` parameter to new Port() must be the `browser` global in Firefox
 *                            or a promisified version of the `chrome`/`browser` global in Chromium/Edge/Opera.
 *                            The `options` parameter of port.request()/.post() can be an object of { tabId, frameId?, } to send to tabs.
 *                            The Port is never closed automatically.
 *                            If `thisArg` is == null, the `this` in the handler will be set to the messages `sender`.
 */

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
	 *                             The first three arguments must be JSON clones of the [ name, id, args, ] arguments provided to .send().
	 *                             The 4th argument may be an alternative value for `this` in the handler for this message,
	 *                             which is used if the `thisArg` for the listener is == null.
	 *                             The 5th argument may be a function that is used once instead of .send() to reply to this single message.
	 *                             A trueisch value as 6th argument indicates that handling this message is optional, i.e. it doesn't get rejected if no handler is found.
	 *                             Returns whether the reply function, if provided, will be called asynchronously.
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
	 * @return {Promise}           If the .send() function returns a value other than `undefined` it is assumed to be (a Promise to) the messages reply and is returned from port.request().
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
/* eslint-enable no-unused-vars */

Port.WebSocket = class WebSocket {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onMessage = ({ data, }) => { data = JSON.parse(data); onData(data[0], data[1], data[2]); };
		this.onClose = () => onEnd();
		this.port.addEventListener('message', this.onMessage);
		this.port.addEventListener('close', this.onClose);
	}

	send(name, id, args) {
		this.port.send(JSON.stringify([ name, id, args, ]));
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.removeEventListener('close', this.onClose);
		this.port.close();
	}
};

Port.web_Port = class extends Port.WebSocket { constructor() {
	super(...arguments);
	console.warn('The default Port.web_Port is deprecated, explicitly use Port.WebSocket instead');
} };

Port.MessagePort = class MessagePort {

	constructor(port, onData, _onEnd) {
		this.port = port;
		this.onMessage = ({ data, }) => onData(data[0], data[1], data[2]);
		this.port.addEventListener('message', this.onMessage);
		this.port.start();
	}

	send(name, id, args) {
		this.port.postMessage([ name, id, args, ]);
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.close();
	}
};

Port.node_Stream = class node_Stream {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onData = data => { data = JSON.parse(data.toString('utf8')); onData(data[0], data[1], data[2]); };
		this.onEnd = () => onEnd();
		port.on('data', this.onData);
		port.once('end', this.onEnd);
		port.once('close', this.onEnd);
	}

	send(name, id, args) {
		const data = JSON.stringify([ name, id, args, ]);
		(global.setImmediate || global.setTimeout)(() => this.port.write(data, 'utf8'));
	}

	destroy() {
		this.port.removeListener('data', this.onData);
		this.port.removeListener('end', this.onEnd);
		this.port.removeListener('close', this.onEnd);
		this.port.end();
	}
};

Port.web_ext_Port = class web_ext_Port {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onMessage = data => onData(data[0], data[1], JSON.parse(data[2]));
		this.onDisconnect = () => onEnd();
		this.port.onMessage.addListener(this.onMessage);
		this.port.onDisconnect.addListener(this.onDisconnect);
	}

	send(name, id, args) {
		args = JSON.stringify(args); // explicitly stringify args to throw any related errors here.
		try {
			this.port.postMessage([ name, id, args, ]); // throws if encoding any of the args throws, or if the port is disconnected:
		} catch (error) { // firefox tends to not fire the onDisconnect event
			// the port was unable so send an array of primitives ==> is is actually closed
			// TODO: can it throw for other reasons (message to long, ...)?
			console.error('Error in postMessage, closing Port:', error);
			this.onDisconnect();
		}
	}

	destroy() {
		this.port.onMessage.removeListener(this.onMessage);
		this.port.onDisconnect.removeListener(this.onDisconnect);
		this.port.disconnect();
	}
};

Port.web_ext_Runtime = class web_ext_Runtime {

	constructor(api, onData) {
		this.api = api; this.onData = onData;
		this.onMessage = (data, sender, reply) => onData(data[0], data[1], data[2], sender, (...args) => reply(args), true);
		this.sendMessage = api.runtime.sendMessage;
		this.sendMessageTab = api.tabs ? api.tabs.sendMessage : () => { throw new Error(`Can't send messages to tabs (from within a tab)`); };
		this.api.runtime.onMessage.addListener(this.onMessage);
	}

	send(name, id, args, tab) {
		let promise;
		if (tab !== null) {
			const { tabId, frameId, } = tab;
			promise = this.sendMessageTab(tabId, [ name, id, args, ], frameId != null ? { frameId, } : { });
		} else {
			promise = this.sendMessage([ name, id, args, ]);
		}
		if (id === 0) { return; } // is post
		promise.then(value => this.onData('', id, value), error => this.onData('', -id, error));
	}

	destroy() {
		this.api.runtime.onMessage.removeListener(this.onMessage);
		this.api = this.onData = null;
	}
};

// holds references between public interface and private implementation
const Self = new WeakMap/*<Port, _Port>*/;

function getPrivate(other) {
	const self = Self.get(other);
	if (self) { return self; }
	throw new Error(`Can't use disconnected Port`);
}

// private implementation class
class _Port {
	constructor(self, port, Adapter) {
		this.port = new Adapter(port, this.onData.bind(this), this.destroy.bind(this));
		this.requests = new Map; // id ==> PromiseCapability
		this.handlers = new Map; // name ==> [ function, thisArg, ]
		this.wildcards = new Map; // RegExp ==> [ function, thisArg, ]
		this.lastId = 1; // `1` will never be used
		this.cb2id = new WeakMap/*<function, id*/;
		this.id2cb = new Map/*<id, function>*/;
		this.ended = Object.freeze(new Promise(end => (this.onEnd = end)));
		this._isRequest = 0; // -1: false; 0: throw; 1: true;
		this.public = self;
		Self.set(self, this);
	}
	nextId() { return ++this.lastId; }

	addHandler(name, handler, thisArg) {
		if (typeof name === 'function') { [ handler, thisArg, ] = arguments; name = handler.name; }
		if (typeof handler !== 'function') { throw new TypeError(`Message handlers must be functions`); }
		if (typeof name === 'string' && name !== '') {
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
			this.handlers.set(name, [ handler, thisArg, ]);
		} else {
			const filter = name;
			try { if (typeof filter.test('X') !== 'boolean') { throw null; } } // eslint-disable-line no-throw-literal
			catch (_) { throw new TypeError(`Handler names must be non-empty strings or RegExp wildcards`); }
			this.wildcards.set(filter, [ handler, thisArg, ]);
		}
		return this;
	}
	addHandlers(prefix, handlers, thisArg) {
		if (typeof prefix === 'object') { [ handlers, thisArg, ] = arguments; prefix = ''; }
		if (typeof prefix !== 'string') { throw new TypeError(`Handler name prefixes must be strings (or omitted)`); }
		if (typeof handlers !== 'object') { throw new TypeError(`'handlers' argument must be an object (or Array)`); }

		const add = (
			Array.isArray(handlers)
			? handlers.map(f => [ f && f.name, f, ])
			: Object.keys(handlers).map(k => [ k, handlers[k], ])
		).filter(([ , f, ]) => typeof f === 'function');
		add.forEach(([ name, ]) => {
			if (typeof name !== 'string' || name === '') { throw new TypeError(`Handler names must be non-empty strings`); }
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
		});
		add.forEach(([ name, handler, ]) => this.handlers.set(prefix + name, [ handler, thisArg, ]));
		return this;
	}
	removeHandler(name) {
		typeof name === 'string' ? this.handlers.delete(name) : this.wildcards.delete(name);
		return this;
	}
	hasHandler(name) {
		return typeof name === 'string' ? this.handlers.has(name) : this.wildcards.has(name);
	}
	request(name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		const id = this.nextId();
		const value = this.port.send(name, id, args.map(this.mapValue, this), options);
		if (value !== undefined) { return value; }
		const request = new PromiseCapability;
		this.requests.set(id, request);
		return request.promise;
	}
	post(name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		this.port.send(name, 0, args.map(this.mapValue, this), options);
	}
	mapValue(value) {
		const isObject = typeof value === 'object' && value !== null;
		if (isObject && ('' in value) && Object.getOwnPropertyDescriptor(value, '')) {
			value = { '': 0, raw: value, };
		} else if (typeof value === 'function') {
			const id = this.cb2id.get(value) || this.nextId();
			this.id2cb.set(id, value); this.cb2id.set(value, id);
			value = { '': 1, cb: id, };
		} else if (isObject && value.constructor && (/Error$/).test(value.constructor.name)) {
			value = { '': 2, name: value.name+'', message: value.message+'', stack: value.stack+'', fileName: value.fileName, lineNumber: value.lineNumber, columnNumber: value.columnNumber,  };
		}
		return value;
	}
	unmapValue(value) {
		if (typeof value !== 'object' || value === null || !('' in value)) { return value; }
		switch (value['']) {
			case 0: return value.raw;
			case 1: return (...args) => {
				if (!this.public) { throw new Error(`Remote callback connection is closed`); }
				const id = this.nextId();
				const promise = this.port.send('', 0, [ id, 0, value.cb, args.map(this.mapValue, this), ], null);
				if (promise !== undefined) { return promise; }
				const request = new PromiseCapability;
				this.requests.set(id, request);
				return request.promise;
			};
			case 2: return delete value[''] && Object.assign(Object.create((typeof global[value.name] === 'function' ? global[value.name] : Error)).prototype, value);
			default: throw new TypeError(`Can't unmap argument`);
		}
	}
	isRequest() {
		switch (this._isRequest << 0) {
			case -1: return false;
			case +1: return true;
		}
		throw new Error(`Port.isRequest() may only be called while the port is in a synchronous handler`);
	}
	releaseCallback(cb) {
		const id = this.cb2id.get(cb); if (!id) { return; }
		this.id2cb.delete(id); this.cb2id.delete(cb);
	}
	destroy() {
		if (!this.public) { return; }
		this.requests.forEach(_=>_.reject(new Error('The Port this request is waiting on was destroyed')));
		this.requests.clear();
		this.handlers.clear();
		this.id2cb.clear();
		this.onEnd();
		try { this.port.destroy(); } catch (error) { console.error(error); }
		Self.delete(this.public);
		this.public = null;
	}

	onData(name, id, args, altThis, reply, optional) {
		let value;
		if (name || id === 0) { try { // handle request
			if (!name && id === 0) { // special request
				id = args[0];
				switch (args[1]) {
					case 0: { // callback call
						const callback = this.id2cb.get(args[2]);
						if (!callback) { throw new Error(`Remote callback has been destroyed`); }
						value = callback.apply(null, args[3].map(this.unmapValue, this));
					} break;
					default: throw new Error(`Bad request`);
				}
			} else {
				args = args.map(this.unmapValue, this);
				let handler, thisArg;
				if (this.handlers.has(name)) {
					[ handler, thisArg, ] = this.handlers.get(name);
				} else {
					for (const [ filter, pair, ] of this.wildcards) {
						if (filter.test(name)) { [ handler, thisArg, ] = pair; break; }
					}
					args.unshift(name);
				}
				if (!handler) { if (!optional) { throw new Error(`No such handler "${ name }"`); } else { return false; } }
				try {
					this._isRequest = id === 0 ? -1 : 1;
					value = handler.apply(thisArg !== undefined ? thisArg : altThis, args);
				} finally { this._isRequest = 0; }
			}
			if (!isPromise(value)) {
				if (id !== 0) { reply ? reply('', +id, [ this.mapValue(value), ]) : this.port.send('', +id, [ this.mapValue(value), ]); }
				return false;
			} else {
				if (id === 0) {
					value.then(null, error => reportError('Uncaught async error in handler (post)', error));
					return false;
				}
				value.then(
					value => reply ? reply('', +id, [ this.mapValue(value), ]) : this.port.send('', +id, [ this.mapValue(value), ]),
					error => reply ? reply('', -id, [ this.mapValue(error), ]) : this.port.send('', -id, [ this.mapValue(error), ])
				);
				return true;
			}
		} catch (error) {
			if (id) {
				reply ? reply('', -id, [ this.mapValue(error), ]) : this.port.send('', -id, [ this.mapValue(error), ]);
			} else {
				reportError('Uncaught error in handler (post)', error);
			}
			return false;
		} } else { try { // resolve reply
			const threw = id < 0; threw && (id = -id);
			const request = this.requests.get(id); this.requests.delete(id);
			if (!request) { throw new Error(`Bad or duplicate response id`); }
			if (threw) {
				request.reject(this.unmapValue(args[0]));
			} else {
				request.resolve(this.unmapValue(args[0]));
			}
			return false;
		} catch (error) {
			reportError(error);
			return false;
		} }
	}
}

function PromiseCapability() {
	this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
}

function isPromise(value) { try {
	if (!value || typeof value !== 'object' || typeof value.then !== 'function') { return false; }
	const ctor = value.constructor;
	if (typeof ctor !== 'function') { return false; }
	if (PromiseCtors.has(ctor)) { return PromiseCtors.get(ctor); }
	let is = false; try { new ctor((a, b) => (is = typeof a === 'function' && typeof b === 'function')); } catch (_) { }
	PromiseCtors.set(ctor, is);
	return is;
} catch (_) { return false; } }
const PromiseCtors = new WeakMap;

const reportError =
typeof console !== 'object' ? () => 0
: function() { try { console.error.apply(console, arguments); } catch (_) { } };

return Port;

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; if (typeof QueryInterface === 'function') { global.exports = result; global.EXPORTED_SYMBOLS = [ 'exports', ]; } } } })((function() { return this; })()); // eslint-disable-line
