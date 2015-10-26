(function(exports) { 'use strict';

/* global setTimeout */ /* global clearTimeout */
const timeout = (typeof setTimeout !== 'undefined') ? setTimeout : require("sdk/timers").setTimeout;
const unTimeout = (typeof clearTimeout !== 'undefined') ? clearTimeout : require("sdk/timers").clearTimeout;

const copyProperties = require('es6lib/object').copyProperties;

exports.document = typeof document !== 'undefined' ? document : null;

const inIframe = exports.inIframe = function inIframe() {
	try { return (window.self !== window.top); } catch (e) { return true; }
};

const createElement = exports.createElement = function createElement(tagName, properties, childList) {
	const element = (this || window).document.createElement(tagName);
	copyProperties(element, properties);
	for (var i = 0, child; childList && (child = childList[i]); ++i) {
		element.appendChild(child);
	}
	return element;
};

const createStyleElement = exports.createStyleElement = function createStyleElement(css) {
	const element = (this || window).document.createElement("style");
	element.type = "text/css";
	element.textContent = css;
	return element;
};

const addStyle = exports.addStyle = function addStyle(css) {
	return (this || window).document.querySelector("head").appendChild(createStyleElement(css));
};

const clickElement = exports.clickElement = function clickElement(element, win) {
	const evt = (win || this || window).document.createEvent('MouseEvents');
	evt.initEvent('click', true, true);
	element.dispatchEvent(evt);
	return evt;
};

/**
 * Invokes a save dialogue for a Blob object.
 * @param  {Blob|Url}  content The Blob or Url to save.
 * @param  {string}    name    The suggested file name.
 * @param  {window}    win     A window object to use instead of the global window.
 * @return {void}
 */
const saveAs = exports.saveAs = function saveAs(content, name, win) {
	win = win || this || window;
	const isBlob = content.type && typeof content.type === 'string';

	const link = Object.assign(win.document.createElement('a'), {
		download: name,
		target: '_blank', // fallback
		href: isBlob ? win.URL.createObjectURL(content) : content,
	});

	clickElement(link, win);

	isBlob && timeout(function() { win.URL.revokeObjectURL(link.href); }, 1000);
};

const once = exports.once = function once(element, event, callback, capture) {
	function handler() {
		element.removeEventListener(event, handler, capture);
		callback.apply(this, arguments);
	}
	element.addEventListener(event, handler, capture);
};

const getSelector = exports.getSelector = function getSelector(element, prev) {
	prev = prev || '';
	if (!element || element === (this || window).document) { return prev.slice(1); }
	return getSelector.call(
		this,
		element.parentNode,
		'>'+ element.tagName
		+ (element.id ? '#'+ element.id : '')
		+ (element.className ? '.'+ element.className.replace(/ +/g, '.') : '')
		+ prev
	);
};

const onElementChanged = exports.onElementChanged = function onElementChanged(element, attributeFilter, callback) {
	return new (this || window).MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			if (mutation.target.getAttribute(mutation.attributeName) != mutation.oldValue) {
				try { callback(mutation.target, mutation.oldValue); } catch(e) {  }
			}
		});
		observer.takeRecords();
	}).observe(element, { subtree: false, attributes: true, attributeOldValue: true, attributeFilter: attributeFilter });
};

const Self = new WeakMap();
const CreationObserver = exports.CreationObserver = function CreationObserver(element) {
	const listeners = [/*{ callback: function(){}, selector: string [, single: true] }*/];
	const observer = new MutationObserver(function(mutations, observer) {
		mutations.forEach(function(mutation) {
			for (var j = 0, element; (element = mutation.addedNodes[j]); j++) {
				elementCreated(listeners, element);
				if (element.querySelectorAll) {
					for (var list = element.querySelectorAll("*"),
						i=0; (element = list[i]); i++) {
						elementCreated(listeners, element);
					}
				}
			}
		});
		observer.takeRecords();
	});
	observer.listeners = listeners;
	observer.element = element || document;
	Self.set(this, observer);
};
function elementCreated(listeners, element) {
	element.matches && listeners.forEach(function(listener, index) {
		if (element.matches(listener.selector)) {
			timeout(listener.callback, 0, element);
			if (listener.single) {
				delete listeners[index];
			}
		}
	});
}
CreationObserver.prototype.add = function(selector, callback, single) {
	const self = Self.get(this);
	if (self.listeners.find(function(item) { return item.selector == selector && item.callback == callback && !item.single === !single; })) { return; }
	self.listeners.push({ selector: selector, callback: callback, single: single });
	self.listeners.length == 1 && self.observe(self.element, { subtree: true, childList: true });
};
CreationObserver.prototype.remove = function(selector, callback, single) {
	const self = Self.get(this);
	const length = self.listeners.length;
	self.listeners.filter(function(item) { return !item.selector == selector && item.callback == callback && !item.single == !single; });
	self.listeners.length === 0 && self.disconnect();
	return length - self.listeners.length;
};
CreationObserver.prototype.single = function(selector, callback) {
	const element = Self.get(this).element.querySelector(selector);
	if (element) {
		timeout(callback.bind(undefined, element), 0);
	} else {
		this.add(selector, callback, true);
	}
};
CreationObserver.prototype.all = function(selector, callback) {
	const alreadyExisting = Self.get(this).element.querySelectorAll(selector);
	this.add(selector, callback, false);

	for (var element, i = 0; (element = alreadyExisting[i]); i++) {
		timeout(callback.bind(undefined, element), 0);
	}
};

const notify = exports.notify = function notify(options) {
	return new Promise(function(resolve, reject) {
		function doIt() {
			const self = new Notification(options.title, options);
			self.onclick = resolve;
			self.onerror = reject;
			self.onclose = reject;
			self.onshow = unTimeout.bind(null, timeout(reject, options.timeout || 1500));
		}

		if (Notification.permission === "granted") {
			doIt();
		} else if (Notification.permission !== 'denied') {
			Notification.requestPermission(function(permission) {
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
};

const DOMContentLoaded = exports.DOMContentLoaded = new Promise(function(resolve, reject) {
	if (typeof document !== 'object') { return reject(); }
	if (document.readyState !== 'interactive' && document.readyState !== 'complete') {
		document.addEventListener('DOMContentLoaded', resolve);
	} else {
		resolve();
	}
});

const moduleName = 'es6lib/dom'; if (typeof module !== 'undefined') { module.exports = exports; } else if (typeof define === 'function') { define(moduleName, exports); } else if (typeof window !== 'undefined' && typeof module === 'undefined') { window[moduleName] = exports; } return exports; })({ });
