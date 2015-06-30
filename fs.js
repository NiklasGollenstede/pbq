'use strict';

const { promisify, } = require('./concurrent.js');
const fs = require('fs');

const Path = exports.Path = require('path');

var walk = function(dir, done) {
	var results = [];
	fs.readdir(dir, function(err, list) {
		if (err) { return done(err); }
		var pending = list.length;
		if (!pending) { return done(null, results); }
		list.forEach(function(file) {
			file = Path.resolve(dir, file);
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

const FS = exports.FS = (function() {
	const FS = Object.assign({ }, fs);
	FS.makeDir = promisify(require('mkdirp'));
	FS.listDir = promisify(walk);
	const exists = FS.exists;
	Object.keys(FS).forEach(function(key) {
		if (!(/Sync$/.test(key))) { return; }
		key = key.slice(0, -4);
		FS[key] = promisify(FS[key]);
	});
	FS.exists = function(path) { return new Promise(done => exists(path, done)); };
	return Object.freeze(FS);
})();
