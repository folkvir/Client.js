/*! @license MIT ©2013-2016 Ruben Verborgh, Ghent University - imec */
/* Single-function HTTP(S) request module for browsers */

var EventEmitter = require('events').EventEmitter,
    AsyncIterator = require('asynciterator'),
    parseLink = require('parse-link-header'),
    _ = require('lodash');

require('setimmediate');

// Headers we cannot send (see https://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader()-method)
var UNSAFE_REQUEST_HEADERS = _.object(['accept-encoding', 'user-agent', 'referer']);

// Resources that were already time-negotiated
var negotiatedResources = Object.create(null);

// Creates an HTTP request with the given settings
function createRequest(settings) {
  // PERFORMANCE HACK:
  // Reduce OPTIONS preflight requests by removing the Accept-Datetime header
  // on requests for resources that are presumed to have been time-negotiated
  if (negotiatedResources[removeQuery(settings.url)])
    delete settings.headers['accept-datetime'];

  // Create the actual XMLHttpRequest
  var request = new XMLHttpRequest(), reqHeaders = settings.headers;



  request.open(settings.method, settings.url, true);
  request.timeout = settings.timeout;
  for (var header in reqHeaders) {
    if (!(header in UNSAFE_REQUEST_HEADERS) && reqHeaders[header])
      request.setRequestHeader(header, reqHeaders[header]);
  }

  // Create a proxy for the XMLHttpRequest
  var requestProxy = new EventEmitter();
  requestProxy.abort = function () { request.abort(); };
  // Report errors and timeouts
  request.onerror = function (error) {
    console.log(error, request.status, request.statusText);
    requestProxy.emit('error', new Error('Error requesting ' + settings.url), request);
  };
  request.ontimeout = function (error) {
    requestProxy.emit('error', new Error('Timeout requesting ' + settings.url), request);
  };
  // Catch all errors, cause there is a bug if this code is not here !
  request.onreadystatechange = function (e) {
    if (request.readyState === 4) {
      if (request.status === 200) {
        // console.log('Request succeeded: ' + settings.url);
      } else {
        // Request error
        // console.log("Error:xmlhttprequest", request.statusText, request.status, request);
        // console.log(this.getAllResponseHeaders());
        // console.log(request.response);
        requestProxy.emit('error', new Error('Error requesting ' + settings.url), request);
      }
    }
  };

  // Handle the arrival of a response
  request.onload = function () {
    // Convert the response into an iterator
    var response = AsyncIterator.single(request.responseText || '');
    response.statusCode = request.status;
    // Parse the response headers
    var resHeaders = response.headers = {},
        rawHeaders = request.getAllResponseHeaders() || '',
        headerMatcher = /^([^:\n\r]+):[ \t]*([^\r\n]*)$/mg, match;
    while (match = headerMatcher.exec(rawHeaders))
      resHeaders[match[1].toLowerCase()] = match[2];

    // Emit the response
    console.log(response);
    requestProxy.emit('response', response);


    // If the resource was time-negotiated, store its queryless URI
    // to enable the PERFORMANCE HACK explained above
    if (reqHeaders['accept-datetime'] && resHeaders['memento-datetime']) {
      var resource = removeQuery(resHeaders['content-location'] || settings.url);
      if (!negotiatedResources[resource]) {
        // Ensure the resource is not a timegate
        var links = resHeaders.link && parseLink(resHeaders.link),
            timegate = removeQuery(links && links.timegate && links.timegate.url);
        if (resource !== timegate)
          negotiatedResources[resource] = true;
      }
    }
  };

  // Execute the request
  try {
    request.send();
  } catch (error) {
    console.log('Request Error: (Request.js)' , error);
    requestProxy.emit('error', new Error(error), request);
  }
  return requestProxy;
}

// Removes the query string from a URL
function removeQuery(url) {
  return url ? url.replace(/\?.*$/, '') : '';
}

module.exports = createRequest;
