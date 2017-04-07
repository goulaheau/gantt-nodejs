const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ganttTaskSchema = new Schema({
  text: { type: String, required: true },
  start_date: { type: Date, required: true },
  duration: { type: Number, required: true },
  progress: { type: Number, default: 0 },
  parent: { type: String, required: true },
  project_id: { type: String, required: true }
});

const GanttTask = mongoose.model('GanttTask', ganttTaskSchema);

module.exports = GanttTask;