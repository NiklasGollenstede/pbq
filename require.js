(function() { 'use strict'; // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const browser = typeof document !== 'undefined';

function getCallingScript(offset = 0) {
	const src = browser && document.currentScript && document.currentScript.src;
	if (src) { return src; }
	const stack = (new Error).stack.split(/$/m);
	const line = stack[(/^Error/).test(stack[0]) + 1 + offset];
	const parts = line.split(/(?:\@|\(|\ )/g);
	return parts[parts.length - 1].replace(/\:\d+(?:\:\d+)?\)?$/, '');
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

function makeObject(names, values) { // TODO: use a Proxy to directly throw for undefined properties?
	const object = { };
	for (let i = 0; i < names.length; ++i) {
		object[names[i].name || names[i]] = values[i];
	}
	return object;
}

const Generator = Object.getPrototypeOf(function*(){ yield 0; }).constructor;
function isGenerator(g) { return g instanceof Generator; }
const resolved = Promise.resolve();

const [ basePath, baseOrigin, ] = (() => {
	const path = getCallingScript(0);
	const fromNM = (/\/node_modules\/(?:require|es6lib)\/require\.js$/).test(path);
	const url = (fromNM ? new URL('../../', path) : new URL('./', location));
	return [ url.pathname, url.protocol +'//'+ (url.host || ''), ];
})();

const Modules = { };

function define(/* id, deps, factory */) {
	// parse arguments
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

	// get id
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
		throw new Error('Bad signature, should be define(id?: string, dependencies?: Array<string>, factory: function|any)');
	}

	// get/create Module
	const module = Modules[id] || (Modules[id] = new Module(null, null, id));
	if (module.loaded) { throw new Error(`Duplicate definition of module "${ id }"`); }
	module.loaded = true;

	if (typeof factory !== 'function') {
		resolved.then(() => {
			module.exports = factory;
			module.resolved = true;
			module.promise.resolve(module);
		});
		return module.promise.then(() => module.exports);
	}

	// get deps
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

	const promise = resolved.then(() => Promise.all(deps.map(dep => { switch (dep.name || dep) {
		case 'require': return module.require;
		case 'exports': return module.exports;
		case 'module': return module;
		default: return module.requireAsync(dep, true);
	} })))
	.then(modules => {
		const result = special ? factory(makeObject(deps, modules)) : factory(...modules);
		return isGenerator(factory) ? spawn(result) : result;
	})
	.catch(error => { console.error(`Definition of ${ id } failed:`, error); throw error; })
	.then(exports => {
		exports != null && (module.exports = exports);
		module.resolved = true;
		module.promise.resolve(module);
	})
	.catch(module.promise.reject);
	return module.promise;
}
define.amd = {
	destructuring: true,
	generator: true,
	promises: true,
	promise: true,
};

let mainModule;

class Module {
	constructor(parent, url, id) {
		this.url = new URL(url || baseOrigin + basePath + id +'.js');
		this.id = id;
		this.parent = parent;
		this.exports = { };
		this._children = new Set;
		this.promise = new PromiseCapability();
		this.loaded = false;
		this.resolved = false;

		this._require = null;
		Object.defineProperty(this, 'require', { get() {
			if (this._require) { return this._require; }
			const require = this._require = Module.prototype.require.bind(this);
			require.async = Module.prototype.requireAsync.bind(this);
			require.toUrl = Module.prototype.requireToUrl.bind(this);
			require.cache = Modules;
			Object.defineProperty(require, 'main', {
				get() { return mainModule; },
				set(module) { mainModule = module; },
				enumerable: true, configurable: true,
			});
			return require;
		}, enumerable: true, configurable: true, });
	}

	require(name) {
		if (typeof name === 'string') {
			const id = resolveId(name, this.url);
			const module = Modules[id];
			if (module && module.loaded) {
				this._children.add(module);
				return module.exports;
			}
			throw new Error(`The module "${ name }" is not defined (yet)`);
		}
		const [ names, done, ] = arguments;
		if (Array.isArray(names) && typeof done === 'function') {
			Promise.all(names.map(name => this.requireAsync(name)))
			.then(result => done(...result))
			.catch(error => { console.error(`Failed to require([ ${ names }, ], ...)`); throw error; });
		} else {
			throw new Error(`require must be called with (string) or (Array, function)`);
		}
	}

	requireAsync(name, fast) {
		const id = resolveId(name, this.url);

		let module = Modules[id]; if (module) {
			this._children.add(module);
			return fast && module.resolved ? module.exports : module.promise.then(() => module.exports);
		}

		const url = baseOrigin + basePath + id +'.js';
		module = Modules[id] = new Module(this, url, id);
		this._children.add(module);

		loadScript(url)
		.then(() => {
			if (module.loaded) { return; }
			const error = `The script at "${ url }" did not call define with the expected id`;
			console.error(error); module.promise.reject(new Error(error));
		})
		.catch(() => {
			const error = `Failed to load script "${ url }" first requested from ${ this.url }.js`;
			console.error(error); module.promise.reject(new Error(error));
		});
		return module.promise.then(() => module.exports);
	}

	requireToUrl(path) {
		return baseOrigin + basePath + resolveId(path, this.url);
	}

	get children() {
		return Array.from(this._children);
	}
}

const globalModule = new Module(null, '', '');
const require = globalModule.require;

function PromiseCapability() {
	let y, n, promise = new Promise((_y, _n) => (y = _y, n = _n));
	promise.resolve = y;
	promise.reject = n;
	return promise;
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

function loadScript(path) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.onload = resolve;
		script.onerror = reject;
		script.src = path;
		document.documentElement.appendChild(script).remove();
	});
}

function spawn(iterator) {
	const next = arg => handle(iterator.next(arg));
	const _throw = arg => handle(iterator.throw(arg));
	const handle = ({ done, value, }) => done ? Promise.resolve(value) : Promise.resolve(value).then(next, _throw);
	return resolved.then(next);
}

/// run the main module if specified via < data-main="..." >
const main = document.currentScript && document.currentScript.dataset.main;
if (main) {
	const id = resolveId(main, location);
	require.async(id); // TODO: .catch ?
	require.main = require.cache[id];
	require.main.parent = null;
}

window.define = define;
window.require = require;

})();
