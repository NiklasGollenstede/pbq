(function(exports) {
'use strict';

/**
 * turns an asynchronous callback function into one that returns a promise
 * @param  {function} async function that takes an callback(error, value) as last argument
 * @return {function}       function that returns a Promise to it's asyncronous value
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
 * asynchronous task spawner
 * @param  {function*}  generator  generator function that yields promises to asynchronous values which are returned to the generator once the promises are fullfilled
 * @return {Promise}               Promise of the return value of the generator
 */
const spawn = exports.spawn = function spawn(generator) {
	const iterator = generator(); // .call(thisArg); ??
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

/* global setTimeout */
const timeout = (typeof setTimeout !== 'undefined') ? setTimeout : require("sdk/timers").setTimeout;

/**
 * @param  {uint}    ms  time to "sleep"
 * @return {Promise}     resolves to undefined after ms ms
 */
const sleep = exports.sleep = function sleep(ms) {
	return new Promise(function(done) { timeout(done, ms); });
};

const moduleName = 'es6lib/concurrent'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
