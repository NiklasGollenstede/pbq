/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals require, module, __dirname, */ // license: MIT

const FS = require('fs'), Path = require('path');

const code = (/[/][*]!start:parsers[*][/][^]*?[/][*]!end:parsers[*][/]/).exec(FS.readFileSync(Path.resolve(__dirname, '../require.js'), 'utf-8'))[0];

const { parseDepsDestr, simplifyCode, } = /**@type{{ parseDepsDestr(code: string): { id: string, name?: string, use?: string, }[], simplifyCode(code: string): string, }}*/(eval(`(() => { const dryRun = true; ${code}; return { parseDepsDestr, simplifyCode, }; })();`));

/**
 * Searches for dependencies defined in a destructuring `define()` call in a given JavaScript source code file.
 * Uses string parsing to find the first and only direct call `define(factory)`, where factory is a function literal
 * using the destructuring argument syntax for specifying dependencies, and passes it to the same parser that `define` itself uses.
 * @param  {object}   options
 * @param  {string}   options.code  The source code content of the file to search.
 * @param  {string=}  options.path  Optional path to the source file. Currently only used to abort (with `null`) if the path doesn't end in `.js`.
 * @returns                         `null` if no dependency specification was found, otherwise an array of dependencies, as object with:
 *                                  * `id: string`: the id portion of the dependency, as parsed
 *                                  * `lang: 'js'|'css'|'json'|'text'|'arrayBuffer'|undefined`: language/type of the dependency
 *                                  * `module: 'amd'|'esm'|'legacy'|undefined`: for `lang == 'js'`, type of the module
 *                                  * `ext: string|undefined`: file extension (w/o leading `.`), if not part of `id` already
 *                                  * `export?: string`: for `module == 'legacy'`, optional name of the global property fo return as export
 *                                  * `plugin?: string`: name of a (not builtin) plugin to use to load the dependency
 */
function getDeps({ code, path, }) {
	if (path && !(/[.]m?js$/).test(path)) { return null; }
//	console.log('getDeps', path);
	code = simplifyCode(code);

	const match = (/[^.]\s*define\s*[(](\s*(?:async\s*)?(?:function\s*)?(?:[*]\s*)?[(]\s*[{][^]*)/m).exec(code);
	if (!match) { return null; }

//	console.log('parseDepsDestr', match[1]);
	const deps = parseDepsDestr(match[1]);
	return deps.filter(({ name, id, }) => ![ 'require', 'module', 'exports', ].includes(name || id))
	.map(({ id, }) => { const raw = id; map: do {
		id.endsWith('?') && (id = id.slice(0, -1)); const split = id.indexOf('!');
		const plugin = split >= 0 ? id.slice(0, split) : null; plugin != null && (id = id.slice(split + 1));
		let lang = 'js', module = 'amd', ext = 'js'; const extra = { }; switch (plugin) {
			case 'shim': {
				const { 0: path, 1: property, } = id.split(/:(?!.*:)/);
				id = path; module = 'legacy'; extra.export = property;
			} break;
			case 'fetch': {
				const { 0: path, 1: as, } = id.split(/:(?!.*:)/);
				id = path; lang = as || 'text'; ext = module = undefined;
			} break;
			case 'module': { module = 'esm'; ext = 'esm.js'; } break;
			case 'lazy': { continue map; }
			default: if (plugin) { extra.plugin = plugin; lang = module = ext = undefined; }
		}
		return { raw, id, lang, module, ext, ...extra, };
	} while (true); });
}
getDeps.fromFactory = parseDepsDestr;
getDeps.simplifyCode = simplifyCode;
getDeps.getDeps = getDeps;

module.exports = getDeps;
