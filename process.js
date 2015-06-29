'use strict';

const child_process = require('child_process');

export const execute = (...args) => new Promise((resolve, reject) => {
	child_process[
		(args[1] instanceof Array) ? 'execFile' : 'exec'
	](
		...args,
		(error, stdout, stderr) => error ? reject(Object.assign(error, { stderr, stdout })) : resolve(stdout)
	);
});
