/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals global, require, module, __dirname, */ // license: MIT

/**
 * Creates a `Sandbox` that can load AMD browser JavaScript modules.
 * Since the code is run in a "sandbox" of the build-in 'vm' module, it won't have (direct)
 * access to the processes global variables or node's `require` and thus the build-in modules.
 * For the security considerations, consult the documentation of node's 'vm' module.
 * The `require()`d code is evaluated in a different realm with its own build in types,
 * i.e. all `globals` passed and `exports` made will have mismatching prototype chains.
 *
 * The only prototype method is the constructor:
 * @param  {object?}    globals      Plain object of variables that will be copied to the new realm's global scope.
 *                                   Note that none of the browser specific global variables will be defined by default.
 * @param  {string?}    pathPrefix   Used as described below. Defaults to the dirname of the calling script.
 * @param  {string?}    urlPrefix    Initial `baseUrl` config value. Defaults to `'file://'+ .pathPrefix`.
 * @param  {function?}  fetch        Async function `(path: string, type: enum) => string|ArrayBuffer`
 *                                   that loads code or resources when `require()`d.
 *                                   `type` will be `'code'` when loading JavaScript code to be executed,
 *                                   or `'text'`, `'json'` or `'arrayBuffer'` for non-code resources.
 *                                   The default function requires that the `url` starts with the `.urlPrefix` parameter,
 *                                   which it replaces with `.pathPrefix` before loading the file (without further restriction).
 * @param  {string?}    requirePath  Path to the `require.js` script to use as the module loader. Defaults to this module's script.
 * @param  {string?}    requireCode  Code of the `require.js` script to use as the module loader. Defaults to loading `requirePath`.
 *
 * Once constructed, the `Sandbox` exposes `require` and `define`, the global `module`, the `Module` class,
 * `require.config` as `config`, the realms `global` variable, and a collection of internal `_utils` as properties.
 * While the new environment is minimally pre-configured to work in node.js, specific `.config()`uration is likely required.
 * The available configuration options are the same as in the browser, including `modules` to expose node.js modules,
 * `map` and `paths` to manipulate loading, and `dryRun` for static analysis (which really only makes sense in node.js).
 */
class Sandbox { constructor({
	globals = { },
	pathPrefix = null, urlPrefix = null,
	fetch = async (url, type, ctx) => { void ctx;
		if (!url.startsWith(urlPrefix)) { throw new Error(`URL does not start with the correct prefix`); }
		const path = pathPrefix + url.slice(urlPrefix.length); switch (type) {
			case 'code': case 'text': case 'json': return readFile(path, 'utf-8');
			case 'arrayBuffer': return readFile(path);
			default: throw new TypeError;
		}
	},
	requirePath = Path.resolve(__dirname, '../require.js'),
	requireCode = FS.readFileSync(requirePath, 'utf-8'),
} = { }) {

	const ctx = VM.createContext({ ...globals, }, { codeGeneration: { strings: false, wasm: false, }, });
	const global = this.global = exec('this');
	function exec(code, path) {
		return new VM.Script(code, { filename: path, }).runInContext(ctx, { breakOnSigint: true, });
	}
	function execWith(code, path, closure) { // evaluates and returns only the first expression of `code`
		code = `(function (${ Object.keys(closure) }) { return ${ code }; });`;
		return exec(code, path).apply(ctx, Object.values(closure));
	}

	function fetchShim(url) { return { then: _=>_({
		arrayBuffer() { return global.Promise.resolve(fetch(url, 'arrayBuffer', global).then(
			data => new global.ArrayBuffer((data.buffer ? data : Buffer.from(data)).buffer))
		); },
		json() { return global.Promise.resolve(fetch(url, 'json', global).then(global.JSON.parse)); },
		text() { return global.Promise.resolve(fetch(url, 'text', global).then(_=>_ +'')); },
	}), }; }

	const exports = execWith(requireCode, requirePath, {
		URL, URLSearchParams, fetch: Object.hasOwnProperty.call(globals, 'fetch') ? globals.fetch : fetchShim,
	});
	const { defaultGetCallingScript, } = exports._utils;

	if (pathPrefix == null) { pathPrefix = Path.dirname(defaultGetCallingScript(1)) +'/'; }
	if (urlPrefix == null) { urlPrefix = 'file://'+ pathPrefix; }

	exports.config({
		callingScriptResolver(offset = 0) {
			return defaultGetCallingScript(offset + 1);
		},
		async defaultLoader(path) {
			void exec((await fetch(path, 'code', global)), path);
		},
		baseUrl: urlPrefix,
	});

	this.require = exports.require; this.define = exports.define; this.module = exports.module;
	this.Module = exports.Module; this.config = exports.config; this._utils = exports._utils;
} }

module.exports = Sandbox;

const FS = require('fs'), Path = require('path'), { URL, URLSearchParams, } = require('url'), VM = require('vm');
const readFile = (path, enc) => new Promise((resolve, reject) => FS.readFile(path, enc, (error, data) => error ? reject(error) : resolve(data)));
