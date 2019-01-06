/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals require, */ // license: MPL-2.0

const { readFileSync: read, writeFileSync: write, mkdirSync: mkdir, } = require('fs');
const { name, version, } =  require('../package.json');

try { mkdir('./node_modules/amdjs_test_server/impl/pbq'); } catch (_) { }
write('./node_modules/amdjs_test_server/impl/pbq/require.js', read('./require.js'));

write('./node_modules/amdjs_test_server/impl/pbq/config.js', (`(`+ (window => {
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

	window._require.config({ baseUrl: new URL('./', window.location).pathname, });
}) +`)(this)`));

const path = './node_modules/amdjs_test_server/server/manifest.js';
write(path, read(path, 'utf8').replace(/(?:exports\.manifest\.pbq = [^]*)?$/, () => `exports.manifest.pbq = (`+ (name => ({
	name:   name,
	impl:   'pbq/require.js',
	config: 'pbq/config.js',
})) +`)('${name} @ ${version}');`));

require('amdjs_test_server/server/server.js');

