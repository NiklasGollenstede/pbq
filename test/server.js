/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals require, */ // license: MPL-2.0

const { readFileSync: read, writeFileSync: write, mkdirSync: mkdir, } = require('fs');

try { mkdir('./node_modules/amdjs_test_server/impl/pbq'); } catch (_) { }
write('./node_modules/amdjs_test_server/impl/pbq/require.js', read('./require.js'));

write('./node_modules/amdjs_test_server/impl/pbq/config.js', (`(`+ (() => {
	window.go = window.define;
	window.config = window.require.config;
	window.implemented = {
		basic: true,
		anon: true,
		funcString: true,
		namedWrapped: true,
		require: true,
		// plugins: true,
		// pluginDynamic: true,
		pathsConfig: true,
		// packagesConfig: true,
		mapConfig: true,
		// moduleConfig: true,
		shimConfig: true,
	};
	window._require = window.require;
	delete window.require;

	window._require.config({ baseUrl: new URL('./', location).pathname, });
}) +`)()`));

const path = './node_modules/amdjs_test_server/server/manifest.js';
write(path, read(path, 'utf8').replace(/(?:exports\.manifest\.pbq = [^]*)?$/, () => `exports.manifest.pbq = (`+ (() => ({
	name:   'pbq @ 0.0.1',
	impl:   'pbq/require.js',
	config: 'pbq/config.js',
})) +`)();`));

require('amdjs_test_server/server/server.js');

