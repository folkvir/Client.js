/*! @license MIT ©2014-2016 Miel Vander Sande, Ghent University - imec */
/* Writer that serializes a SPARQL query result application/sparql+xml */

var SparqlResultWriter = require('./SparqlResultWriter'),
    _ = require('lodash'),
    util = require('../util/RdfUtil'),
    xml = require('xml');

function SparqlXMLResultWriter(sparqlIterator) {
  SparqlResultWriter.call(this, sparqlIterator);
}
SparqlResultWriter.subclass(SparqlXMLResultWriter);

SparqlXMLResultWriter.prototype._writeHead = function (variableNames) {
  // Write root element
  var self = this,
      root = this._root = xml.element({
        _attr: { xlmns: 'http://www.w3.org/2005/sparql-results#' },
      });
  xml({ sparql: root }, { stream: true, indent: '  ', declaration: true })
     .on('data', function (chunk) { self._push(chunk + '\n'); });

  // Write head element
  if (variableNames.length) {
    root.push({
      head: variableNames.map(function (v) {
        return { variable: { _attr: { name: v } } };
      }),
    });
  }
};

SparqlXMLResultWriter.prototype._writeBindings = function (result) {
  // With the first result, write the results element
  if (!this._results)
    this._root.push({ results: this._results = xml.element({}) });

  // Unbound variables cannot be part of XML
  result = _.omit(result, function (value) {
    return value === undefined || value === null;
  });

  // Write the result element
  this._results.push({
    result: _.map(result, function (value, variable) {
      var xmlValue, lang, type;
      if (!util.isLiteral(value))
        xmlValue = util.isBlank(value) ? { bnode: value } : { uri: value };
      else {
        xmlValue = { literal: util.getLiteralValue(value) };
        if (lang = util.getLiteralLanguage(value))
          xmlValue.literal = [{ _attr: { 'xml:lang': lang } }, xmlValue.literal];
        else if (type = util.getLiteralType(value))
          xmlValue.literal = [{ _attr: {   datatype: type } }, xmlValue.literal];
      }
      return { binding: [{ _attr: { name: variable.substring(1) } }, xmlValue] };
    }),
  });
};

SparqlXMLResultWriter.prototype._writeBoolean = function (result) {
  this._root.push({ boolean: result });
};

SparqlXMLResultWriter.prototype._flush = function (done) {
  // If there were no matches, the results element hasn't been created yet
  if (this._empty)
    this._root.push({ results: this._results = xml.element({}) });
  // There's no results element for ASK queries
  if (this._results)
    this._results.close();
  this._root.close();
  done();
};

module.exports = SparqlXMLResultWriter;
