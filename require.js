(function(global) { 'use strict'; /* globals URL, URLSearchParams, clearTimeout, setTimeout, */ // license: MIT

/**
 * variables
 */

/// utils
const loadingInNode = typeof __export_only__ !== 'undefined' && !('__export_only__' in global);
const document = !loadingInNode && typeof window !== 'undefined' && global.navigator && global.document;
const importScripts = typeof window === 'undefined' && typeof navigator === 'object' && typeof global.importScripts === 'function' && global.importScripts;
const resolved = Promise.resolve();

/// module registry
const Modules = Object.create(null); // id ==> Module
const Loading = Object.create(null); // url ==> Module (with .loading === true)
const Self = new WeakMap/*<Module, object>*/;

/// configuration
const moduleConfig = Object.create(null); // moduleId ==> module.config()
let   mainModule = null;
const prefixMap = Object.create(null); // url prefix map (idPrefix ==> urlPrefix), instead of baseUrl
let   getUrlArgs = null; // `urlArgs` config value, as set by user
let   modIdMap = null; // id prefix maps by id of requesting module (requestinModuleId ==> idPrefix ==> idPrefix)
let   defIdMap = null; // id prefix map for '*' (idPrefix ==> idPrefix)
let   getCallingScript = defaultGetCallingScript; // function(depth:number) => (url: string)
let   loadScript; setScriptLoader(null); // async function(url) that fetches and evals scripts
let   scriptTimeout = 7000; // ms after which a script load is assumed to have failed
const shims = Object.create(null); // moduleId ==> { deps, exports, init, }
let   baseUrl = '';
let   loadConfig = { }; // this is only set before this script returns
let   dryRun = false; // iff `true`, won't call into factory functions and will collect some additional dependency information


/**
 * preparation
 */

/// Load the config specified in the url query params and `<script data-${key}="${value:JSON|string}" ... >` and set the initial `baseUrl`.
if (loadingInNode) { baseUrl = 'file:///'; } else {
	let url = getCallingScript(0), urlQuery;
	[ , url, urlQuery, ] = (/^(.*?)(?:\?|#|$)(.*)$/).exec(url);
	const fromNM = (/\/node_modules\/[^/]+\/require\.js$/).test(url); // this should be the standard, but is hardly the `baseUrl`, so step out of it
	baseUrl = new URL(url.split('/').slice(0, fromNM ? -3 : -1).join('/') +'/').href;
	const fromDataset = document && document.currentScript && parseDataset(document.currentScript.dataset);
	loadConfig = Object.assign(parseQuery(urlQuery), fromDataset || null); // use fromDataset with higher priority
}

// decide what to do if there is already an AMD loader present, based on the config passed via the url params and the scripts dataset
if (typeof global.define === 'function' && define.amd) { switch (loadConfig.ifExisting) {
	case 'replace': break;
	case 'warn': console.warn('Existing AMD loader will be overwritten'); break;
	case 'throw': throw new Error(`An AMD loader already exists`);
	default: return;
} }
// the other values in `loadConfig` will be interpreted later


/**
 * string parsers
 */

function defaultGetCallingScript(offset = 0) {
	const stack = (new Error).stack.split(/$/m);
	const line = stack[(/^Error/).test(stack[0]) + 1 + offset];
	const parts = line.split(/@(?![^/]*?\.xpi)|\(|\s+/g);
	return parts[parts.length - 1].replace(/:\d+(?::\d+)?\)?$/, '');
}

const line = (/.*?(?:\r?\n|\r)\s*/g);
const whitespace = (/\s*/g);
const word = (/[a-zA-Z_]\w*/g);
const string = (/(?:'.*?'|".*?"|`.*?`)/g);

function parseDepsDestr(code, id, length) { void length;
	let index = 0; // the next position of interest

	function next(exp) {
		exp.lastIndex = index;
		const match = exp.exec(code)[0];
		index = exp.lastIndex;
		return match;
	}

	index = (/^\s*(?:async\s*)?(?:function\s*)?(?:\*\s*)?(?:\(\s*)?/).exec(code)[0].length; // skip ' async function * ( '
	if (code[index] === ')') { return [ ]; } // argument list closes immediately
	if (code[index] !== '{') { // no destructuring assignment
		return (/^require\b/).test(code.slice(index, index + 8)) ? null : [ ]; // if the first argument is literally named require, return null to indicate that the body should be scanned
	}
	const deps = [ ];
	const setUse = !dryRun ? _=>_ : line => {
		const dep = deps[deps.length - 1];
		line = line.trim().replace(/^]\s*/, '');
		if (line[0] !== ':') { line = ': '+ dep.name +' '+ line; }
		dep.use = line;
	};

	++index; next(/(?=\S)/g); // skip to first thing
	loop: do { // eslint-disable-line
		switch (code[index]) {
			case '}': break loop; // exit
			case '/': switch (code[index + 1]) {
				case '*': index += 2; next(/\*\/\s*/g); break;
				case '/': next(line); break;
				default: unexpected();
			} break;
			case '[': case "'": case '"': case '`': {
				deps.push({ id: next(string).slice(1, -1), }); setUse(next(line));
			} break;
			default: {
				!(/[a-zA-Z_]/).test(code[index]) && unexpected();
				deps.push(local(next(word)));
				code[index] === ',' ? next(/,\s*/g) : setUse(next(line));
			}
		}
	} while (true);

	if (dryRun) { deps.lastIndex = index; }

	return deps;

	function local(name) {
		const id = './'+ name.split('').map((c, i) => {
			const l = c.toLowerCase();
			return l === c ? c : i === 0 ? l : '-'+ l;
		}).join('');
		return { name, id, };
	}

	function unexpected() {
		throw new Error(`Unexpected char '${code[index]}' in destructuring module definition of "${id}" at char ${index}`);
	}
}

function parseDepsBody(code, id, length) {
	if (length === 0) { return [ ]; }
	const require = (/\brequire\s*\(\s*(?:"(.*?)"|'.*?'|`.*?`)\s*\)/g);

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
	if (!found) { return deps.slice(0, length); } // there was no literal `require("string")` call ==> just return the mandatory deps

	code = simplyfyCode(code);

	require.lastIndex = 0;
	while ((match = require.exec(code))) {
		const requireAt = match.index;
		const dotAt = code.lastIndexOf('.', requireAt);
		whitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + whitespace.exec(code)[0].length === requireAt) { continue; } // require was used as a method
		deps.push(match[1]);
	}

	return deps.length === 3 ? deps.slice(0, length) : deps;
}

function simplyfyCode(code) {

	// this thing looks huge, but it is quite precise and very efficient
	const stringsAndComments = (/('(?:[^\\]|\\[^\\]|(?:\\\\)*)*?'|"(?:[^\\]|\\[^\\]|(?:\\\\)*)*?"|`(?:[^\\]|\\[^\\]|(?:\\\\)*)*?`)|\/\/[^]*?$|\/\*[^]*?\*\/|\/(?:[^\\]|\\[^\\]|(?:\\\\)*)*?\//gm);
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
	return code.replace(stringsAndComments, (_, string) => {
		if (!string) { return ''; }
		string = string.slice(1, -1);
		if ((/["'`\\\r\n]/).test(string)) { return ''; }
		return '"'+ string +'"';
	});
}

const makeObject = typeof Proxy === 'function' ? (names, values) => {
	const keys = names.map(_ => _.name || _.id); let last = -1;
	return new Proxy({ }, { get(_, key) { // proxy allows to throw on unexpected reads
		// the destructuring assignment reads the properties in the same order as they were parsed
		if (keys[++last] === key) { return values[last]; } // so this is very likely and fast
		last = keys.indexOf(key); if (last >= 0) { return values[last]; } // and this should almost never happen
		throw new Error(`Attempt to read dependency "${key}" that was not recognized when parsing.`);
	}, });
} : (names, values) => {
	const object = { }; for (let i = 0; i < names.length; ++i) {
		object[names[i].name || names[i]] = values[i];
	} return object;
};


/**
 * define, Module and require
 */

function define(/* id, deps, factory */) {
	// parse arguments
	function badArg () { throw new TypeError('Bad signature, should be `define(id?: string, dependencies?: Array<string>, factory: function|any)`'); }
	let id, deps, factory; switch (arguments.length) {
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
		default: badArg();
	}
	if (id !== undefined && typeof id !== 'string') { badArg(); }

	// get id
	let url = null, src = '';
	if (id === undefined) {
		src = getCallingScript(1);
		url = new URL(src);
		src = url.href.slice(0, url.href.length - url.search.length - url.hash.length);
		id = url2id(src.replace(/\.js$/, ''));
		const query = url.search + url.hash;
		if (query) { moduleConfig[id] = parseQuery(query); }
	}
	if ((/^[.\\/]/).test(id)) { throw new Error('The module id must be an absolute path'); }

	// get/create Module
	const module = src && Loading[src] || Modules[id] || (Modules[id] = new Module(null, url, id)), self = Self.get(module);
	if (self.loaded) { throw new Error(`Duplicate definition of module "${id}"`); }
	self.loaded = true; delete Loading[src];

	if (typeof factory !== 'function') {
		Promise.resolve(factory).then(exports => {
			self.resolved = true; self.resolve(module.exports = exports);
		}).catch(error => self.reject(error)); return module;
	}

	const code = factory +'';
	module.factory = factory;

	// get deps
	let special = false; if (!deps) { if (
		factory.length === 1
		&& (deps = parseDepsDestr(code, id, factory.length))
	) {
		special = true;
	} else {
		deps = parseDepsBody(code, id, factory.length);
	} }

	if (dryRun) { factory = () => null; module.exports = null; module._deps = deps; if (special) { module._special = true; special = false; } }

	resolved.then(() => Promise.all(deps.map(dep => { {
		if (typeof dep === 'object') { dep = dep.id; }
	} switch (dep) {
		case 'require': return module.require;
		case 'exports': return module.exports;
		case 'module': return module;
		default: return Private.requireAsync.call(module, dep, true, null, false);
	} })))
	.then(modules => special ? factory(makeObject(deps, modules)) : factory.apply(null, modules))
	.then(exports => {
		self.resolved = true;
		self.resolve(exports == null ? module.exports : (module.exports = exports));
	})
	.catch(self.reject);
	return module;
}
define.amd = {
	destructuring: true,
	promise: true,
};

class Module {
	constructor(parent, url, id) {
		this.id = id; this.parent = parent;
		// this.url = url ? new URL(url) : id ? new URL(id2url(id, 'js')) : '';
		this.factory = null; this.exports = { };
		this.isShim = false;
		const _this = {
			children: new Set, loaded: false, resolved: false,
			promise: null, resolve: null, reject: null, require: null,
		}; Self.set(this, _this);
		_this.promise = Object.freeze(new Promise((y, n) => ((_this.resolve = y), (_this.reject = n))));
	}

	get require() {
		const self = Self.get(this); let require = self.require; if (require) { return require; }
		require = Private.require.bind(this);
		require.async = id => Private.requireAsync.call(this, id, false, null, false);
		require.toUrl = id => id2url(resolveId(this.id, id, true), null);
		require.resolve = resolveId.bind(null, this.id);
		require.cache = Modules;
		require.config = conf => config(this, conf);
		Object.defineProperty(require, 'main', {
			get() { return mainModule; },
			set(module) {
				if (module && typeof module === 'object' && Self.get(module)) { mainModule = module; }
				else if (module == null) { mainModule = null; }
				else { throw new Error(`require.main must be a Module`); }
			},
			enumerable: true, configurable: true,
		});
		Object.defineProperty(this, 'require', { value: require, enumerable: true, configurable: true, });
		return (self.require = require);
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
					throw new Error(`The plugin "${pluginId}" is not defined (yet)`);
				}
				id = pluginId +'!'+ resolveByPlugin(plugin, this.id, name.slice(split + 1));
			} else {
				id = resolveId(this.id, name);
			}
			const module = Modules[id];
			if (!module || !module.resolved) {
				throw new Error(`The module ${id} is not defined (yet)`);
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
			.catch(typeof failed === 'function' ? failed : (error => console.error(`Failed to require([ ${names}, ], ...):`, error)));
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

		{ const module = Modules[id], _module = module && Self.get(module); if (module) {
			if (!_this.resolved && !_module.resolved && hasPendingPath(_module, _this)) {
				if (!fast) { return Promise.reject(Error( // require.async('...')
					`Asynchronously requiring "${name}" from "${this.id}" before either of them is resolved would create a cyclic waiting condition`
				)); }
				_this.promise.then(() => _this.children.add(module)); // must delay adding to avoid unresolved cycles
				if (allowCyclic) { return _module.promise; } // require(['...'], ...)
				console.warn(`Found cyclic dependency to "${id}", passing it's unfinished exports to "${this.id}"`);
				return module.exports; // define(['...'], ...)
			}
			_this.children.add(module);
			return fast && _module.resolved ? module.exports : _module.promise;
		} }

		if (plugin && typeof plugin === 'object') {
			const fullId = plugin.id +'!'+ id;
			const module = new Module(this, 'plugin:'+ fullId, fullId), _module = Self.get(module);
			!plugin.exports.dynamic && (Modules[fullId] = module) && _this.children.add(module);
			plugin.exports.load(id, this.require, _module.resolve, { cancel: _module.reject, });
			return _module.promise.then(exports => {
				module.exports = exports;
				_module.loaded = _module.resolved = true;
				return exports;
			});
		}

		const shim = shims[id], url = id2url(shim && shim.id || id, 'js');
		const module = Modules[id] = Loading[url] = new Module(this, url, id), _module = Self.get(module);
		_this.children.add(module);

		if (shim) {
			delete shims[id]; module.isShim = true;

			return define(id, shim.deps, function(/*arguments*/) { return loadScript(url).catch(
				() => { throw new Error(`Failed to load script "${url}" for shim`); }
			).then(() => {
				_module.loaded = true; delete Loading[url];
				const exports = shim.exports.reduce((object, key) => object != null && object[key], global);
				if (exports === undefined) { throw new Error(`The script at "${url}" did not set the global variable "${ shim.exports.join('.') }" for shim`); }
				return Promise.resolve(shim.init && shim.init.apply(global, arguments))
				.then(result => result !== undefined ? result : shim.exports.length ? exports : undefined);
			}); }).ready;
		}

		loadScript(url)
		.then(() => { if (!_module.loaded) { // didn't call `define()`
			if (this.isShim) {
				console.info(`The shim dependency "${url}" of ${this.id} didn't call define. Prefix it with "shim!" to suppress this warning.`);
				_module.loaded = _module.resolved = module.isShim = true; _module.resolve(module.exports); return;
			}
			_module.reject(new Error(`The script at "${url}" did not call define with the expected id`));
		} })
		.catch(() => _module.reject(new Error(`Failed to load script "${url}" first requested from ${ this.id || '[global]' }`)));
		return _module.promise;
	},
};


/**
 * helpers
 */

// The edges (u, v) with v child of u and v.resolved === false must form an acyclic graph,
// otherwise there would be cycles of modules that wait on each other to resolve.
// This function checks that inserting (from, to) wouldn't create a cycle.
// This test should be fairly fast because only pending children need to be checked and there are no cycles.
// NOTE: Even in situations where cyclic dependencies are acceptable, the child link mustn't be inserted before either of the modules is resolved.
function hasPendingPath(from, to) { // both private
	if (from.children.size === 0) { return false; }
	for (const _child of from.children) {
		const child = Self.get(_child);
		if (child.resolved) { continue; }
		if (child === to) { return true; }
		// the .children relation spans a directed acyclic graph
		if (hasPendingPath(child, to)) { return true; }
	}
	return false;
}

function resolveId(from, to, noAppend) {
	let id = to +'';
	if ((/^\.\.?\//).test(id)) {
		if (!from) { throw new Error(`Can't resolve relative module id from global require, use the one passed into the define callback instead`); }
		const prefix = from.split('/'); prefix.pop();
		while (true) {
			if (id.startsWith('../')) {
				if (!prefix.length) { throw new Error(`Can't resolve relative id "${to}" past the root of "${from}"`); }
				prefix.pop();
				id = id.slice(3);
			} else if (id.startsWith('./')) {
				id = id.slice(2);
			} else { break; }
		}
		prefix.push(id);
		id = prefix.join('/');
	} else if (id.startsWith('/')) {
		id = id.slice(1);
	}
	!noAppend && id.endsWith('/') && (id += 'index');
	if (!modIdMap && !defIdMap) { return id; }

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

function id2url(id, ext) {
	const idPrefix = Object.keys(prefixMap)
	.filter(idPrefix => isIdPrefix(id, idPrefix))
	.reduce((a, b) => a.length > b.length ? a : b, { length: -1, });
	let url = typeof idPrefix !== 'string' ? baseUrl + id
	: prefixMap[idPrefix] + id.slice(idPrefix.length);
	if (ext) { url += '.'+ ext; }
	switch (typeof getUrlArgs) {
		case 'string': return url +'?'+ getUrlArgs;
		case 'function': return url + getUrlArgs(id, url);
		default: return (getUrlArgs && typeof getUrlArgs[id] === 'string' ? url +'?'+ getUrlArgs[id] : url);
	}
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
	return (!prefix.length || id === prefix || id.length > prefix.length && id.startsWith(prefix) && id[prefix.length] === '/');
	// || (/^\.[^\\\/]+$/).test(id.slice(prefix.length))
}

// TODO: basically wherever there is the pattern of `id = resolveId(); Modules[id] ...` this function isn't considered, but the situation isn't easy to solve because the plugin needs to be loaded for this function
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
	const timer = scriptTimeout && setTimeout(() => reject(new Error(`Load of script at "${url}" timed out`)), scriptTimeout);
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
		loadScript = document ? domLoader : importScripts ? workerLoder
		: url => { throw new Error(`No JavaScript loader available to load "${url}"`); };
	} else {
		loadScript = loader;
	}
}

const defaultPlugins = {
	shim(parent, string) {
		const [ relative, exports, ] = string.split(/:(?!.*:)/), id = 'shim!'+ resolveId(parent.id, relative);
		!Modules[id] && (shims[id] = { id: id.slice(5), exports: exports.split('.'), deps: [ ], });
		return Private.requireAsync.call(parent, id, false, 'fake-plugin', false);
	},
	fetch(parent, string) {
		let [ id, type, ] = string.split(/:(?!.*:)/); id = resolveId(parent.id, id); const url = id2url(id, null); id = 'fetch!'+ id +':'+ (type || 'text');
		const optional = type && type.endsWith('?'); optional && (type = type.slice(0, -1));
		!Modules[id] && (define(id, [ ], (!loadingInNode
			? global.fetch(url).then(_=>_&&(_[type === 'css' ? 'text' : type || 'text']()))
			: readFile(url.replace(/(?:file:\/\/)(?:\/(?=[A-Za-z]+:[/\\]))?/, ''), type === 'blob' ? null : 'utf-8') /* global readFile, */
			.then(data => type === 'json' ? JSON.parse(data) : data)
		).then(
			css => css !== null && type === 'css' ? css +`\n/*# sourceURL=${url} */` : css
		).catch(optional ? () => null : null)).parent = parent);
		return Private.requireAsync.call(parent, id, false, 'fake-plugin', false);
	},
};

function config(module, options) { options !== null && typeof options === 'object' && Object.keys(options).forEach(key => { const value = options[key]; switch (key) {

	case 'baseUrl': {
		baseUrl = new URL(value, module.require.toUrl('')).href;
	} break;

	case 'callingScriptResolver': {
		getCallingScript = typeof value === 'function' ? value : defaultGetCallingScript;
	} break;

	case 'config': {
		value && Object.keys(value).forEach(id => {
			moduleConfig[resolveId(module.id, id)] = value[id];
		});
	} break;

	case 'paths': {
		value && Object.keys(value).forEach(prefix => {
			prefixMap[resolveId(module.id, prefix)] = new URL(value[prefix], module.require.toUrl('')).href;
		});
	} break;

	case 'urlArgs': {
		if (typeof value === 'string' || typeof value === 'object' || typeof value === 'function') { getUrlArgs = value; }
	} break;

	case 'map': {
		value && Object.keys(value).forEach(key => {
			let target; if (key === '*') {
				target = defIdMap || (defIdMap = Object.create(null));
			} else {
				modIdMap || (modIdMap = Object.create(null));
				const id = resolveId(module.id, key, true);
				target = modIdMap[id] || (modIdMap[id] = Object.create(null));
			}
			const map = value[key]; Object.keys(map).forEach(from => {
				target[from] = resolveId(module.id, map[from]);
			});
		});
	} break;

	case 'main': { /// Set an id to be the main module. Loads the module if needed.
		const id = resolveId(module.id, value);
		module.require.async(id)
		.catch('errback' in options ? null : error => console.error(`Failed to load main module ${id}:`, error));
		(mainModule = Modules[id]).parent = null;
	} break;

	case 'shim': {
		Object.keys(value).forEach(id => {
			const shim = value[id];
			if (!shim || typeof shim !== 'object') { return; }
			const isArray = Array.isArray(shim);
			shims[resolveId(module.id, id)] = {
				deps: ((isArray ? shim : shim.deps) || [ ]).slice(),
				exports: !isArray && typeof shim.exports === 'string' && shim.exports.split('.') || [ ],
				init: !isArray && typeof shim.init === 'function' ? shim.init : shim.exports === 'function' ? shim.exports : undefined,
			};
		});
	} break;

	case 'waitSeconds': {
		scriptTimeout = value * 1000 << 0;
	} break;

	case 'defaultLoader': {
		setScriptLoader(value);
	} break;

	case 'deps': {
		value && value.forEach(module.require);
	} break;

	case 'callback': {
		Promise.all(Array.from(Self.get(module).children, _=>_.promise)).then(value);
	} break;

	case 'errback': {
		Promise.all(Array.from(Self.get(module).children, _=>_.promise)).catch(value);
	} break;

	case 'dryRun': {
		dryRun = !!value;
	} break;

} }); }

function getConfig() { return {
	baseUrl, urlArgs: getUrlArgs || undefined, paths: prefixMap, main: mainModule && mainModule.id || undefined,
	shim: shims, config: moduleConfig, waitSeconds: scriptTimeout,
	map: (() => {
		if(!modIdMap && !defIdMap) { return undefined; } const map = { ...modIdMap, };
		if (defIdMap) { map['*'] = defIdMap; } return map;
	})(),
}; }

/**
 * initialization and exports
 */
{
	const module = new Module(null, '', ''), _module = Self.get(module);
	_module.loaded = _module.resolved = true; _module.resolve({ });
	const require = module.require;

	require.config(loadConfig); loadConfig = null;
	if (typeof global.require === 'object') { require.config(global.require); }

	if (loadingInNode) {
		return { // eslint-disable-line consistent-return
			require, define, module, Module, config: require.config,
			_utils: {
				parseDepsBody, parseDepsDestr, simplyfyCode,
				defaultGetCallingScript, getConfig,
			},
		};
	} else {
		global.define = define;
		global.require = require;
	}
}

})(this);
