'use strict';

var fs = require('fs');
var path = require('path');

var promisify = exports.promisify = function(async, thisArg) {
	return function() {
		var args = Array.prototype.slice.call(arguments);
		return new Promise(function(resolve, reject) {
			args.push(function(err, res) { err ? reject(err) : resolve(res); });
			async.apply(thisArg, args);
		});
	};
};

// copied from some stackoverflow thread
var walk = function(dir, done) {
	var results = [];
	fs.readdir(dir, function(err, list) {
		if (err) { return done(err); }
		var pending = list.length;
		if (!pending) { return done(null, results); }
		list.forEach(function(file) {
			file = path.resolve(dir, file);
			fs.stat(file, function(err, stat) {
				if (stat && stat.isDirectory()) {
					walk(file, function(err, res) {
						results = results.concat(res);
						if (!--pending) { done(null, results); }
					});
				} else {
					results.push(file);
					if (!--pending) { done(null, results); }
				}
			});
		});
	});
};

exports.FS = (function() {
	var FS = Object.assign({ }, fs);
	FS.makeDir = promisify(require('mkdirp'));
	FS.listDir = promisify(walk);
	var exists = FS.exists;
	Object.keys(FS).forEach(function(key) {
		if (!(/Sync$/.test(key))) { return; }
		key = key.slice(0, -4);
		FS[key] = promisify(FS[key]);
	});
	FS.exists = function(path) {
		return new Promise(function(done) {
			return exists(path, done);
		});
	};
	return Object.freeze(FS);
})();

exports.spawn = function(generator) {
	var iterator = generator();
	var onFulfilled = iterate.bind(null, 'next');
	var onRejected = iterate.bind(null, 'throw');

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

exports.cached = function(func, thisArg) {
	var cache = new Map();
	return function(first) {
		if (cache.has(first)) {
			return cache.get(first);
		}
		var result = func.apply(thisArg, arguments);
		cache.set(first, result);
		return result;
	};
};
