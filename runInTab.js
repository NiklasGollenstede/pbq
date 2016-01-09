(function () { 'use strict';

/**
 * Loaded in the main process, provides a single function that allows to run functions in a tab process.
 * @param  {Tab}           tab      The tab to run in
 * @param  {...string}     modules  Modules to load before executing
 * @param  {function}      script   The function to execute
 * @param  {...any}        args     Arguments to the function
 * @async
 * @return {Promise(any)}  Promise to the value (or the value of the promise) returned by 'script'
 */

if (typeof module !== 'undefined') {
	// main process
	const __FILE__ = new Error().fileName.match(/ -> (resource:\/\/.*?)$/)[1];
	const __REQUIRE__ = __FILE__.replace(/[^\/]*$/, 'require.js');

	return (tab, ...args) => new Promise((resolve, reject) => {
		const modules = [ __REQUIRE__, ];
		let i = 0;
		while (typeof args[i] !== 'function' && i < args.length) {
			modules.push(args[i++]);
		}
		modules.push(__FILE__);
		const script = args[i];
		if (!script) { throw new TypeError('Can\'t find \'script\' argument'); }
		args.splice(0, i + 1);

		const worker = tab.attach({
			contentScriptFile: modules,
			contentScriptOptions: { script: `return (${ script }).apply(this, arguments)`, args, },
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
} else {
	// content script
	const onError = error => {
		// preserve Error objects through the JSON console.
		if (error instanceof Error) {
			error = [ 'columnNumber', 'fileName', 'lineNumber', 'message', 'name', 'stack', 'type', ]
			.reduce((json, key) => ((json[key] = error[key]), json), { });
		}
		self.port.emit("reject", error);
	};

	try {
		Promise.resolve(new String.constructor(self.options.script).apply(null, self.options.args))
		// i.e. new Function(script), but 'script' was a function before and moves from more to less trusted code, so this is secure.
		.then(value => self.port.emit("resolve", value))
		.catch(onError);
	} catch(error) {
		onError(error);
	}
}

})({ });
