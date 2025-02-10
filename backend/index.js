// backend.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize the app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/bpmn', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Process Schema & Model
const processSchema = new mongoose.Schema({
  name: { type: String, required: true },
  xml: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Process = mongoose.model('Process', processSchema);

// Instance Schema & Model
const instanceSchema = new mongoose.Schema({
  processId: { type: mongoose.Schema.Types.ObjectId, ref: 'Process', required: true },
  processName: { type: String, required: true },
  xml: { type: String, required: true },
  currentElement: { type: Object, default: null },
  sequenceMap: { type: Object, default: {} },
  gatewayChoices: { type: Array, default: [] },
  position: { type: String, required: true },
  status: { type: String, required: true, default: 'running' },
  created: { type: Date, default: Date.now },
});
const Instance = mongoose.model('Instance', instanceSchema);

// API Routes for Processes
app.post('/api/processes', async (req, res) => {
  const { name, xml } = req.body;
  if (!name || !xml) {
    return res.status(400).json({ error: 'Name and XML are required' });
  }
  try {
    const existingProcess = await Process.findOne({ name });
    if (existingProcess) {
      existingProcess.xml = xml;
      await existingProcess.save();
      return res.json({
        message: 'Process with this name already exists and has been overwritten.',
        process: existingProcess,
      });
    }
    const newProcess = new Process({ name, xml });
    await newProcess.save();
    res.json({
      message: 'New process created successfully.',
      process: newProcess,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error saving process' });
  }
});

app.get('/api/processes', async (req, res) => {
  try {
    const processes = await Process.find();
    res.json(processes);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving processes' });
  }
});

app.get('/api/processes/:id', async (req, res) => {
  try {
    const process = await Process.findById(req.params.id);
    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }
    res.json(process);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving process' });
  }
});

app.delete('/api/processes/:id', async (req, res) => {
  try {
    const process = await Process.findByIdAndDelete(req.params.id);
    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }
    res.json({ message: 'Process deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting process' });
  }
});

// API Routes for Active Instances
app.post('/api/instances', async (req, res) => {
  try {
    const instance = new Instance(req.body);
    await instance.save();
    res.json({ message: "Instance created", instance });
  } catch(err) {
    res.status(500).json({ error: "Error creating instance" });
  }
});

app.get('/api/instances', async (req, res) => {
  try {
    const instances = await Instance.find();
    res.json(instances);
  } catch (err) {
    res.status(500).json({ error: "Error fetching instances" });
  }
});

app.put('/api/instances/:id', async (req, res) => {
  try {
    const instance = await Instance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!instance) return res.status(404).json({ error: "Instance not found" });
    res.json({ message: "Instance updated", instance });
  } catch (err) {
    res.status(500).json({ error: "Error updating instance" });
  }
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
