(function(global) { 'use strict'; /* globals URL, location, URLSearchParams, clearTimeout, setTimeout, */ // licanse: MIT

const document = typeof window !== 'undefined' && global.navigator && global.document;
let baseUrl = '', hiddenBaseUrl = null, loadConfig = { }; { // set default baseUrl
	let url = getCallingScript(0), urlQuery;
	[ , url, urlQuery, ] = (/^(.*?)(?:\?|\#|$)(.*)$/).exec(url);
	const fromNM = (/\/node_modules\/[^\/]+\/require\.js$/).test(url);
	baseUrl = url.split('/').slice(0, fromNM ? -3 : -1).join('/') +'/';
	loadConfig = parseQuery(urlQuery); /// set the config specified in the url query params
}
if (document && document.currentScript) { /// set the config specified in the script tag via < data-...="..." >
	Object.assign(loadConfig, parseDataset(document.currentScript.dataset));
}

if (typeof global.define === 'function' && define.amd) { switch (loadConfig.ifExisting) {
	case 'replace': break;
	case 'warn': console.warn('Existing AMD loader will be overwritten'); break;
	case 'throw': throw new Error(`An AMD loader already exists`);
	default: return;
} }

const importScripts = typeof window === 'undefined' && typeof navigator === 'object' && typeof global.importScripts === 'function';
const isContentScript = document && !document.currentScript && !importScripts
&& (api => api && api.extension && typeof api.extension.getURL === 'function' || false)(global.browser || global.chrome);
const isGenerator = code => (/^function\s*\*/).test(code);
const resolved = Promise.resolve();

const Modules = Object.create(null); // id ==> Module
const Loading = Object.create(null); // url ==> Module (with .loading === true)
const Self = new WeakMap/*<Module, object>*/;

const moduleConfig = Object.create(null); // moduleId ==> module.config()
let   mainModule = null;
const prefixMap = Object.create(null); // url prefix map (idPrefix ==> urlPrefix), instead of baseUrl
let   modIdMap = null; // id prefix maps by id of requesting module (requestinModuleId ==> idPrefix ==> idPrefix)
let   defIdMap = null; // id prefix map for '*' (idPrefix ==> idPrefix)
let   loadScript; setScriptLoader(null);
let   scriptTimeout = 7000; // ms after which a script load is assumed to have failed
const shims = Object.create(null); // moduleId ==> { deps, exports, init, }


function getCallingScript(offset = 0) {
	const stack = (new Error).stack.split(/$/m);
	const line = stack[(/^Error/).test(stack[0]) + 1 + offset];
	const parts = line.split(/\@(?![^\/]*?\.xpi)|\(|\ /g);
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
	if (code[index] === ')') { return [ ]; } // argument list closes immediately
	if (code[index] !== '{') { // no destructuring assignment
		return (/^require\b/).test(code.slice(index, index + 8)) ? null : [ ]; // if the first argument is literally named require, allow to scan the body
	}
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
	const require = (/\brequire\s*\(\s*(?:"(.*?)"|'.*?'|`.*?`)\s*\)/g);
	const whitespace = (/\s*/g);

	// try to find an early way out
	let match, found = false;
	while ((match = require.exec(code))) {
		const requireAt = match.index;
		const dotAt = code.lastIndexOf('.', requireAt);
		whitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + whitespace.exec(code)[0].length === requireAt) { continue; } // require was used as a method
		found = true; break;
	}
	const deps = [ 'require', 'exports', 'module', ];
	if (!found) { return deps.slice(0, factory.length); } // there was no literal `require("string")` call ==> just return the mandatory deps

	// this thing looks huge, but it is quite precise and very efficient
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
		|   \/\/ .*? $      # line comments
		|   \/\* .*? \*\/   # block comments
		|     \/ (?:[^\\]|\\[^\\]|(?:\\\\)*)*? \/   # RegExp literals
	`;
	and the expression between the quotes is: RegExpX`
		(?:
			  [^\\]         # something that's not a backslash
			| \\ [^\\]      # a backslash followed by something that's not, so this consumes escaped closing quotes
			| (?: \\\\ )*   # an even number of backslashes
		)*?
	`;
	*/

	// remove all comments and strings. Put only "simple" strings back
	code = code.replace(stringsAndComments, (_, string) => {
		if (!string) { return ''; }
		string = string.slice(1, -1);
		if ((/["'`\\\r\n]/).test(string)) { return ''; }
		return '"'+ string +'"';
	}); // s && (s = s.slice(1, -1) && !(/["'`\\\r\n]/).test(s) && !require.test(s) ? '"'+ s +'"' : '')); // avoid recursive matchings of the require RegExp

	require.lastIndex = 0;
	while ((match = require.exec(code))) {
		const requireAt = match.index;
		const dotAt = code.lastIndexOf('.', requireAt);
		whitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + whitespace.exec(code)[0].length === requireAt) { continue; } // require was used as a method
		deps.push(match[1]);
	}

	return deps.length === 3 ? deps.slice(0, factory.length) : deps;
}

function hasPendingPath(from, to) {
	const { children, } = from;
	if (children.length === 0) { return false; }
	return children.some(child => {
		if (child.resolved) { return false; }
		if (child === to) { return true; }
		// unless somebody messes with the .resolved property, this traverses a directed acyclic graph
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
		src = url.href.slice(0, url.href.length - url.search.length - url.hash.length);
		id = url2id(src.replace(/\.js$/, ''));
		const query = url.search + url.hash;
		if (query) { moduleConfig[id] = parseQuery(query); }
	}
	if (typeof id !== 'string') { badArg(); }
	if ((/^[\.\\\/]/).test(id)) { throw new Error('The module id must be an absolute path'); }
	function badArg () {
		throw new TypeError('Bad signature, should be define(id?: string, dependencies?: Array<string>, factory: function|any)');
	}

	// get/create Module
	const module = src && Loading[src] || Modules[id] || (Modules[id] = new Module(null, null, id)), self = Self.get(module);
	if (self.loaded) { throw new Error(`Duplicate definition of module "${ id }"`); }
	self.loaded = true;
	delete Loading[src];

	if (typeof factory !== 'function') {
		resolved.then(() => {
			module.exports = factory;
			self.resolved = true;
			self.resolve(module.exports);
		});
		return self.promise;
	}

	const code = factory +'';
	module.factory = factory;

	// get deps
	let special = false; if (!deps) { if (
		factory.length === 1
		&& (deps = parseDepsDestr(factory, id, code))
	) {
		special = true;
	} else {
		deps = parseDepsBody(factory, id, code);
	} }

	resolved.then(() => Promise.all(deps.map(dep => { switch (dep.name || dep) {
		case 'require': return module.require;
		case 'exports': return module.exports;
		case 'module': return module;
		default: return Private.requireAsync.call(module, dep +'', true, null, false);
	} })))
	.then(modules => {
		const result = special ? factory(makeObject(deps, modules)) : factory.apply(null, modules);
		return isGenerator(code) ? spawn(result) : result;
	})
	// .catch(error => { console.error(`Definition of ${ id } failed:`, error); throw error; })
	.then(exports => {
		exports != null && (module.exports = exports);
		self.resolved = true;
		self.resolve(module.exports);
	})
	.catch(self.reject);
	return self.promise;
}
define.amd = {
	destructuring: true,
	promise: true,
};

class Module {
	constructor(parent, url, id) {
		const _this = { }; Self.set(this, _this);
		this.id = id;
		// this.url = url ? new URL(url) : id ? new URL(id2url(id) +'.js') : '';
		this.parent = parent;
		this.factory = null;
		this.exports = { };
		this.isShim = false;
		_this.promise = Object.freeze(new Promise((y, n) => ((_this.resolve = y), (_this.reject = n))));
		_this.children = new Set;
		_this.loaded = false;
		_this.resolved = false;
	}

	get require() {
		const require = Private.require.bind(this);
		require.async = id => Private.requireAsync.call(this, id, false, null, false);
		require.toUrl = id => id2url(resolveId(this.id, id, true));
		require.resolve = resolveId.bind(null, this.id);
		require.cache = Modules;
		require.config = conf => config(this, conf);
		Object.defineProperty(require, 'main', {
			get() { return mainModule; },
			set(module) {
				if (module instanceof Module) { mainModule = module; }
				else { throw new Error(`require.main must be a Module`); }
			},
			enumerable: true, configurable: true,
		});
		Object.defineProperty(this, 'require', { value: require, enumerable: true, configurable: true, });
		return require;
	}

	get children  () { return Array.from(Self.get(this).children); }
	get ready     () { return Self.get(this).promise; } // ==> .exports
	get loaded    () { return Self.get(this).loaded; }
	get resolved  () { return Self.get(this).resolved; }
	config() { return moduleConfig[this.id]; }
}

const Private = {
	require(name) {
		if (typeof name === 'string') { if (arguments.length === 1) {
			let split = 0, id = '';
			if ((split = name.indexOf('!')) >= 0) { // get the plugin
				const pluginId = resolveId(this.id, name.slice(0, split));
				const plugin = Modules[pluginId];
				if (!plugin || !plugin.resolved) {
					throw new Error(`The plugin "${ pluginId }" is not defined (yet)`);
				}
				id = pluginId +'!'+ resolveByPlugin(plugin, this.id, name.slice(split + 1));
			} else {
				id = resolveId(this.id, name);
			}
			const module = Modules[id];
			if (!module || !module.resolved) {
				throw new Error(`The module ${ id } is not defined (yet)`);
			}
			Self.get(this).children.add(module);
			return module.exports;
		} else {
			arguments[0] = [ name, ];
		} }
		const [ names, done, failed, ] = arguments;
		if (Array.isArray(names) && typeof done === 'function') {
			Promise.all(names.map(name => Private.requireAsync.call(this, name, true, null, true)))
			.then(result => done.apply(null, result))
			.catch(typeof failed === 'function' ? failed : (error => console.error(`Failed to require([ ${ names }, ], ...):`, error)));
		} else {
			throw new Error(`require must be called with (string) or (Array<string>, function, function?)`);
		}
		return null;
	},

	requireAsync(name, fast, plugin, allowCyclic) {
		let split = 0, id = '';
		if (plugin) {
			id = name;
		} else if ((split = name.indexOf('!')) >= 0) { // get the plugin
			const pluginId = resolveId(this.id, name.slice(0, split));
			const resName = name.slice(split + 1);
			if (fast && (plugin = Modules[pluginId]) && plugin.resolved) {
				id = resolveByPlugin(plugin, this.id, resName);
			} else if (!Modules[pluginId] && (plugin = defaultPlugins[pluginId])) {
				return plugin(this, resName);
			} else {
				return Private.requireAsync.call(this, pluginId, false, null, false)
				.then(() => {
					const plugin = Modules[pluginId];
					return Private.requireAsync.call(this, resolveByPlugin(plugin, this.id, resName), true, plugin, false);
				});
			}
		} else {
			id = resolveId(this.id, name);
		}

		const _this = Self.get(this);
		let module = Modules[id], self; if (module) { self = Self.get(module);
			if (!self.resolved && hasPendingPath(module, this)) {
				if (!fast) { return Promise.reject(Error( // require.async('...')
					`Asynchronously requiring "${ name }" from "${ this.id }" before either of them is resolved would create a cyclic waiting condition`
				)); }
				_this.promise.then(() => _this.children.add(module)); // must add delayed to avoid unresolved cycles
				if (allowCyclic) { return self.promise; } // require(['...'], ...)
				console.warn(`Found cyclic dependency to "${ id }", passing it's unfinished exports to "${ this.id }"`);
				return module.exports; // define(['...'], ...)
			}
			_this.children.add(module);
			return fast && self.resolved ? module.exports : self.promise;
		}

		if (plugin) {
			const fullId = plugin.id +'!'+ id;
			module = new Module(this, 'plugin:'+ fullId, fullId); self = Self.get(module);
			!plugin.exports.dynamic && (Modules[fullId] = module) && _this.children.add(module);
			plugin.exports.load(id, this.require, self.resolve, { cancel: self.reject, });
			return self.promise.then(exports => {
				module.exports = exports;
				self.loaded = self.resolved = true;
				return exports;
			});
		}

		const url = id2url(id) +'.js';
		module = Modules[id] = Loading[url] = new Module(this, url, id); self = Self.get(module);
		_this.children.add(module);

		if (id in shims) {
			const shim = shims[id]; delete shims[id];
			module.isShim = true;

			return define(id, shim.deps, function*() {
				(yield loadScript(url).catch(() => { throw new Error(`Failed to load script "${ url }" for shim`); }));
				self.loaded = true; delete Loading[url];
				const exports = shim.exports.reduce((object, key) => object != null && object[key], global);
				if (exports === undefined) { throw new Error(`The script at "${ url }" did not set the global variable "${ shim.exports.join('.') }" for shim`); }
				const result = shim.init && (yield shim.init.apply(global, arguments));
				return result !== undefined ? result : shim.exports.length ? exports : undefined;
			});
		}

		loadScript(url)
		.then(() => {
			if (self.loaded) { return; }
			if (this.isShim) {
				self.loaded = self.resolved = module.isShim = true;
				self.resolve(module.exports);
				return void console.info(`The shim dependency "${ url }" of ${ this.id } didn't call define. Prefix it with "shim!" to suppress this warning.`);
			}
			self.reject(new Error(`The script at "${ url }" did not call define with the expected id`));
		})
		.catch(() => self.reject(new Error(`Failed to load script "${ url }" first requested from ${ this.id || '[global]' }`)));
		return self.promise;
	},
};

const globalModule = new Module(null, '', '');
const require = globalModule.require;

function resolveId(from, to, noAppend) {
	let id = to +'';
	if (id.startsWith('.')) {
		if (!from) { throw new Error(`Can't resolve relative module id from global require, use the one passed into the define callback instead`); }
		id = new URL(id, typeof from === 'string' ? baseUrl + from : from).href;
		id.startsWith(baseUrl) && (id = id.slice(baseUrl.length));
	} else if (id.startsWith('/')) {
		id = id.slice(1);
	}
	!noAppend && id.endsWith('/') && (id += 'index');
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

function id2url(id) {
	const idPrefix = Object.keys(prefixMap)
	.filter(idPrefix => isIdPrefix(id, idPrefix))
	.reduce((a, b) => a.length > b.length ? a : b, '');
	if (!idPrefix) { return baseUrl + id; }
	return prefixMap[idPrefix] + id.slice(idPrefix.length);
}

function url2id(url) {
	const urlPrefix = Object.keys(prefixMap)
	.filter(urlPrefix => isIdPrefix(url, prefixMap[urlPrefix]))
	.reduce((a, b) => a.length > b.length ? a : b, '');
	if (!urlPrefix) { return url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url.replace(/^\//, ''); }
	const idPrefix = Object.keys(prefixMap).find(idPrefix => prefixMap[idPrefix] === urlPrefix);
	return idPrefix + url.slice(urlPrefix.length);
}

function isIdPrefix(id, prefix) {
	return (id === prefix || id.length > prefix.length && id.startsWith(prefix) && id[prefix.length] === '/');
	// || (/^\.[^\\\/]+$/).test(id.slice(prefix.length))
}

function resolveByPlugin(plugin, from, id) {
	if (plugin.exports && plugin.exports.normalize) {
		return plugin.exports.normalize(id, resolveId.bind(null, from));
	}
	return resolveId(from, id);
}

function parseQuery(query) {
	return parseJsonIterator(new URLSearchParams(query.replace(/[?#]+/, '&')));
}

function parseDataset(dataset) {
	return parseJsonIterator(Object.entries(dataset));
}

function parseJsonIterator(it) {
	const config = { }; for (const [ key, value, ] of it) {
		try { config[key] = JSON.parse(value); } catch(_) { config[key] = value; }
	} return config;
}

function domLoader(url) { return new Promise((resolve, reject) => {
	const script = document.createElement('script');
	script.addEventListener('load', () => { resolve(); clearTimeout(timer); script.remove(); });
	script.addEventListener('error', e => { reject(e); clearTimeout(timer); script.remove(); });
	script.src = url;
	// .remove()ing the script immediately causes chrome to randomly fire error events even though the script loaded
	(document.head || document.documentElement).appendChild(script);
	const timer = scriptTimeout && setTimeout(() => reject(new Error(`Load of script at "${ url }" timed out`)), scriptTimeout);
}); }

const requestedUrls = [ ];
function workerLoder(url) {
	requestedUrls.push(url);
	return resolved.then(
		() => requestedUrls.length
		&& importScripts(requestedUrls.splice(0, Infinity))
	);
}

function setScriptLoader(loader) {
	if (typeof loader !== 'function') {
		loadScript = document && !isContentScript ? domLoader : importScripts ? workerLoder
		: url => { throw new Error(`No JavaScript loader available to load "${ url }"`); };
	} else {
		loadScript = loader;
	}
}

function spawn(iterator) {
	const next = arg => handle(iterator.next(arg));
	const _throw = arg => handle(iterator.throw(arg));
	const handle = ({ done, value, }) => done ? Promise.resolve(value) : Promise.resolve(value).then(next, _throw);
	return resolved.then(next);
}

const defaultPlugins = {
	shim(parent, string) {
		const [ relative, exports, ] = string.split(/:(?!.*:)/), id = resolveId(parent.id, relative);
		!Modules[id] && config(parent, { shim: { [id]: { exports, }, }, });
		return Private.requireAsync.call(parent, id, false, null, false);
	},
	fetch(parent, string) {
		const [ relative, type, ] = string.split(/:(?!.*:)/), id = resolveId(parent.id, relative);
		!Modules[id] && define(id, [ ], () => global.fetch(id2url(id)).then(_=>_[type || 'text']()));
		return Private.requireAsync.call(parent, id, false, null, false);
	},
};

function config(module, options) {
	if (options == null || typeof options !== 'object') { return; }
	const baseId = module.id;

	if ('baseUrl' in options) {
		baseUrl = new URL((options.baseUrl.startsWith('/') ? '/' : '') + resolveId(baseId, options.baseUrl, true), baseUrl).href;
	}

	if ('hiddenBaseUrl' in options) {
		hiddenBaseUrl = options.hiddenBaseUrl;
	}

	if (options.config) {
		Object.keys(options.config).forEach(id => {
			moduleConfig[resolveId(baseId, id)] = options.config[id];
		});
	}

	if ('paths' in options) {
		const paths = options.paths;
		Object.keys(paths).forEach(prefix => {
			prefixMap[resolveId(baseId, prefix)] = id2url(resolveId(baseId, paths[prefix], true));
		});
	}

	if ('map' in options) {
		Object.keys(options.map).forEach(key => {
			let target; if (key === '*') {
				target = defIdMap || (defIdMap = Object.create(null));
			} else {
				modIdMap || (modIdMap = Object.create(null));
				const id = resolveId(baseId, key, true);
				target = modIdMap[id] || (modIdMap[id] = Object.create(null));
			}
			const map = options.map[key]; Object.keys(map).forEach(from => {
				target[resolveId(baseId, from)] = resolveId(baseId, map[from]);
			});
		});
	}

	/// Set an id to be the main module. Loads the module if needed.
	if ('main' in options) {
		const id = resolveId(baseId, options.main);
		module.require.async(id)
		.catch('errback' in options ? null : error => console.error(`Failed to load main module ${ id }:`, error));
		const main = require.main = require.cache[id];
		main.parent = null;
	}

	if ('shim' in options) {
		Object.keys(options.shim).forEach(id => {
			const shim = options.shim[id];
			if (!shim || typeof shim !== 'object') { return; }
			const isArray = Array.isArray(shim);
			shims[resolveId(baseId, id)] = {
				deps: ((isArray ? shim : shim.deps) || [ ]).slice(),
				exports: !isArray && typeof shim.exports === 'string' && shim.exports.split('.') || [ ],
				init: !isArray && typeof shim.init === 'function' ? shim.init : shim.exports === 'function' ? shim.exports : undefined,
			};
		});
	}

	if ('waitSeconds' in options) {
		scriptTimeout = options.waitSeconds * 1000 << 0;
	}

	if ('defaultLoader' in options) {
		setScriptLoader(options.defaultLoader);
	}

	if ('deps' in options) {
		options.deps.forEach(module.require);
	}

	if ('callback' in options || 'errback' in options) {
		Promise.all(module.children.map(_=>_.promise)).then(options.callback, options.errback);
	}
}

require.config(loadConfig); loadConfig = null;
if (typeof global.require === 'object') { require.config(global.require); }

global.define = define;
global.require = require;

})(this);
