'use strict'; /* global exports */

const concurrent = require('./concurrent.js');
const promisify = concurrent.promisify;
const fs = require('fs');

const defaultMask = ~process.umask() & 511 /*0777*/;

/**
 * the native (node-compatible) 'path' module
 */
const Path = exports.Path = require('path');

/**
 * The native 'fs' module wrapped in (native) Promises.
 * INSTEAD of taking a callback as last argument, all asynchronous functions return Promises
 *
 * @function listDir   asynchronous, recursive, unordered directory listing
 * @function makeDir   asynchronous direktory path creation, reimplementation of 'mkdirp' package
 */
(function() {
	const FS = Object.assign(exports, fs);
	const exists = FS.exists;
	Object.keys(FS)
	.filter(key => (/Sync$/).test(key))
	.map(key => key.slice(0, -4))
	.forEach(key => FS[key] = promisify(FS[key]));
	FS.exists = path => new Promise(done => exists(path, done));
	FS.listDir = promisify(walk);
	FS.makeDir = function(path, mask) {
		return trustedMakeDir(Path.resolve(path), arguments.length < 1 ? mask : defaultMask);
	};
	FS.FS = FS;
	return Object.freeze(FS);
})();

function trustedMakeDir(path, mask) {
	return FS.mkdir(path, mask)
	.catch(function(error) {
		if (error.code === 'ENOENT') {
			return FS.trustedMakeDir(Path.dirname(path), mask)
			.then(FS.trustedMakeDir.bind(FS, path, mask));
		}
		return FS.stat(path)
		.then(function(stat) {
			if (!stat.isDirectory()) { throw null; }
		})
		.catch(function() { throw error; });
	});
}

// TODO: reimplement (licence?)
function walk(dir, done) {
	var results = [ ];
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
}
