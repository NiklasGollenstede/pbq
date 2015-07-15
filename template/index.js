'use strict';
/* global module */

Object.assign(module.exports, require('./engine.js'), { escape: Object.assign({ }, require('./escape.js')), });
