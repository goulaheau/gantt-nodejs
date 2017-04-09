(function(){
"use strict";
 

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
require('rootpath')();
const session = require('express-session');
const expressJwt = require('express-jwt');
const config = require('config.json');

app.set('view engine', 'ejs');
app.set('views', __dirname + '/public');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: config.secret, resave: false, saveUninitialized: true }));

// use JWT auth to secure the api
app.use('/api', expressJwt({ secret: config.secret }).unless({ path: ['/api/users/authenticate', '/api/users/register'] }));

// routes utilisateur
app.use('/login', require('./controllers/login.controller'));
app.use('/register', require('./controllers/register.controller'));
app.use('/app', require('./controllers/app.controller'));
app.use('/api/users', require('./controllers/api/users.controller'));

// make '/app' default route
app.get('/', (req, res) => {
    return res.redirect('/app');
});

// Permet de rediriger la requete principale vers index.html
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

// Declaration du tableau contenant les sockets des utilisateurs connectes
let sockets = [];

/***********************/ 
/* Gestion des Projets */
/***********************/
// Modele Projet
const Project = require('./models/project');

// A la connection sur l'index.html
io.on('connection', (socket) => {
	// Ajout du socket de l'utilisateurs au tableau
	sockets.push(socket);
	
	// Recuperation de tous les Projets en BDD
	Project.find({}, (err, projects) => {
		if (err) throw err;
		
		// Broadcast du chargement des Projets et envoie des Projets 
		broadcast('projectsLoaded', projects);
	});
	
	// A l'ajout d'un Projet
	socket.on('addProject', (name) => {
		let nameChecked = String(name || '');
		
		if (!nameChecked) {
			return;
		}
		
		// Creation d'un nouveau Projet
		let newProject = Project({
			name: nameChecked
		});
	
		// Sauvegarde du Projet en BDD
		newProject.save((err, project) => {
			if (err) throw err;
			
			// Broacast de l'ajout d'un Projet et envoie du Projet
			broadcast('projectAdded', project);
		});
	});
});

// Emet les evenements et des donnees vers tous les utilisateurs
function broadcast(event, data) {
  sockets.forEach((socket) => {
    socket.emit(event, data);
  });
}

/**********************/ 
/* Gestion des Gantts */
/**********************/ 
const GanttTask = require('./models/gantt-task');
const GanttLink = require('./models/gantt-link');

let project_id = null;

// Rendu de la page gantt.ejs en passant en parametre l'id du Projet
app.get("/gantt/:project_id", (req, res) => {
	project_id = req.params.project_id;
	res.render('gantt', { project_id: project_id });
});

// Recuperation des donnees du Gantt du Projet correspondant a l'id
app.get("/data/:project_id", (req, res) => {
	project_id = req.params.project_id;
	
	GanttTask.find({project_id: project_id}, (err, rows) => {
		if (err) throw err;
		
	    GanttLink.find({}, (err, links) => {
	    	if (err) throw err;
	    	
	    	for (var i in rows) {
	    		rows[i] = rows[i].toObject();
	    		
	    		// Conversion du type Date de Mongo vers un autre format
				rows[i].start_date = moment(rows[i].start_date).format("YYYY-MM-DD");
				
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
app.post("/data/task", (req, res) => {
	let task = getTask(req.body);
	
	let newGanttTask = GanttTask({
		text: task.text,
		start_date: task.start_date,
		duration: task.duration,
		progress: task.progress, 
		parent: task.parent,
		project_id: task.project_id //Ajout de l'attribut project_id
	});
	
	newGanttTask.save((err, result) => {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

// Modification d'une tache
app.put("/data/task/:id", (req, res) => {
	let sid = req.params.id,
		task = getTask(req.body);

	GanttTask.findByIdAndUpdate(sid, task, (err, result) => {
		if (err) throw err;
	
		sendResponse(res, "updated", null, err);
	});
});

// Suppression d'une tache
app.delete("/data/task/:id", (req, res) => {
	let sid = req.params.id;
	
	GanttTask.findByIdAndRemove(sid, (err) => {
		if (err) throw err;
	  
		sendResponse(res, "deleted", null, err);
	});
});

// Creation d'un Lien
app.post("/data/link", (req, res) => {
	let link = getLink(req.body);

	let newGanttLink = GanttLink({
		source: link.source,
		target: link.target,
		type: link.type,
		project_id: link.project_id // Ajout de l'attribut project_id
	});
	
	newGanttLink.save((err, result) => {
		if (err) throw err;
		
		sendResponse(res, "inserted", result ? result._id : null, err);
	});
});

// Modification d'un lien
app.put("/data/link/:id", (req, res) => {
	let sid = req.params.id,
		link = getLink(req.body);

	GanttLink.findByIdAndUpdate(sid, link, (err, result) => {
	  if (err) throw err;
	
	  sendResponse(res, "updated", null, err);
	});
});

// Suppression d'un lien
app.delete("/data/link/:id", (req, res) => {
	let sid = req.params.id;
	
	GanttLink.findByIdAndRemove(sid, (err) => {
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
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", () => {
    let addr = server.address();
    console.log("Server listening at", addr.address + ":" + addr.port);
});
 
})()
