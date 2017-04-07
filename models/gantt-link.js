const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ganttLinkSchema = new Schema({
    source: { type: String, required: true },
    target: { type: String, required: true },
    type: { type: String, required: true },
    project_id: { type: String, required: true }
});

const GanttLink = mongoose.model('GanttLink', ganttLinkSchema);

module.exports = GanttLink;