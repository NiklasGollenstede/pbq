(function(exports) { 'use strict';


/**
 * Constructs an XMLHttpRequest from the given url and options and returns a Promise
 * that is fulfilled with the request once the result is loaded or canceld with an ProgressEvent if an error occurs.
 * @param {string} url     Destination url, may be omited in favor of the url or src property of the options object.
 * @param {Object} options optional object of:
 *     @property {string}  url || src        Optional replacement for the url panameter
 *     @property {string}  method            HTTP request method
 *     @property {bool}    needAbort         If trueisch, the returned Promise has an abort() method that aborts the XHR and rejects the Promise
 *     @property {bool}    xhr               Set to false to not set the 'X-Requested-With' header to 'XMLHttpRequest'
 *     @property {string}  user              HTTP user name
 *     @property {string}  password          HTTP password
 *     @property {object}  header            HTTP header key/value-pairs (strings)
 *     @property {string}  responseType      XHR response type, influences the type of the promisedrequest.response
 *     @property {uint}    timeout           requests timeout
 *     @property {string}  overrideMimeType  overwrites the mime type of the requests body
 *     @property {any}     body              body to send with the request
 *     @property {bool}    mozAnon           mozilla privileged code only, don't send any session/login data
 *     @property {bool}    mozSystem         mozilla privileged code only, allow cross side request
 */
const HttpRequest = exports.HttpRequest = (function() {

var XHR; try { XHR = (/* global XMLHttpRequest */ typeof XMLHttpRequest !== 'undefined') ? XMLHttpRequest : require('sdk/net/xhr'/* firefox */).XMLHttpRequest; } catch(e) { }
var ProgressEventConstruntor; try { /* global ProgressEvent */ new ProgressEvent(''); ProgressEventConstruntor = ProgressEvent; } catch (error) { ProgressEventConstruntor = function(reason) { const error = document.createEvent('ProgressEvent'); error.initEvent(reason, false, false); return error; }; }

return function HttpRequest(url, options) {
	var request, cancel;
	const o = arguments[arguments.length - 1] || { };
	const promise = new Promise(function(resolve, reject) {
		typeof url !== 'string' && (url = o.url || o.src);

		request = new XHR(o);
		cancel = cancelWith.bind(request, reject);

		request.open(o.method || "get", url, true, o.user, o.password);

		o.responseType && (request.responseType = o.responseType);
		o.timeout && (request.timeout = o.timeout);
		o.overrideMimeType && request.overrideMimeType(o.overrideMimeType);
		(o.xhr == null || o.xhr) && request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		o.header && Object.keys(o.header).forEach(function(key) { request.setRequestHeader(key, o.header[key]); });

		request.onerror = reject;
		request.ontimeout = reject;
		request.onload = function(event) {
			if (request.status >= 200 && request.status < 300) {
				resolve(request);
			} else {
				cancel('bad status');
			}
		};
		request.send(o.body);
	});
	o.needAbort && (promise.abort = function() {
		request.abort();
		cancel('canceled');
	});
	return promise;
};
function cancelWith(reject, reason) {
	const error = new ProgressEventConstruntor(reason);
	this.dispatchEvent(error);
	reject(error);
}
})();

/**
 * Converts an ArrayBuffer into a binary string, where each char represents a byte of the buffer.
 * @param  {ArrayBuffer}   buffer   The input buffer
 * @return {string}        string with .length === buffer.length
 */
const arrayBufferToString = exports.arrayBufferToString = function arrayBufferToString(buffer) {
	buffer = new Uint8Array(buffer);
	const ret = new Array(buffer.length);
	for (var i = 0, length = buffer.length; i < length; ++i) {
		ret[i] = String.fromCharCode(buffer[i]);
	}
	return ret.join('');
};

/**
 * Map object from file extensions to mime-types
 * @type {object}
 */
const mimeTypes = exports.mimeTypes = {
	'3gp': 'video/3gpp',
	bmp: 'image/bmp',
	css: 'text/css',
	htm: 'text/html',
	flv: 'video/x-flv',
	gif: 'image/gif',
	html: 'text/html',
	ico: 'image/x-icon',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	js: 'application/javascript',
	json: 'application/json',
	mp4: 'video/mp4',
	pdf: 'application/pdf',
	png: 'image/png',
	svg: 'image/svg+xml',
	ttf: 'application/octet-stream',
	txt: 'text/plain',
	webm: 'video/webm',
	woff2: 'application/font-woff2',
	woff: 'application/font-woff',
	xhtml: 'application/xhtml+xml',
};

const moduleName = 'es6lib/network'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
