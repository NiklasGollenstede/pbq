(function(exports) { 'use strict';

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
 * Asynchronous task spawner. Supset of Task.js. Executes immediately.
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @param  {object}     thisArg    'this' in generator
 * @param  {Arguments}  args       Arguments for generator
 * @return {Promise}               Promise of the return value of the generator
 */
const spawn = exports.spawn = function spawn(generator, thisArg, args) {
	const iterator = generator.apply(thisArg, args);
	const onFulfilled = iterate.bind(null, 'next');
	const onRejected = iterate.bind(null, 'throw');

	function iterate(verb, arg) {
		var result;
		try {
			result = iterator[verb](arg);
		} catch (err) {
			return Promise.reject(err);
		}
		if (result.done) {
			return Promise.resolve(result.value);
		} else {
			return Promise.resolve(result.value).then(onFulfilled, onRejected);
		}
	}
	return iterate('next');
};

/**
 * Asynchronous task spawner. Supset of Task.js. Executes when called. Forwards this and arguments.
 * @param  {function*}  generator  Generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @return {Promise}               Async (member) function
 */
const async = exports.async = function async(generator) {
	return function async(/*arguments*/) {
		return spawn(generator, this, arguments);
	};
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

/* global setTimeout */
const timeout = exports.timeout = (typeof setTimeout !== 'undefined') ? setTimeout : require("sdk/timers").setTimeout;

/**
 * @param  {uint}    ms  Time to "sleep" in milliseconds
 * @return {Promise}     Resolves to undefined after 'ms' milliseconds
 */
const sleep = exports.sleep = function sleep(ms) {
	return new Promise(function(done) { timeout(done, ms); });
};

const moduleName = 'es6lib/concurrent'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
