var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ganttLinkSchema = new Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: { type: String, required: true }
});

var GanttLink = mongoose.model('GanttLink', ganttLinkSchema);

module.exports = GanttLink;