// Requires
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const moment = require('moment');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const app = express();
require("date-format-lite");
const server = http.createServer(app);
const io = socketio.listen(server);
mongoose.connect('mongodb://localhost/gantt');

// Permet de router vers une vue en ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public'));

// Permet de rediriger la requete principale vers index.html
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

// Declaration du tableau contenant les sockets des utilisateurs connectes
var sockets = [];

/***********************/ 
/* Gestion des Projets */
/***********************/
// Modele Projet
const Project = require('./models/project');

// A la connection sur l'index.html
io.on('connection', function (socket) {
	// Ajout du socket de l'utilisateurs au tableau
	sockets.push(socket);
	
	// Recuperation de tous les Projets en BDD
	Project.find({}, function (err, projects) {
		if (err) throw err;
		
		// Broadcast du chargement des Projets et envoie des Projets 
		broadcast('projectsLoaded', projects);
	});
	
	// A l'ajout d'un Projet
	socket.on('addProject', function (name) {
		var name = String(name || '');
		
		if (!name) {
			return;
		}
		
		// Creation d'un nouveau Projet
		var newProject = Project({
			name: name
		});
	
		// Sauvegarde du Projet en BDD
		newProject.save(function (err, result) {
			if (err) throw err;
			
			// Broacast de l'ajout d'un Projet et envoie du Projet
			broadcast('projectAdded', result);
		});
	});
});

// Emet les evenements et des donnees vers tous les utilisateurs
function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

/**********************/ 
/* Gestion des Gantts */
/**********************/ 
var GanttTask = require('./models/gantt-task');
var GanttLink = require('./models/gantt-link');

var project_id = null;

// Rendu de la page gantt.ejs en passant en parametre l'id du Projet
app.get("/gantt/:project_id", function (req, res) {
	var project_id = req.params.project_id;
	res.render('gantt', { project_id: project_id });
});

// Recuperation des donnees du Gantt du Projet correspondant a l'id
app.get("/data/:project_id", function (req, res) {
	project_id = req.params.project_id;
	
	GanttTask.find({project_id: project_id}, function(err, rows) {
		if (err) throw err;
		
	    GanttLink.find({}, function(err, links) {
	    	if (err) throw err;
	    	
	    	for (var i in rows) {
	    		rows[i] = rows[i].toObject();
	    		
	    		// Conversion du type Date de Mongo vers un autre format
				var date = moment(rows[i].start_date);
				rows[i].start_date = date.format("YYYY-MM-DD");
				rows[i].open = true;
				
				// Recuperation de l'id de Mongo
				rows[i].id = rows[i]._id;
			}
			
			// Recuperation de l'id de Mongo
			for (var i in links) {
				links[i] = links[i].toObject();
				links[i].id = links[i]._id;
			}

			// Renvoie des donnees du Gantt
			res.send({ data: rows, collections: { links: links } });
	    });
	});
});

// Creation d'une tache
app.post("/data/task", function (req, res) {
	var task = getTask(req.body);
	
	var newGanttTask = GanttTask({
		text: task.text,
		start_date: task.start_date,
		duration: task.duration,
		progress: task.progress, 
		parent: task.parent,
		project_id: task.project_id //Ajout de l'attribut project_id
	});
	
	newGanttTask.save(function (err, result) {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

// Modification d'une tache
app.put("/data/task/:id", function (req, res) {
	var sid = req.params.id,
		task = getTask(req.body);

	GanttTask.findByIdAndUpdate(sid, task, function (err, result) {
		if (err) throw err;
	
		sendResponse(res, "updated", null, err);
	});
});

// Suppression d'une tache
app.delete("/data/task/:id", function (req, res) {
	var sid = req.params.id;
	
	GanttTask.findByIdAndRemove(sid, function (err) {
		if (err) throw err;
	  
		sendResponse(res, "deleted", null, err);
	});
});

// Creation d'un Lien
app.post("/data/link", function (req, res) {
	var link = getLink(req.body);

	var newGanttLink = GanttLink({
		source: link.source,
		target: link.target,
		type: link.type,
		project_id: link.project_id // Ajout de l'attribut project_id
	});
	
	newGanttLink.save(function (err, result) {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

// Modification d'un lien
app.put("/data/link/:id", function (req, res) {
	var sid = req.params.id,
		link = getLink(req.body);

	GanttLink.findByIdAndUpdate(sid, link, function (err, result) {
	  if (err) throw err;
	
	  sendResponse(res, "updated", null, err);
	});
});

// Suppression d'un lien
app.delete("/data/link/:id", function (req, res) {
	var sid = req.params.id;
	
	GanttLink.findByIdAndRemove(sid, function (err) {
		if (err) throw err;
	  
		sendResponse(res, "deleted", null, err);
	});
});

// Convertit les donnees en une Tache
function getTask(data) {
	return {
		text: data.text,
		start_date: data.start_date.date("YYYY-MM-DD"),
		duration: data.duration,
		progress: data.progress || 0,
		parent: data.parent,
		project_id: project_id
	};
}

// Convertir les donnes en un Lien
function getLink(data) {
	return {
		source: data.source,
		target: data.target,
		type: data.type,
		project_id: project_id
	};
}

// Envoie une Reponse dans le bon format pour les JS du Gaant
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

// Lancement de l'ecoute du Serveur
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
    var addr = server.address();
    console.log("Server listening at", addr.address + ":" + addr.port);
});