(function firefox(exports) { 'use strict';

exports = (typeof module !== 'undefined') ? (() => {
	// main process
	const { escapeString, trim, } = require('es6lib/template/escape');

	return (tab, modules, script) => new Promise((resolve, reject) => {
		if (typeof script === 'function') {
			script = `(${ script })()`;
		}
		script = escapeString(trim(
			String.replace(script, (/\/\/(.*)$/gm), ' /* $1 */ ')
		));
		const worker = tab.attach({
			contentScriptFile: [ './../node_modules/es6lib/require.js', './../node_modules/es6lib/runInTab.js',  ].concat(modules),
			contentScript: 'require("es6lib/runInTab")("'+ script +'");',
		});
		worker.port.on("resolve", value => {
			worker.destroy();
			resolve(value);
		});
		worker.port.on("reject", value => {
			worker.destroy();
			reject(value);
		});
	});
})() : (() => {
	// content script
	const onError = error => {
		try {
			unsafeWindow.console.error('error', error);
		} catch (e) { }
		if (error instanceof Error) {
			error.json = [ 'columnNumber', 'fileName', 'lineNumber', 'message', 'stack', ]
			.reduce((json, key) => ((json[key] = error[key]), json), { });
		}
		self.port.emit("reject", error);
	};

	return script => {
		console.log('executing', script);
		try {
			Promise.resolve(eval(script))
			.then(value => self.port.emit("resolve", value))
			.catch(onError);
		} catch(error) {
			onError(error);
		}
	};
})();

const moduleName = 'es6lib/runInTab'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
