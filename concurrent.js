'use strict';

exports.promisify = function promisify(async, thisArg) {
	return function() {
		var args = Array.prototype.slice.call(arguments);
		return new Promise(function(resolve, reject) {
			args.push(function(err, res) { err ? reject(err) : resolve(res); });
			async.apply(thisArg, args);
		});
	};
};

exports.spawn = function spawn(generator) {
	const iterator = generator();
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

export function sleep(ms) {
	return new Promise(done => setTimeout(done, ms));
}
