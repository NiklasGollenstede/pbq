'use strict';

/*const { XMLHttpRequest, } = require('sdk/net/xhr');

if (typeof setTimeout === 'undefined') {
	var setTimeout = require("sdk/timers").setTimeout;
}*/

export function HttpRequest(url, options = { }) {
	if (url instanceof Object && !(url instanceof Sting)) { options = url; url = options.url; }
	const { method, user, password, header, body, responseType, } = options;
	let request, cancel;
	return Object.assign(new Promise((resolve, reject) => {
		cancel = reject;
		request = new XMLHttpRequest();
		request.open(method || "get", url, true, user, password);
		responseType && (request.responseType = responseType);
		header && Object.keys(header).forEach(key => request.setRequestHeader(key, header[key]));
		request.onerror = error => reject({ error, request, });
		request.onload = event => {
			if (request.status == 200) {
				resolve(request);
			} else {
				reject({ error: new Error("Server returned "+ request.statusText), request, });
			}
		};
		request.send(options.body);
	}), {
		abort() {
			request.abort();
			cancel({ error: new Error('Request canceled'), request, });
		},
	});
}
