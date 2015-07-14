'use strict';

const child_process = require('child_process');

const execute = exports.execute = function(/*...args*/) {
	const args = Array.prototype.slice.call(arguments);
	return new Promise(function(resolve, reject) {
		args.push(function(error, stdout, stderr) {
			if (error) {
				reject(Object.assign(error, { stderr, stdout }));
			} else {
				resolve(stdout);
			}
		});
		child_process[
			(args[1] instanceof Array) ? 'execFile' : 'exec'
		].apply(child_process, args);
	});
};
