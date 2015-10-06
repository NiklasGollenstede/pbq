(function(exports) { 'use strict';

const functional = require('es6lib/functional');
const hrtime = functional.hrtime;
const apply = functional.apply;

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
 * @param  {function} async  Method that takes an callback(error, value) as last argument
 * @return {function}        Method that returns a Promise to it's asyncronous value
 */
const promisify = exports.promisify = function promisify(async) {
	return function() {
		var self = this, args = Array.prototype.slice.call(arguments);
		return new Promise(function(resolve, reject) {
			args.push(function(err, res) { err ? reject(err) : resolve(res); });
			async.apply(self, args);
		});
	};
};

/**
 * Asynchronous task spawner. Subset of Task.js. Executes immediately. Uses global 'Promise'.
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @param  {object}     thisArg    'this' in generator
 * @param  {Arguments}  args       Arguments for generator
 * @return {Promise}               Promise of the return value of the generator
 */
const spawn = exports.spawn = function spawn(generator, thisArg, args) {
	const iterator = apply(generator, thisArg, args);
	const onFulfilled = iterate.bind(null, true);
	const onRejected = iterate.bind(null, false);

	function iterate(next, arg) {
		var result;
		try {
			result = next ? iterator.next(arg) : iterator.throw(arg);
		} catch (err) {
			return Promise.reject(err);
		}
		if (result.done) {
			return Promise.resolve(result.value);
		} else {
			return Promise.resolve(result.value).then(onFulfilled, onRejected);
		}
	}
	return iterate(true);
};

/**
 * Asynchronous task spawner. Supset of Task.js. Executes when called. Forwards this and arguments.
 * @param  {string}     name       Optional function.name
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @return {Promise}               Async (member) function
 */
const async = exports.async = function async(name, generator) {
	if (arguments.length === 1) {
		generator = name;
		return function async(/*arguments*/) {
			return spawn(generator, this, arguments);
		};
	} else {
		return new Function('generator', 'return function '+ name +'() {\
			return spawn(generator, this, arguments);\
		}')(generator);
	}
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
	if (!waitFor) {
		return spawn(function*() {
			var value;
			while (!(value = (yield callback()))) { }
			return value;
		});
	} else {
		typeof waitFor === 'function' || (waitFor = (function() { return this; }).bind(waitFor));
		return spawn(function*() {
			var value, expected = hrtime(), index = 0;
			while (!(value = (yield callback()))) {
				expected += waitFor(++index);
				var diff = expected - hrtime();
				diff > 0 && (yield sleep(diff));
			}
			return value;
		});
	}
};

/**
 * Instantly asynchronously executes a callback as soon as possible.
 * @param  {function}  callback  Callback that will be executed without this or arguments.
 */
const instantly = exports.instantly = (function instantly(callback) {
	const resolved = Promise.resolve();
	return function instantly(callback) {
		resolved.then(callback);
	};
})();

const moduleName = 'es6lib/concurrent'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
