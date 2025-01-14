const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 5001;

app.use(cors());
app.use(bodyParser.json());

// Mock-Daten (ersetzt die Datenbank vorübergehend)
let processes = [
  { id: 1, name: "Test Process 1", status: "pending" },
  { id: 2, name: "Test Process 2", status: "completed" }
];

// Endpunkt: Alle Prozesse abrufen
app.get('/api/processes', (req, res) => {
  res.json(processes);
});

// Endpunkt: Neuen Prozess hinzufügen
app.post('/api/processes', (req, res) => {
  const newProcess = { id: processes.length + 1, ...req.body };
  processes.push(newProcess);
  res.json(newProcess);
});

// Server starten
app.listen(port, () => {
  console.log(`Backend läuft auf http://localhost:${port}`);
});
