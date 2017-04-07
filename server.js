var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var moment = require('moment');

require("date-format-lite");

var port = 8080;
var app = express();
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/gantt');

var GanttTask = require('./models/gantt-task');
var GanttLink = require('./models/gantt-link');

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/data", function (req, res) {
	GanttTask.find({}, function(err, rows) {
		if (err) throw err;
		
	    GanttLink.find({}, function(err, links) {
	    	if (err) throw err;
	    	
	    	for (var i in rows) {
	    		rows[i] = rows[i].toObject();
				var date = moment(rows[i].start_date);
				
				rows[i].start_date = date.format("YYYY-MM-DD");
				rows[i].open = true;
				
				rows[i].id = rows[i]._id;
			}
			
			for (var i in links) {
				links[i] = links[i].toObject();
				links[i].id = links[i]._id;
			}

			res.send({ data: rows, collections: { links: links } });
	    });
	});
});

app.post("/data/task", function (req, res) {
	var task = getTask(req.body);

	var newGanttTask = GanttTask({
		text: task.text,
		start_date: task.start_date,
		duration: task.duration,
		progress: task.progress, 
		parent: task.parent
	});
	
	newGanttTask.save(function (err, result) {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

app.put("/data/task/:id", function (req, res) {
	var sid = req.params.id,
		task = getTask(req.body);

	GanttTask.findByIdAndUpdate(sid, task, function (err, result) {
		if (err) throw err;
	
		sendResponse(res, "updated", null, err);
	});
});

app.delete("/data/task/:id", function (req, res) {
	var sid = req.params.id;
	
	GanttTask.findByIdAndRemove(sid, function (err) {
		if (err) throw err;
	  
		sendResponse(res, "deleted", null, err);
	});
});

app.post("/data/link", function (req, res) {
	var link = getLink(req.body);

	var newGanttLink = GanttLink({
		source: link.source,
		target: link.target,
		type: link.type
	});
	
	newGanttLink.save(function (err, result) {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

app.put("/data/link/:id", function (req, res) {
	var sid = req.params.id,
		link = getLink(req.body);

	GanttLink.findByIdAndUpdate(sid, link, function (err, result) {
	  if (err) throw err;
	
	  sendResponse(res, "updated", null, err);
	});
});

app.delete("/data/link/:id", function (req, res) {
	var sid = req.params.id;
	
	GanttLink.findByIdAndRemove(sid, function (err) {
		if (err) throw err;
	  
		sendResponse(res, "deleted", null, err);
	});
});

function getTask(data) {
	return {
		text: data.text,
		start_date: data.start_date.date("YYYY-MM-DD"),
		duration: data.duration,
		progress: data.progress || 0,
		parent: data.parent
	};
}

function getLink(data) {
	return {
		source: data.source,
		target: data.target,
		type: data.type
	};
}

function sendResponse(res, action, tid, error) {
	if (error) {
		console.log(error);
		action = "error";
	}

	var result = {
		action: action
	};
	
	if (tid !== undefined && tid !== null)
		result.tid = tid;

	res.send(result);
}

app.listen(port, function () {
	console.log("Server is running on port " + port + "...");
});