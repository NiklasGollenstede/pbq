(function(global) { 'use strict'; /* globals URL, location, */ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const document = typeof window !== 'undefined' && global.navigator && global.document;
const importScripts = typeof window === 'undefined' && typeof navigator === 'object' && typeof global.importScripts === 'function';
const webExt = document && !importScripts && (() => {
	const api = (global.browser || global.chrome);
	return api && api.extension && typeof api.extension.getURL === 'function' && api;
})();
const isContentScript = webExt && !document.currentScript;
const isGenerator = code => (/^function\s*\*/).test(code);
const resolved = Promise.resolve();

const Modules = { }; // id ==> Module
const Loading = { }; // url ==> Module (with .loading === true)

let   mainModule = null;
let   baseUrl = '';
let   hiddenBaseUrl = null; // scripts attached with tabs.executeScript can incorrectly have this file url prefix. replacing hiddenBaseUrl with baseUrl fixes that
const prefixMap = { };
let   modIdMap = null;
let   defIdMap = null;
let   loadScript = url => { throw new Error(`No JavaScript loader available to load "${ url }"`); };

{ // set default baseUrl
	const path = getCallingScript(0);
	const fromNM = (/\/node_modules\/[^\/]+\/require\.js$/).test(path);
	baseUrl = path.split('/').slice(0, fromNM ? -3 : -1).join('/') +'/';
}
if (webExt) {
	const actualBaseUrl = webExt.extension.getURL('');
	if (baseUrl !== actualBaseUrl) { hiddenBaseUrl = baseUrl; }
	baseUrl = actualBaseUrl;
}

function getCallingScript(offset = 0) {
	const src = document && document.currentScript && document.currentScript.src;
	if (src) { return src; }
	const stack = (new Error).stack.split(/$/m);
	const line = stack[(/^Error/).test(stack[0]) + 1 + offset];
	const parts = line.split(/(?:\@|\(|\ )/g);
	const url = parts[parts.length - 1].replace(/\:\d+(?:\:\d+)?\)?$/, '');
	if (hiddenBaseUrl !== null && url.startsWith(hiddenBaseUrl)) { return url.replace(hiddenBaseUrl, baseUrl); }
	return url;
}

function parseDepsDestr(factory, name, code) {
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

	index = (/^\s*(?:async\s*)?(?:function\s*)?(?:\*\s*)?(?:\(\s*)?/).exec(code)[0].length; // skip ' async function * ( '
	if (code[index] === ')') { return null; } // argument list closes immediately
	if (code[index] !== '{') { return null; } // no destructuring assignment
	const deps = [ ];

	loop: do { // eslint-disable-line
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

function parseDepsBody(factory, name, code) {
	if (factory.length === 0) { return [ ]; }
	const require = (/require\s*\(\s*(?:"(.*?)"|'.*?'|`.*?`)\s*\)/g);
	const whitespace = (/\s*/g);

	// try to find an early way out
	let match, found = false;
	while ((match = require.exec(code))) {
		const requireAt = match.index;
		const dotAt = code.lastIndexOf('.', requireAt);
		whitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + whitespace.exec(code)[0].length === requireAt) { continue; }
		found = true; break;
	}
	const deps = [ 'require', 'exports', 'module', ];
	if (!found) { return deps.slice(0, factory.length); }

	const stringsAndComments = (/(\'(?:[^\\]|\\[^\\]|(?:\\\\)*)*?\'|\"(?:[^\\]|\\[^\\]|(?:\\\\)*)*?\"|\`(?:[^\\]|\\[^\\]|(?:\\\\)*)*?\`)|\/\/[^]*?$|\/\*[^]*?\*\/|\/(?:[^\\]|\\[^\\]|(?:\\\\)*)*?\//gm);
	/* which (using the 'regexpx' module) is: RegExpX('gmsX')`
		(		# strings, allow multiple lines
				# these need to be put back if they are 'simple'
			  \' (?:[^\\]|\\[^\\]|(?:\\\\)*)*? \'
			| \" (?:[^\\]|\\[^\\]|(?:\\\\)*)*? \"
				# substitutions in template strings should be put back too,
				# but even just finding the closing bracket is not trivial,
				# especially because the expressions themselves can contain strings and comments
				# so they are (currently) ignored
			| \` (?:[^\\]|\\[^\\]|(?:\\\\)*)*? \`
		)
        |   \/\/ .*? $ # line comments
        |   \/\* .*? \*\/ # block comments
        |     \/ (?:[^\\]|\\[^\\]|(?:\\\\)*)*? \/ # RegExp literals
	`;
	and the expression between the quotes is: RegExpX`
		(?:
			  [^\\] # something that's not a backslash
			| \\ [^\\] # a backslash followed by something that's not
			| (?: \\\\ )* # an even number of backslashes
		)*?
	`;
	*/

	code = code.replace(stringsAndComments, (_, s) => (s && (s = s.slice(1, -1)) && !require.test(s) ? '"'+ s +'"' : ''));

	require.lastIndex = 0;
	while ((match = require.exec(code))) {
		const requireAt = match.index;
		const dotAt = code.lastIndexOf('.', requireAt);
		whitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + whitespace.exec(code)[0].length === requireAt) { continue; }
		deps.push(match[1]);
	}

	return deps.length === 3 ? deps.slice(0, factory.length) : deps;
}

function hasPendingPath(from, to) {
	if (from._children.size === 0) { return false; }
	return from.children.some(child => {
		if (child._resolved) { return false; }
		if (child === to) { return true; }
		// unless somebody messes with the ._resolved property, this traverses a directed acyclic graph
		return hasPendingPath(child, to);
	});
}

function makeObject(names, values) { // TODO: use a Proxy to directly throw for undefined properties?
	const object = { };
	for (let i = 0; i < names.length; ++i) {
		object[names[i].name || names[i]] = values[i];
	}
	return object;
}

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
	let src = '';
	if (id === undefined) {
		src = getCallingScript(1);
		const url = new URL(src);
		src = url.href.slice(0, url.href.length - url.hash.length - url.search.length);
		id = src.replace(/\.js$/, '');
		if (id.startsWith(baseUrl)) {
			id = id.slice(baseUrl.length);
		} else if (id.startsWith('/')) {
			id = id.slice(1);
		} else if (isContentScript && hiddenBaseUrl === null && (/^(?:jar:)?file:\/\/|^!/).test(url)) {
			// require.js was loaded via `conent_script` and has the correct url, but the current module is loaded by `tabs.executeScript` probably with an incorrect url
			for (const module of Object.values(Loading)) { if (id.endsWith('/'+ module.id)) {
				hiddenBaseUrl = id.slice(0, -module.id.length);
				console.warn(`Loaded file "${ url }" in a content script, will replace "${ hiddenBaseUrl }" with "${ baseUrl }" from now on`);
				id = module.id; src = src.replace(hiddenBaseUrl, baseUrl);
				break;
			} }
		}
	}
	if (typeof id !== 'string') { badArg(); }
	if ((/^[\.\\\/]/).test(id)) { throw new Error('The module id must be an absolute path'); }
	function badArg () {
		throw new TypeError('Bad signature, should be define(id?: string, dependencies?: Array<string>, factory: function|any)');
	}

	// get/create Module
	const module = src && Loading[src] || Modules[id] || (Modules[id] = new Module(null, null, id));
	if (module._loaded) { throw new Error(`Duplicate definition of module "${ id }"`); }
	module._loaded = true;
	delete Loading[src];

	if (typeof factory !== 'function') {
		resolved.then(() => {
			module.exports = factory;
			module._resolved = true;
			module.promise.resolve(module.exports);
		});
		return module.promise.then(() => module.exports);
	}

	const code = factory +'';
	module.factory = factory;

	// get deps
	let special = false;
	if (!deps) {
		if (
			factory.length === 1
			&& (deps = parseDepsDestr(factory, id, code))
		) {
			special = true;
		} else {
			deps = parseDepsBody(factory, id, code);
		}
	}

	resolved.then(() => Promise.all(deps.map(dep => { switch (dep.name || dep) {
		case 'require': return module.require;
		case 'exports': return module.exports;
		case 'module': return module;
		default: return module.requireAsync(dep +'', true);
	} })))
	.then(modules => {
		const result = special ? factory(makeObject(deps, modules)) : factory(...modules);
		return isGenerator(code) ? spawn(result) : result;
	})
	.catch(error => { console.error(`Definition of ${ id } failed:`, error); throw error; })
	.then(exports => {
		exports != null && (module.exports = exports);
		module._resolved = true;
		module.promise.resolve(module);
	})
	.catch(module.promise.reject);
	return module.promise;
}
define.amd = {
	destructuring: true,
	generator: true,
	promise: true,
};

class Module {
	constructor(parent, url, id) {
		this.url = url ? new URL(url) : id ? new URL(resolveUrl(id) +'.js') : '';
		this.id = id;
		this.parent = parent;
		this.factory = null;
		this.exports = { };
		this._children = new Set;
		this.promise = new PromiseCapability();
		this._loaded = false;
		this._resolved = false;
		this.isShim = false;

		this._require = null;
		Object.defineProperty(this, 'require', { get() {
			if (this._require) { return this._require; }
			const require = this._require = Module.prototype.require.bind(this);
			require.async = Module.prototype.requireAsync.bind(this);
			require.toUrl = Module.prototype.requireToUrl.bind(this);
			require.resolve = resolveId.bind(null, this.id);
			require.cache = Modules;
			require.config = config;
			Object.defineProperty(require, 'main', {
				get() { return mainModule; },
				set(module) {
					if (module instanceof Module) { mainModule = module; }
					else { throw new Error(`require.main must be a Module`); }
				},
				enumerable: true, configurable: true,
			});
			return require;
		}, enumerable: true, configurable: true, });
	}

	require(name) {
		if (typeof name === 'string') {
			let split = 0, id = '';
			if ((split = name.indexOf('!')) >= 0) { // get the plugin
				const pluginId = resolveId(this.id, name.slice(0, split));
				const plugin = Modules[pluginId];
				if (!plugin || !plugin._resolved) {
					throw new Error(`The plugin "${ pluginId }" is not defined (yet)`);
				}
				id = pluginId +'!'+ resolveByPlugin(plugin, this.id, name.slice(split + 1));
			} else {
				id = resolveId(this.id, name);
			}
			const module = Modules[id];
			if (!module || !module._resolved) {
				throw new Error(`The module "${ id }" is not defined (yet)`);
			}
			this._children.add(module);
			return module.exports;
		}
		const [ names, done, ] = arguments;
		if (Array.isArray(names) && typeof done === 'function') {
			Promise.all(names.map(name => this.requireAsync(name, true)))
			.then(result => done(...result))
			.catch(error => { console.error(`Failed to require([ ${ names }, ], ...)`); throw error; });
		} else {
			throw new Error(`require must be called with (string) or (Array, function)`);
		}
		return null;
	}

	requireAsync(name, fast, plugin) {
		let split = 0, id = '';
		if (plugin) {
			id = name;
		} else if ((split = name.indexOf('!')) >= 0) { // get the plugin
			const pluginId = resolveId(this.id, name.slice(0, split));
			const resName = name.slice(split + 1);
			if (fast && (plugin = Modules[pluginId]) && plugin._resolved) {
				id = resolveByPlugin(plugin, this.id, resName);
			} else {
				return this.requireAsync(pluginId)
				.then(() => {
					const plugin = Modules[pluginId];
					return this.requireAsync(resolveByPlugin(plugin, this.id, resName), true, plugin);
				});
			}
		} else {
			id = resolveId(this.id, name);
		}

		let module = Modules[id]; if (module) {
			this._children.add(module);
			if (module._resolved) {
				if (fast) { return module.exports; }
				return Promise.resolve(module.exports);
			}
			if (hasPendingPath(module, this)) {
				console.warn(`Found cyclic dependency to "${ id }", passing it's unfinished exports to "${ this.id }"`);
				this._children.delete(module);
				if (fast) {
					this.promise.then(() => this._children.add(module));
					return module.exports;
				}
				return Promise.reject(Error(`Asynchronously requiring "${ name }" from "${ this.id }" would create a cyclic waiting condition`));
			}
			return module.promise.then(() => module.exports);
		}

		if (plugin) {
			const fullId = plugin.id +'!'+ id;
			module = new Module(this, 'plugin:'+ fullId, fullId);
			!plugin.exports.dynamic && (Modules[fullId] = module) && this._children.add(module);
			plugin.exports.load(id, this.require, module.promise.resolve, { cancel: module.promise.reject, });
			return module.promise.then(exports => {
				module.exports = exports;
				module._loaded = module._resolved = true;
				return exports;
			});
		}

		const url = resolveUrl(id) +'.js';
		module = Modules[id] = Loading[url] = new Module(this, url, id);
		this._children.add(module);

		loadScript(url)
		.then(() => {
			if (module._loaded) { return; }
			if (this.isShim) {
				module._loaded = module._resolved = module.isShim = true;
				module.promise.resolve(module.exports);
				return void console.info(`The shim dependency "${ url }" of "${ this.id }" didn't call define`);
			}
			const message = `The script at "${ url }" did not call define with the expected id`;
			console.error(message); module.promise.reject(new Error(message));
		})
		.catch(error => {
			const message = `Failed to load script "${ url }" first requested from "${ this.url }"`;
			console.error(message +', due to:', error); module.promise.reject(new Error(message));
		});
		return module.promise.then(() => module.exports);
	}

	requireToUrl(path) {
		return resolveUrl(resolveId(this.id, path));
	}

	get children  () { return Array.from(this._children); }
	get loaded    () { return this._loaded; }
	get resolved  () { return this._resolved; }
}

const globalModule = new Module(null, '', '');
const require = globalModule.require;

function PromiseCapability() {
	let y, n; const promise = new Promise((_y, _n) => ((y = _y), (n = _n)));
	promise.resolve = y;
	promise.reject = n;
	return promise;
}

function resolveId(from, to) {
	let id = to +'';
	if (id.startsWith('.')) {
		if (!from) { throw new Error(`Can't resolve relative module id from global require, use the one passed into the define callback instead`); }
		const url = new URL(id, typeof from === 'string' ? baseUrl + from : from);
		id = url.href.slice(0, url.href.length - url.hash.length - url.search.length);
		if (id.startsWith(baseUrl)) {
			id = id.slice(baseUrl.length);
		} else if (id.startsWith('/')) {
			id = id.slice(1);
		}
	} else if (id.startsWith('/')) {
		id = id.slice(1);
	}
	if (id.endsWith('/')) {
		id += 'index';
	}
	if (!modIdMap && !defIdMap || typeof from !== 'string') { return id; }
	const maps = Object.keys(modIdMap || { })
	.filter(prefix => isIdPrefix(from, prefix))
	.sort((a, b) => b.length - a.length)
	.map(key => modIdMap[key])
	.concat(defIdMap || [ ]);
	for (let map of maps) { // eslint-disable-line
		const prefix = Object.keys(map)
		.filter(prefix => isIdPrefix(id, prefix))
		.reduce((a, b) => a.length > b.length ? a : b, '');
		if (prefix) {
			return map[prefix] + id.slice(prefix.length);
		}
	}
	return id;
}

function resolveUrl(id) {
	const prefix = Object.keys(prefixMap)
	.filter(prefix => isIdPrefix(id, prefix))
	.reduce((a, b) => a.length > b.length ? a : b, '');
	if (!prefix) { return baseUrl + id; }
	return prefixMap[prefix] + id.slice(prefix.length);
}

function isIdPrefix(id, prefix) {
	return (
		id === prefix
		|| id.length > prefix.length && id.startsWith(prefix) && (
			prefix.endsWith('/') || id[prefix.length] === '/'
			|| (/^\.[^\\\/]+$/).test(id.slice(prefix.length))
		)
	);
}

function resolveByPlugin(plugin, from, id) {
	if (plugin.exports && plugin.exports.normalize) {
		return plugin.exports.normalize(id, resolveId.bind(null, from));
	}
	return resolveId(from, id);
}

function onContentScriptMessage(message, sender, reply) {
	if (!Array.isArray(message) || !Array.isArray(message[2]) || message[0] !== 'require.loadScript' || message[1] !== 1 || !sender.tab) { return false; }
	let url = message[2][0];
	if (!url.startsWith(baseUrl)) { return reply([ '', -1, [ 'Can only load local resources', ], ]); }
	url = url.slice(baseUrl.length - 1);
	webExt.tabs.executeScript(sender.tab.id, { file: url, }, () => {
		if (webExt.runtime.lastError) { return reply([ '', -1, [ webExt.runtime.lastError.message, ], ]); }
		return reply([ '', 1, [ null, ], ]);
	});
	return true;
}

if (isContentScript) { // webExtension and not loaded via <script> tag
	loadScript = url => new Promise((resolve, reject) => webExt.runtime.sendMessage([ 'require.loadScript', 1, [ url, ], ], reply => {
		if (webExt.runtime.lastError) { return void reject(webExt.runtime.lastError); }
		if (!Array.isArray(reply)) { return void reject(new Error('Failed to load script. Bad reply')); }
		const threw = reply[1] < 0;
		threw ? reject(reply[2][0]) : resolve();
	}));
} else if (document) { // normal DOM window
	loadScript = url =>	new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.onload = resolve;
		script.onerror = reject;
		script.src = url;
		document.documentElement.appendChild(script).remove();
	});
} else if (importScripts) { // for WebWorkers, untested
	const requested = [ ];
	loadScript = url => {
		requested.push(url);
		resolved.then(
			() => requested.length
			&& importScripts(requested.splice(0, Infinity))
		);
	};
}

function spawn(iterator) {
	const next = arg => handle(iterator.next(arg));
	const _throw = arg => handle(iterator.throw(arg));
	const handle = ({ done, value, }) => done ? Promise.resolve(value) : Promise.resolve(value).then(next, _throw);
	return resolved.then(next);
}

function config(options) {
	if (options == null || typeof options !== 'object') { return; }

	if ('baseUrl' in options) {
		const url = new URL(options.baseUrl.replace(/^"(.*)"$/g, '$1'), location);
		baseUrl = url.href.slice(0, url.href.length - url.hash.length - url.search.length);
	}

	/// Set an id to be the main module. Loads the module if needed.
	if ('main' in options) {
		const id = resolveId(location, options.main.replace(/^"(.*)"$/g, '$1'));
		require.async(id);
		require.main = require.cache[id];
		require.main.parent = null;
	}

	if ('paths' in options) {
		const paths = typeof options.paths === 'string' ? JSON.parse(options.paths) : options.paths;
		Object.keys(paths).forEach(prefix => {
			const url = new URL(paths[prefix], baseUrl);
			prefixMap[prefix] = url.href.slice(0, url.href.length - url.hash.length - url.search.length);
		});
	}

	if ('map' in options) {
		const map = typeof options.map === 'string' ? JSON.parse(options.map) : options.map;
		Object.keys(map).forEach(id => {
			const idMap = Object.assign(map[id]);
			if (typeof idMap !== 'object') { return; }
			if (id === '*') {
				defIdMap = idMap;
			} else {
				modIdMap = modIdMap || { };
				modIdMap[id] = idMap;
			}
		});
	}

	if ('shim' in options) {
		const shims = typeof options.shim === 'string' ? JSON.parse(options.shim) : options.shim;
		Object.keys(shims).forEach(id => {
			const shim = shims[id];
			if (!shim || typeof shim !== 'object') { return; }
			const isArray = Array.isArray(shim);
			const deps = ((isArray ? shim : shim.deps) || [ ]).slice();
			const globalPath = !isArray && typeof shim.exports === 'string' && shim.exports.split('.') || [ ];
			const init = !isArray && typeof shim.init === 'function' ? shim.init : shim.exports === 'function' ? shim.exports : undefined;

			id = resolveId('', id);
			const url = resolveUrl(id) +'.js';

			define(id, deps, function*() {
				(yield loadScript(url).catch(() => {
					const message = `Failed to load script "${ url }" for shim`;
					console.error(message); throw new message(message);
				}));
				Modules[id]._loaded = true;
				const exports = globalPath.reduce((object, key) => object != null && object[key], global);
				if (!exports) {
					const message = `The script at "${ url }" did not set the global variable "${ globalPath.join('.') }" for shim`;
					console.error(message); throw new Error(message);
				}
				const result = init && (yield init.apply(global, arguments));
				return result !== undefined ? result : globalPath.length ? exports : undefined;
			});
			Modules[id]._loaded = false;
			Modules[id].isShim = true;
		});
	}

	if ('serveContentScripts' in options) {
		const value = options.serveContentScripts;
		if (value === 'false' || value === false) {
			webExt.runtime.onMessage.removeListener(onContentScriptMessage);
		} else {
			webExt.runtime.onMessage.addListener(onContentScriptMessage);
		}
	}
}

/// set the config specified in the script tag via < data-...="..." >
config(document.currentScript && document.currentScript.dataset);

global.define = define;
global.require = require;

})(this);
