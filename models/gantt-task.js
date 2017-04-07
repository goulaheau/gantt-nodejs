var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ganttTaskSchema = new Schema({
  text: { type: String, required: true },
  start_date: { type: Date, required: true },
  duration: { type: Number, required: true },
  progress: { type: Number, default: 0 },
  parent: { type: String, required: true }
});

var GanttTask = mongoose.model('GanttTask', ganttTaskSchema);

module.exports = GanttTask;