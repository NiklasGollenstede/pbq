'use strict';
/* global process */

const Path = require('path');
const compile = require('traceur/src/node/api.js').compile;
const { FS, spawn, cached, } = require('./util.js');

const load = (module, global = { }) => (new Function('exports', 'require', module)(global, requireEs6), global);
const requireEs6 = path => load(compile(FS.readFileSync(path, 'utf8'), { }));

export const main = () => spawn(function*() {

	const { test, } = requireEs6('sample.js');

	console.log(test());

}).catch(error => {
	console.error('main threw:', error.stack || error);
});
