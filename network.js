(function(exports) { 'use strict';

const XHR = (typeof XMLHttpRequest !== 'undefined') ? XMLHttpRequest : require('sdk/net/xhr').XMLHttpRequest;

/**
 * Constructs an XMLHttpRequest from the given url and options and returns a Promise
 * that is fulfilled with the request once the result is loaded or canceld with an ProgressEvent if an error occurs
 * @param {string} url     destination url, may be property of options
 * @param {Object} options optional object of:
 *                         @attribute {string}  method            HTTP request method
 *                         @attribute {string}  user              HTTP user name
 *                         @attribute {string}  password          HTTP password
 *                         @attribute {object}  header            HTTP header key/value-pairs (strings)
 *                         @attribute {string}  responseType      XHR response type, influences the type of the promisedrequest.response
 *                         @attribute {uint}    timeout           requests timeout
 *                         @attribute {string}  overrideMimeType  overwrites the mime type of the requests body
 *                         @attribute {any}     body              body to send with the request
 *                         @attribute {bool}    mozAnon           mozilla privileged code only, don't send any session/login data
 *                         @attribute {bool}    mozAnon           mozilla privileged code only, allow cross side request
 */
const HttpRequest = exports.HttpRequest = function HttpRequest(url, options = { }) {
	let request, cancel;
	return Object.assign(new Promise(function(resolve, reject) {
		if (url instanceof Object && !(url instanceof String)) { options = url; url = options.url; }
		const { method, user, password, header, timeout, responseType, overrideMimeType, mozAnon, mozSystem, } = options;

		request = (mozAnon || mozSystem) ? new XHR({ mozAnon, mozSystem, }) : new XHR();
		cancel = cancelWith.bind(request, reject);

		request.open(method || "get", url, true, user, password);

		responseType && (request.responseType = responseType);
		timeout && (request.timeout = timeout);
		overrideMimeType && request.overrideMimeType(overrideMimeType);
		header && Object.keys(header).forEach(function(key) { request.setRequestHeader(key, header[key]); });

		request.onerror = reject;
		request.ontimeout = reject;
		request.onload = function(event) {
			if (request.status == 200) {
				resolve(request);
			} else {
				cancel('bad status');
			}
		};
		request.send(options.body);
	}), {
		abort() {
			request.abort();
			cancel('canceled');
		},
	});
};
function cancelWith(reject, reason) {
	const error = new ProgressEvent(reason);
	this.dispatchEvent(error); // side effects ??
	reject(error);
}

const moduleName = 'es6lib/network'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
