/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals global, require, module, __dirname, */ // license: MIT

/// Given a module required while `dryRun === true`, returns the `arguments` that can be used to `define` the module.
/// If the module has a factory, its closures won't be captured; if it doesn't, the `exports` are assumed to be JSON.
function getDefineArgs({ id, factory, exports, _deps: deps, _special: special, }) {
	if (!factory) {
		factory = `() => (${ nl +'\t'+ JSON.stringify(exports) +' // eslint-disable-line'+ nl })`; deps = [ ];
	} else { factory += ''; }
	if (special) {
		factory =
		(/^.*?[(]/).exec(factory +'') + nl +'\t'+
		deps.map(({ name, use, }) => use ? use.replace(/^:\s*/, '') : name +',')
		.join(nl +'\t') + nl + factory.slice(deps.lastIndex + 1);
		deps = deps.map(_=>_.id);
	}
	return [ id, deps, factory, ];
}

/// Calls `getDefineArgs` and serializes the result as the code calling `define`.
function getDefineCall(module) {
	const [ id, deps, factory, ] = getDefineArgs(module);
	return `define(${ JSON.stringify(id) }, ${
		JSON.stringify(deps, null, '\t').replace(/(\s]$)/, ',$1')
	}, ${ factory })`;
}

const nl = require('os').EOL;

module.exports = {
	getDefineArgs, getDefineCall,
};
