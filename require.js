typeof global !== 'undefined' && (global._original_require_ = require); // this *has* to happen in the global scope

(function() { 'use strict'; // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const Generator = Object.getPrototypeOf(function*(){ yield 0; }).constructor;
function isGenerator(g) { return g instanceof Generator; }
const resolved = Promise.resolve();
const isNode = typeof global !== 'undefined' && typeof global.process !== 'undefined';
const URL = isNode ? function(s) { this.pathname = s; } : window.URL;

const [ basePath, baseOrigin, ] = (() => {
	const path = getCallingScript(0);
	if (isNode) { return [ '', '', ]; }
	const fromNM = (/\/(?:node_)?modules\/(?:require|es6lib)\/require\.js$/).test(path);
	const url = (fromNM ? new URL('../../', path) : new URL('./', location));
	return [ url.pathname, url.protocol +'//'+ (url.host || ''), ];
})();

const Exports = { };
const Loading = new Set;

function define(/* id, deps, factory */) {
	let id, deps, factory;
	switch (arguments.length) {
		case 3: {
			[ id, deps, factory, ] = arguments;
			if (!Array.isArray(deps)) { badArg(); }
		} break;
		case 2: {
			factory = arguments[1];
			const first = arguments[0];
			typeof first === 'string' ? (id = first) : (deps = first);
		} break;
		case 1: {
			factory = arguments[0];
		} break;
		default: {
			badArg();
		}
	}
	if (id === undefined) {
		let src = getCallingScript(1);
		id = ((/[\w-]+:\/\//).test(src) ? new URL(src).pathname : src).replace(/\.js$/, '');
		if (id.startsWith(basePath)) {
			id = id.slice(basePath.length);
		} else if (id.startsWith('/')) {
			id = id.slice(1);
		}
	}
	if (typeof id !== 'string') { badArg(); }
	if ((/^[\.\\\/]/).test(id)) { throw new Error('The module id must be an absolute path'); }
	function badArg () {
		throw new Error('Bad signature, should be define(id?, dependencies?, factory)');
	}

	if (Exports.hasOwnProperty(id) && !Loading.has(id)) { throw new Error(`Duplicate definition of module "${ id }"`); }
	Loading.delete(id);

	if (typeof factory !== 'function') { return setExports(id, factory); }

	let special = false;
	if (!deps) {
		if (
			factory.length === 1
			&& (deps = parseDependencies(factory, id)).length
		) {
			special = true;
		} else {
			deps = [ 'require', 'exports', 'module', ].slice(0, factory.length);
		}
	}

	if (isNode) {
		const require = global._original_require_;
		const context = {
			require,
			exports: { },
			module: {
				get exports() { context.exports; },
				set exports(v) { context.exports = v; },
			},
		};
		const modules = deps.map(dep => context[dep.name || dep] || require(dep +''));
		const exports = special ? factory(makeObject(deps, modules)) : factory(...modules);
		setExports(id, exports == null ? context.exports : exports);
		return require(id);
	}

	const context = {
		require,
		id,
		url: new URL(basePath + id, location.origin),
		module: {
			get exports() { context.exports; },
			set exports(v) { context.exports = v; },
		},
		exports: { },
		initializing: true,
	};
	resolved.then(() => context.initializing = false);

	const promise = Promise.all(deps.map(dep => context.require(dep)))
	.then(modules => {
		const result = special ? factory(makeObject(deps, modules)) : factory(...modules);
		return isGenerator(factory) ? spawn(result) : result;
	})
	.catch(error => { console.error(`Definition of ${ id } failed:`, error); throw error; })
	.then(exports => setExports(id, exports == null ? context.exports : exports));
	context.loaded = promise;
	return setExports(id, promise);
}
define.amd = {
	destructuring: true,
	generator: true,
	promises: true,
	promise: true,
};

function setExports(id, exports) {
	if (isNode) {
		global._original_require_.cache[id +'.js'].exports = exports;
	} else {
		Exports[id] = exports;
	}
	return exports;
}

function require(name) {
	if (typeof arguments[1] === 'function') {
		if (Array.isArray(name)) {
			const modules = name.map(name => require.call(this, name));
			Promise.resolve(Promise.all(modules)).then(modules => arguments[1](...modules));
			return modules;
		} else {
			const module = require.call(this, name);
			Promise.resolve(module).then(arguments[1]);
			return module;
		}
	}

	switch (name.name || name) {
		case 'require': return bindContext.call(this);
		case 'exports': return this && this.exports;
		case 'module': return this && this.module;
	}

	const id = resolveId(name, this && this.url);
	let module = Exports[id]; if (module) { return module; }

	if (this && this.initializing) { return resolved.then(() => require.call(this, name)); } // let the event loop spin once to allow multiple define() calls within the same script

	Loading.add(id);
	const path = baseOrigin + basePath + id +'.js';
	const promise = loadScript(path)
	.catch(() => {
		const error = `Failed to load script "${ path }" requested from ${ this && this.url }.js`;
		console.error(error); throw new Error(error);
	})
	.then(() => {
		if (!Loading.has(id)) { return Exports[id]; }
		const error = `The script at "${ path }" did not call define with the expected id`;
		console.error(error); throw new Error(error);
	});
	return setExports(id, promise);
}
require.async = function() {
	return Promise.resolve(require(...arguments));
};
require.toUrl = path => baseOrigin + basePath + resolveId(path);

function bindContext() {
	const bound = require.bind(this);
	bound.toUrl = path => baseOrigin + basePath + resolveId(path, this && this.url);
	return bound;
}

function parseDependencies(factory, name) {
	const code = factory +'';
	let index = 0; // the next position of interest

	function next(exp) {
		exp.lastIndex = index;
		const match = exp.exec(code)[0];
		index = exp.lastIndex;
		return match;
	}
	const getWord = (/[a-zA-Z_]\w*/g);
	const nextWord = next.bind(null, getWord);
	const getString = (/(?:'.*?'|".*?"|`.*?`)/g);
	const nextString = next.bind(null, getString);
	const getLine = (/(?:\r?\n|\r)\s*/g);
	const nextLine = next.bind(null, getLine);

	function local(name) {
		const string = './'+ name.split('').map((c, i) => {
			const l = c.toLowerCase();
			return l === c ? c : i === 0 ? l : '-'+ l;
		}).join('');
		return { name, toString() {
			return string;
		}, };
	}

	index = (/^\s*(?:function)?\s*\*?\s*\(?\s*/).exec(code)[0].length; // skip 'function * ('
	if (code[index] === ')') { return [ ]; } // argument list closes immediately
	if (code[index] !== '{') { return [ ]; } // no destructuring assignment
	const deps = [ ];

	loop: do {
		nextLine();
		switch (code[index]) {
			case '}': break loop; // exit
			case '/': {
				code[index + 1] !== '/' && unexpected();
			} break;
			case '[': case "'": case '"': case '`': {
				deps.push(nextString().slice(1, -1));
			} break;
			default: {
				!(/[a-zA-Z_]/).test(code[index]) && unexpected();
				deps.push(local(nextWord()));
			}
		}
	} while (true);

	function unexpected() {
		throw new Error(`Unexpected char '${ code[index] }' in destructuring module definition of "${ name }" at char ${ index }`);
	}

	return deps;
}

function resolveId(to, from) {
	let id = to +'';
	if (id.endsWith('/')) {
		id += 'index';
	}
	if (id.startsWith('.')) {
		if (!from) { throw new Error(`Can't resolve relative module id from global require, use the one passed into the define callback instead`); }
		id = new URL(id, from).pathname;
		if (id.startsWith(basePath)) {
			id = id.slice(basePath.length);
		} else if (id.startsWith('/')) {
			id = id.slice(1);
		}
	} else if (id.startsWith('/')) {
		id = id.slice(1);
	}
	return id;
}

function makeObject(names, values) { // TODO: use a Proxy to directly throw for undefined properties?
	const object = { };
	for (let i = 0; i < names.length; ++i) {
		object[names[i].name || names[i]] = values[i];
	}
	return object;
}

function loadScript(path) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.onload = resolve;
		script.onerror = reject;
		script.src = path;
		document.documentElement.appendChild(script).remove();
	});
}

function getCallingScript(offset = 0) {
	const src = !isNode && document.currentScript && document.currentScript.src;
	if (src) { return src; }
	const stack = (new Error).stack.split(/$/m);
	const line = stack[(/^Error/).test(stack[0]) + 1 + offset];
	const parts = line.split(/(?:\@|\(|\ )/g);
	return parts[parts.length - 1].replace(/\:\d+\:\d+\)?$/, '');
}

function spawn(iterator) {
	const next = arg => handle(iterator.next(arg));
	const _throw = arg => handle(iterator.throw(arg));
	const handle = ({ done, value, }) => done ? Promise.resolve(value) : Promise.resolve(value).then(next, _throw);
	return resolved.then(next);
}

/// run the main module if specified via < data-main="..." >
const main = !isNode && document.currentScript && document.currentScript.dataset.main;
main && require('/'+ resolveId(main, location));

if (isNode) {
	global.define = define;
} else {
	window.define = define;
	window.require = require;
	require.Exports = Exports;
}

})();
