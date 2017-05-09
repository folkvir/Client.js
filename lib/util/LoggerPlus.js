var _ = require('lodash');
var EventEmitter = require('events');

function LoggerPlus(options) {
  this.options = _.merge({ verbose: false }, options);
  this.event = new EventEmitter();
}

/**
 * Log a message for a specified listeners if verbose true
 * @param  {string} level    Level of the message, see this.levels
 * @param  {object} message
 * @return {void}
 */
LoggerPlus.prototype.log = function (level, message) {
  if (this.options.verbose) this.event.emit(level, message);
};

module.exports = LoggerPlus;
