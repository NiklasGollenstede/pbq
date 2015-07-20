(function(exports) { 'use strict';

const child_process = require('child_process');

/**
 * returns a Promise of the completion of a new child_process
 * @augments {...}           Either those of a call to child_process.exec or child_process.execFile (if 2nd arg is Array)
 * @return {Promise(string)} Promise that will be fulfilled with the child_processes accumulated stdout
 *                           or be rejected with the error which has stdout and stderr attached
 */
const execute = exports.execute = function(/*...args*/) {
	const args = Array.prototype.slice.call(arguments);
	return new Promise(function(resolve, reject) {
		args.push(function(error, stdout, stderr) {
			if (error) {
				reject(Object.assign((error && typeof error === 'object') ? error : { value: error, }, { stderr, stdout }));
			} else {
				resolve(stdout);
			}
		});
		child_process[
			(args[1] instanceof Array) ? 'execFile' : 'exec'
		].apply(child_process, args);
	});
};

const moduleName = 'es6lib/process'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
