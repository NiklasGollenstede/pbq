'use strict';

var assert = require('assert');

require('babel/register');

console.log(require('./sample.js').test(process.argv[2]));
