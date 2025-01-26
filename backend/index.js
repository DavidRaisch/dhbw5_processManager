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

// Define a schema and model for BPMN processes
const processSchema = new mongoose.Schema({
  name: { type: String, required: true },
  xml: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Process = mongoose.model('Process', processSchema);

// API Routes
// Save a process (overwrite if name already exists)
app.post('/api/processes', async (req, res) => {
  const { name, xml } = req.body;

  if (!name || !xml) {
    return res.status(400).json({ error: 'Name and XML are required' });
  }

  try {
    // Check if a process with the same name already exists
    const existingProcess = await Process.findOne({ name });

    if (existingProcess) {
      // Overwrite the existing process
      existingProcess.xml = xml;
      await existingProcess.save();
      return res.json({
        message: 'Process with this name already exists and has been overwritten.',
        process: existingProcess,
      });
    }

    // Create a new process if no existing process was found
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

// Get all processes
app.get('/api/processes', async (req, res) => {
  try {
    const processes = await Process.find();
    res.json(processes);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving processes' });
  }
});

// Get a single process by ID
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

// Delete a process by ID
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

// Start the server
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
