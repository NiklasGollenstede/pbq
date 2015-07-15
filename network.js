'use strict';

if (typeof XMLHttpRequest === 'undefined') { var XMLHttpRequest = require('sdk/net/xhr').XMLHttpRequest; }

const HttpRequest = exports.HttpRequest = function HttpRequest(url, options = { }) {
	let request, cancel;
	return Object.assign(new Promise(function(resolve, reject) {
		if (url instanceof Object && !(url instanceof String)) { options = url; url = options.url; }
		const { method, user, password, header, timeout, responseType, overrideMimeType, mozAnon, mozSystem, } = options;

		request = (mozAnon || mozSystem) ? new XMLHttpRequest({ mozAnon, mozSystem, }) : new XMLHttpRequest();
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
