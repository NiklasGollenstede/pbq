/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals global, require, module, __dirname, */ // license: MIT

const FS = require('fs'), Path = require('path'), { URL, URLSearchParams, } = require('url');
const path = Path.resolve(__dirname, './require.js');
const readFile = (path, enc) => new Promise((resolve, reject) => FS.readFile(path, enc, (error, data) => error ? reject(error) : resolve(data)));
const code = FS.readFileSync(path, 'utf-8').replace(/;$/, '');
const { require: requireAsync, parseDepsBody, parseDepsDestr, simplyfyCode, defaultGetCallingScript, } = makeInstance();

const rFileUrlPrefix = /(?:file:\/\/)?(?:\/(?=[A-Za-z]+:[\/\\]))?/;

function makeInstance({ globals = { }, } = { }) {

	const Loader = makeEvaluator({ __export_only__: true, readFile, URL, URLSearchParams, }, globals)(code, path);
	const { require, define, } = Loader;

	const evaluator = makeEvaluator({ require, define, URL, URLSearchParams, }, globals);

	require.config({
		callingScriptResolver(offset = 0) {
			return defaultGetCallingScript(offset + 1).replace(rFileUrlPrefix, 'file:///');
		},
		async defaultLoader(path) {
			if (!path.startsWith('file:\/\/')) { throw new Error(`Can only load 'file://'-URLs`); }
			path = path.replace(rFileUrlPrefix, '');
			const code = (await readFile(path, 'utf-8'));
			evaluator(code, path);
		},
	});

	return Loader;
}

const rWhitespace = (/\s*/g);

function parseDependenciesFromFile(file, id) {
	const rDefine = (/\bdefine\s*\(/g);
	const ignore = [ 'require', 'exports', 'module', ];

	const deps = [ ]; function found(from, to) {
		let id = to +'';
		if (ignore.includes(id)) { return; }
		if ((/^\.\.?\//).test(id)) {
			if (!from) { throw new Error(`Can't resolve relative module id from global require, use the one passed into the define callback instead`); }
			const prefix = from.split('/'); prefix.pop();
			while (true) {
				if (id.startsWith('../')) { id = id.slice(3); /* TODO: throw if prefix empty */ prefix.pop(); continue; }
				if (id.startsWith('./'))  { id = id.slice(2); continue; }
				break;
			}
			id = prefix.join('/') +'/'+ id;
		} else if (id.startsWith('/')) {
			id = id.slice(1);
		}
		id.endsWith('/') && (id += 'index');
		deps.push(id);
	}

	file = simplyfyCode(file);

	for (let mDefine = null; (mDefine = rDefine.exec(file)); void 0) {
		const defineAt = mDefine.index;
		const dotAt = file.lastIndexOf('.', defineAt);
		rWhitespace.lastIndex = dotAt;
		if (dotAt >= 0 && dotAt + rWhitespace.exec(file)[0].length === defineAt) { continue; } // define was used as a method

		let code = file.slice(defineAt + mDefine[0].length);
		const mId = (/^\s*(?:(?:'(.*?)'|"(.*?)"|`(.*?)`))\s*/).exec(code);
		const from = mId ? mId[1] || mId[2] || mId[3] : id;
		mId && (code = code.slice(mId[0].length + 1));
		code = code.replace(/^\s*/, '');

		if ((/^\[/).test(code)) {
			const deps = [ ];
			const commas = code.slice(1, code.indexOf(']')).replace(/(?:'(.*?)'|"(.*?)"|`(.*?)`)/g, (_, _1, _2, _3) => (deps.push(_1 || _2 || _3), ''));
			const bad = (/[^\s,]+/).exec(commas); if (bad) { throw new Error(`Unrecognized code "${ bad[0] }" in Array dependency declaration of "${ from }"`); }
			deps.forEach(id => found(from, id)); continue;
		}

		// ignore everything that is not a function
		if ((/^\s*{|^(?:[-(]\s*)*(?:['"`[]|\d+|(?=(?!function|async)(\w+(?:\s*,\s*\w+)*\s*,?))\1(?!(?:\s*\))*\s*=>))/).test(code)) { continue; }
		// disallow direct object literals (including this in the next rule would be ambiguous with destructuring assignment in arrow functions)
		//          ignore opening '(', '-' and whitespaces
		//                        disallow anything that stars a literal string, Array
		//                                 or number
		//                                     disallow any word (or comma separated/terminated list of words) that is not 'function' or 'async'
		//                                                                                      and is also not followed by an '=>'
		// tests (split each line at '|'):
		// doesn't match: ab ) ) => | ( ab, cd ) ) => | ( ab, cd, ) ) => | a => | () => | async () => | async ( ab ) => | function ( ) { | function * ( ) { | ab ) )
		// matches: ` | { blub } | a, (b) =>  | { async } | [ function ] | any word | a , b | 42 | -42 | 0xbeef | -0xbeef
		// should match (but doesn't): async | ({ blub })

		const deps = parseDepsDestr(code, 1, from)
		|| parseDepsBody(code, 3, from); // TODO: this is pretty inaccurate, it parses up to the end of the file, not the function

		deps.forEach(id => found(from, id));
	}
	return deps;
}


module.exports = {
	makeInstance() { const { require, define, } = makeInstance(...arguments); return { require, define, }; },
	require() { return requireAsync(...arguments); },
	parseDependenciesFromFile,
	parseDependenciesFromFunctionBody: parseDepsBody,
	parseDependenciesFromFunctionDestructuring: parseDepsDestr,
};


function makeEvaluator(closure, ctx) {
	const prefix = `(function (${ Object.keys(closure).concat(Object.keys(ctx)) }) { return `;
	const suffix = `});`;
	const args = Object.keys(closure).map(_=>closure[_]).concat(Object.keys(ctx).map(_=>ctx[_]));
	return (code, path) => eval(prefix + code + suffix + `\n//# sourceURL=${ path }`).apply(global, args);
}


// const vm = require('vm');
/*function makeEvaluator(closure, ctx) {
	const prefix = `(function (${ Object.keys(closure) }) { return `;
	const suffix = `});`;
	const args = Object.keys(closure).map(_=>closure[_]);
	return (code, path) => vm.runInContext(prefix + code + suffix, ctx, { filename: path, lineOffset: 0, displayErrors: true, }).apply(ctx, args);
}*/
