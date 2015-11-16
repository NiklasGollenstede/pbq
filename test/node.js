'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);

global.chaiAsPromised = chaiAsPromised;
global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;

require('babel/register')({
	whitelist: [
		'es6.classes',
		'es6.destructuring',
		'es6.parameters', // default, spread
		'es6.properties.computed',
		'es6.tailCall',
		'es7.asyncFunctions',
		'es7.classProperties',
		'es7.comprehensions',
		'es7.decorators',
		'es7.doExpressions',
		'es7.exponentiationOperator',
		'es7.exportExtensions',
		'es7.functionBind',
		'es7.objectRestSpread',
		'es7.trailingFunctionCommas',
	],
	loose: [
		'es6.destructuring',
		'es6.properties.computed',
	],
	optional: [
		'asyncToGenerator',
	],
});
