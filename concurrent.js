(function(exports) { 'use strict';

const functional = (function() { try { return require('es6lib/functional'); } catch(e) { return require('./functional'); } })();
const hrtime = functional.hrtime;
const apply = functional.apply;

const resolved = Promise.resolve();
const hasStream = typeof Stream === 'function';

const SymbolIterator = typeof Symbol === 'function' && Symbol.iterator ? Symbol.iterator : '[[Symbol.iterator]]';

/* global setTimeout */
const timeout = exports.timeout = (typeof setTimeout !== 'undefined') ? setTimeout : require("sdk/timers").setTimeout;

/**
 * @param  {uint}    ms  Time to "sleep" in milliseconds
 * @return {Promise}     Resolves to undefined after 'ms' milliseconds
 */
const sleep = exports.sleep = function sleep(ms) {
	return new Promise(function(done) { timeout(done, ms); });
};

/**
 * Returns a new node-style callback with a 'promise' property that will be resolved/rejected when the callback gets called.
 */
const promiseCallback = exports.promiseCallback = function promiseCallback() {
	var ret;
	const promise = new Promise(function(resolve, reject) {
		ret = function(err, res) { err ? reject(err) : resolve(res); };
	});
	ret.promise = promise;
	return ret;
};

/**
 * Turns an asynchronous callback method into one that returns a promise
 * @param  {function}  callUlater  Method that takes an callback(error, value) as last argument
 * @return {function}              Method that returns a Promise to it's asynchronous value
 */
const promisify = exports.promisify = function promisify(callUlater) {
	return function(/*arguments*/) {
		const self = this, args = arguments;
		return new Promise(function(resolve, reject) {
			apply(callUlater, self, args, function(err, res) { err ? reject(err) : resolve(res); });
		});
	};
};

const promisifyAll = exports.promisifyAll = function promisifyAll(object, prefix, keys) {
	prefix = prefix || '';
	keys = keys || Object.keys(object);
	keys.forEach(function(key) {
		object[prefix + key] = promisify(object[key]);
	});
};

/**
 * Turns a method that returns a promise into one that accepts a callback as last parameter.
 * @param  {function}  promiser  Method that returns a Promise to it's asynchronous value
 * @return {function}            Method that takes an callback(error, value) as last argument
 */
const promised = exports.promised = function promised(promiser) {
	return function(/*...args, callback*/) {
		const callback = Array.prototype.pop.call(arguments);
		apply(promiser, this, arguments)
		.then(callback.bind(null, null), callback);
	};
};

/**
 * Asynchronous task spawner. Subset of Task.js. Executes immediately. Uses global 'Promise'.
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fulfilled
 * @param  {object}     thisArg    'this' in generator
 * @param  {Arguments}  args       Arguments for generator
 * @return {Promise}               Promise of the return value of the generator
 */
const spawn = exports.spawn = function spawn(generator, thisArg, args) {
	const iterator = apply(generator, thisArg, args);

	function next(arg) {
		return handle(iterator.next(arg));
	}
	function _throw(arg) {
		return handle(iterator.throw(arg));
	}
	function handle(result) {
		if (result.done) {
			return Promise.resolve(result.value);
		} else {
			return Promise.resolve(result.value).then(next, _throw);
		}
	}

	return resolved.then(next);
};

/**
 * Asynchronous task spawner. Subset of Task.js. Executes when called. Forwards this and arguments.
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @param  {function}   catcher    Function that can .catch() exceptions thrown in generator
 * @return {Promise}               Async (member) function
 */
const async = exports.async = function async(generator, catcher) {
	return catcher
	? function async(/*arguments*/) {
		return spawn(generator, this, arguments).catch(catcher);
	}
	: function async(/*arguments*/) {
		return spawn(generator, this, arguments);
	};
};

/**
 * Turns a readable Stream into an asynchronous iterator over ist's 'data' and 'end' events.
 * Receives and yields the values of 'data' events until after ether 'end' or 'error' is emitted.
 * If the Stream ends due to 'error', a Promise.reject(error) is returned as the last value.
 * If the Stream ends due to 'end', that events data is returned as the last value.
 * To stop listening on the stream, end the iterator and clear it's data, call throw().
 * Do not call next() while the previous promise is pending.
 * @param   {stream}    stream  EventEmitter, that emits 'data' and an 'end' event.
 * @return  {iterator}          Object{ next(), throw(), }.
 */
const StreamIterator = exports.StreamIterator = function StreamIterator(stream) {
	const self = { };
	self.stream = stream;
	self.data = [ ];
	self.done = false;

	stream.on('data', self.ondata = function(data) {
		if (self.promise) {
			self.resolve(data);
			self.promise = null;
		} else {
			self.data.push(data);
		}
	});
	stream.once('error', self.onerror = function(error) {
		if (self.promise) {
			self.reject(error);
			self.promise = null;
		} else {
			self.data.push(Promise.reject(error));
		}
	});
	stream.once('end', self.onend = function(data) {
		if (self.promise) {
			self.resolve(data);
			self.promise = null;
		} else {
			self.data.push(data);
		}
		destroy();
	});

	function destroy(error) {
		self.done = true;
		self.reject && self.reject(error);
		self.promise = null;
		self.stream.removeListener('data', self.ondata);
		self.stream.removeListener('error', self.onerror);
		self.stream.removeListener('end', self.onend);
	}

	stream.resume && stream.resume();

	const ret = {
		next: function() {
			if (self.data.length) {
				return { value: self.data.shift(), done: false, };
			} else {
				if (self.done) {
					return { value: null, done: true, };
				}
				if (!self.promise) {
					self.promise = new Promise(function(resolve, reject) {
						self.resolve = resolve;
						self.reject = reject;
					});
					return { value: self.promise, done: false, };
				} else {
					return { value: Promise.reject(new Error('No data available, await previous promise before iterating')), done: false, };
				}
			}
		},

		throw: function(error) {
			self.data.length = 0;
			destroy(error);
			return { value: Promise.reject(error), done: false, };
		},
	};
	ret[SymbolIterator] = function() {
		return self;
	};
	return ret;
};

/**
 * Iterates an iterator of Promises and calls the callback with each trueisch value.
 * @param  {iterator}  iterator  Iterator that can return Promises as values. next() will not be called before the previous value resolved. If a Promise is rejected, the iteration gets aborted, rejected with that error and the error gets throw()'n into the iterator.
 * @param  {Function}  callback  Called with each trueisch, resolved value the iterator yields. If it throws an error, the iteration gets aborted, rejected with that error and the error gets throw()'n into the iterator.
 * @param  {any}       thisArg   'this' in 'callback'
 * @return {Promise}              Promise(true), resolved when the iterator is done.
 */
const forOn = exports.forOn = function forOn(iterator, callback, thisArg) {

	function next() {
		const result = iterator.next();

		if (result.done) {
			return Promise.resolve(result.value)
			.then(function(value) {
				return true;
			});
		} else {
			return Promise.resolve(result.value)
			.then(function(value) {
				return value != null && (thisArg ? callback.call(thisArg, value) : callback(value));
			}).then(next);
		}
	}

	return (!iterator.throw) ? resolved.then(next) : resolved.then(next)
	.then(function(value) {
		iterator.throw();
		return value;
	})
	.catch(function(error) {
		iterator.throw(error);
		throw error;
	});
};

/**
 * Periodically calls callback until it returns a true'ish value.
 * @param  {Function}  callback  Function to repeatedly call.
 *                               If it returns a Promise, the next iteration won't start while the Promise is still pending.
 * @param  {natural|Function}   waitFor   Number of minimum ms between iterations.
 * @return {Promise}             Promise to the true'ish value callback finally returns.
 * @throws {Promise}             Retuned Promise is rejected if callback throws or returns a rejected Promise.
 */
const periodic = exports.periodic = function periodic(callback, waitFor) {
	// TODO: test
	typeof waitFor === 'function' || (waitFor = (function() { return this; }).bind(waitFor || 0));
	return new Promise(function(resolve, reject) {
		var expected = hrtime(), index = 0;
		function ping() {
			var value;
			try { value = callback(); } catch (error) { return reject(error); }
			(value && typeof value.then === 'function') ? value.then(pong, reject) : pong(value);
		}
		function pong(value) {
			if (value) { return resolve(value); }
			try { expected += waitFor(++index); } catch (error) { return reject(error); }
			timeout(ping, expected - hrtime());
		}
		timeout(ping, waitFor(0));
	});
};

/**
 * Instantly asynchronously executes a callback as soon as possible.
 * @param  {function}  callback  Callback that will be executed without this or arguments.
 */
const instantly = exports.instantly = function instantly(callback) {
	resolved.then(callback);
};

const moduleName = 'es6lib/concurrent'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
