(function(exports) { 'use strict';

const functional = (function() { try { return require('es6lib/functional'); } catch(e) { return require('./functional'); } })();
const hrtime = functional.hrtime;
const apply = functional.apply;

const resolved = Promise.resolve();
const hasStream = typeof Stream === 'function';

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

const StreamIterator = exports.StreamIterator = function StreamIterator(stream) {
	const self = this;
	self.stream = stream;
	self.data = [ ];
	self.done = false;

	(function makePromise() {
		self.promise = new Promise(function(resolve, reject) {
			self.resolve = function(value) { resolve(value); self.resolve = self.reject = null; };
			self.reject = function(error) { reject(error); self.resolve = self.reject = null; };
		});
		self.promise.then(makePromise, makePromise);
	})();

	stream.on('data', this.ondata = function(data) {
		if (self.resolve) {
			self.resolve(data);
		} else {
			self.data.push(data);
		}
	});
	stream.once('error', this.onerror = function(error) {
		if (self.resolve) {
			self.reject(error);
		} else {
			self.data.push(Promise.reject(error));
		}
	});
	stream.once('end', this.onend = function(data) {
		if (self.resolve) {
			self.resolve(data);
		} else {
			self.data.push(data);
		}
		self.destroy();
	});

	stream.resume && stream.resume();
};
StreamIterator.prototype = {
	constructor: StreamIterator,

	next() {
		if (this.data.length) {
			// console.log('next', 'had');
			return { value: this.data.shift(), done: this.done, };
		} else {
			// console.log('next', 'wait', this.done, this.promise);
			if (this.done) {
				return { value: null, done: true, };
			}
			if (this.promise) {
				const promise = this.promise;
				this.promise = null;
				return { value: promise, done: false, };
			} else {
				return { value: Promise.reject(new Error('No data available, await previous promise before iterating')), done: false, };
			}
		}
	},

	throw(error) {
		this.data.length = 0;
		this.destroy(error);
		return { value: Promise.reject(error), done: false, };
	},

	makePromise() {
		const self = this;
		return new Promise(function(resolve, reject) {
			self.requested.push({
				resolve: resolve,
				reject: reject,
			});
		});
	},

	destroy(error) {
		this.done = true;
		this.reject && this.reject(error);
		this.promise = null;
		this.stream.removeListener('data', this.ondata);
		this.stream.removeListener('error', this.onerror);
		this.stream.removeListener('end', this.onend);
	},

	[Symbol.iterator]() {
		return this;
	}
};

const forOn = exports.forOn = function forOn(iterator, callback, thisArg) {

	function next() {
		const result = iterator.next();
		Promise.resolve(result.value)
			.catch(error => console.error('error', result.done, error))
			.then(value => console.log('value', result.done, value));

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

	return resolved.then(next)
	.then(function(value) {
		iterator.throw();
		console.log('iteration done then', value);
		return value;
	})
	.catch(function(error) {
		iterator.throw(error);
		console.log('iteration done catch', error);
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
			if (value) { return value; }
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
