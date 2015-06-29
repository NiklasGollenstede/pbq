'use strict';

const { copyProperties, } = require('./object.js');


export function inIframe() {
	try { return (window.self !== window.top); } catch (e) { return true; }
}

export function createElement(tagName, properties, childList) {
	let element = document.createElement(tagName);
	copyProperties(element, properties);
	for (let i = 0, child; childList && (child = childList[i]); ++i) {
		element.appendChild(child);
	}
	return element;
}

export function createStyleElement(css) {
	let element = document.createElement("style");
	element.type = "text/css";
	element.innerHTML = css;
	return element;
}

export function addStyle(css) {
	return document.querySelector("head").appendChild(createStyleElement(css));
}

export function clickElement(element) {
	let evt = document.createEvent("MouseEvents");
	evt.initEvent("click", true, true);
	element.dispatchEvent(evt);
	return evt;
}

export function saveAs(content, name, win = window) {

	if (typeof content.generate === 'function') {
		try { // gen blob if zip
			content = content.generate({type:"blob"});
		} catch (error) {
			content = content.generate({type:"uint8array"});
			content = new win.Blob([ content, ], { type: 'application/octet-binary', });
		}
	}

	let link = Object.assign(win.document.createElement('a'), {
		download: name,
		href: win.URL.createObjectURL(content),
	});

	clickElement(link, win);

	setTimeout(() => win.URL.revokeObjectURL(link.href), 1000);
}

export function once(element, event, callback, capture) {
	const handler = event => {
		element.removeEventListener(event, handler, capture);
		callback(event);
	};
	element.addEventListener(event, handler);
}

export function getSelector(element, prev = '') {
	if (!element || element === document) { return prev.slice(1); }
	return getSelector(
		element.parentNode, '>'+ element.tagName
		+ (element.id ? '#'+ element.id : '')
		+ (element.className ? '.'+ element.className.replace(/ +/g, '.') : '')
		+ prev
	);
}

export function onElementChanged(element, attributeFilter, callback) {
	return new MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			if (mutation.target.getAttribute(mutation.attributeName) != mutation.oldValue) {
				try { callback(mutation.target, mutation.oldValue); } catch(e) {  }
			}
		});
		observer.takeRecords();
	}).observe(element, { subtree: false, attributes: true, attributeOldValue: true, attributeFilter: attributeFilter });
}

const Self = new WeakMap();
export function CreationObserver(element) {
	const listeners = [/*{ callback: function(){}, selector: string [, single: true] }*/];
	const observer = new MutationObserver((mutations, observer) => {
		for (let mutation of mutations) {
			for (let j = 0, element; (element = mutation.addedNodes[j]); j++) {
				elementCreated(listeners, element);
				if (element.querySelectorAll) {
					for (let list = element.querySelectorAll("*"),
						i=0; (element = list[i]); i++) {
						elementCreated(listeners, element);
					}
				}
			}
		}
		observer.takeRecords();
	});
	observer.listeners = listeners;
	observer.element = element || document;
	Self.set(this, observer);
}
function elementCreated(listeners, element) {
	element.matches && listeners.forEach((listener, index) => {
		if (element.matches(listener.selector)) {
			setTimeout(listener.callback, 0, element);
			if (listener.single) {
				delete listeners[index];
			}
		}
	});
}
CreationObserver.prototype.add = function(selector, callback, single) {
	let self = Self.get(this);
	if (self.listeners.find(item => item.selector == selector && item.callback == callback && !item.single === !single)) { return; }
	self.listeners.push({ selector: selector, callback: callback, single: single });
	self.listeners.length == 1 && self.observe(self.element, { subtree: true, childList: true });
};
CreationObserver.prototype.remove = function(selector, callback, single) {
	let self = Self.get(this);
	let length = self.listeners.length;
	self.listeners.filter(item => !(item.selector == selector && item.callback == callback && !item.single == !single));
	self.listeners.length === 0 && self.disconnect();
	return length - self.listeners.length;
};
CreationObserver.prototype.single = function(selector, callback) {
	let element;
	if ((element = Self.get(this).element.querySelector(selector))) {
		setTimeout(callback.bind(undefined, element), 0);
	} else {
		this.add(selector, callback, true);
	}
};
CreationObserver.prototype.all = function(selector, callback) {
	let alreadyExisting = Self.get(this).element.querySelectorAll(selector);
	this.add(selector, callback, false);

	for (let element, i = 0; (element = alreadyExisting[i]); i++) {
		setTimeout(callback.bind(undefined, element), 0);
	}
};

export function notify(options) {
	return new Promise((resolve, reject) => {
		let doIt = () => {
			let self = new Notification(options.title, options);
			self.onclick = resolve;
			self.onerror = reject;
			self.onclose = reject;
			self.onshow = clearTimeout.bind(null, setTimeout(reject, options.timeout || 1500));
		};

		if (Notification.permission === "granted") {
			doIt();
		} else if (Notification.permission !== 'denied') {
			Notification.requestPermission(permission => {
				if (permission === "granted") {
					doIt();
				} else {
					reject("permission denied");
				}
			});
		} else  {
			reject("permission denied");
		}
	});
}

