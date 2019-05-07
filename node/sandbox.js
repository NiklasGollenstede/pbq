/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals global, require, module, __dirname, */ // license: MIT

class Sandbox { constructor({
	globals = { },
	path = Path.resolve(__dirname, '../require.js'),
	code = FS.readFileSync(path, 'utf-8'),
	fetchCode = path => {
		if (!path.startsWith('file://')) { throw new Error(`Can only load 'file://'-URLs`); }
		path = path.replace(rFileUrlPrefix, '');
		return readFile(path, 'utf-8');
	},
} = { }) {

	const ctx = VM.createContext({ ...globals, }, { codeGeneration: { strings: false, wasm: false, }, });
	function exec(code, path) {
		return new VM.Script(code, { filename: path, }).runInContext(ctx, { breakOnSigint: true, });
	}
	function execWith(code, path, closure) {
		code = `(function (${ Object.keys(closure) }) { return ${ code }; });`;
		return exec(code, path).apply(ctx, Object.values(closure));
	}

	const exports = execWith(code, path, { __export_only__: true, readFile, URL, URLSearchParams, });
	const { defaultGetCallingScript, } = exports._utils;
	ctx.require = exports.require; ctx.define = exports.define; exports.global = ctx;

	exports.config({
		callingScriptResolver(offset = 0) {
			return defaultGetCallingScript(offset + 1).replace(rFileUrlPrefix, 'file:///');
		},
		async defaultLoader(path) {
			void exec((await fetchCode(path)), path);
		},
		baseUrl: 'file://'+ defaultGetCallingScript(1).replace(/([/\\]).*?/, '$1'),
	});

	Object.assign(this, exports);
} }

module.exports = Sandbox;

const FS = require('fs'), Path = require('path'), { URL, URLSearchParams, } = require('url'), VM = require('vm');
const readFile = (path, enc) => new Promise((resolve, reject) => FS.readFile(path, enc, (error, data) => error ? reject(error) : resolve(data)));

const rFileUrlPrefix = /(?:file:\/\/)?(?:\/(?=[A-Za-z]+:[/\\]))?/;
