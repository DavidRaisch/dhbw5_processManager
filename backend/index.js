// backend.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect('mongodb://localhost:27017/bpmn', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.error(err));

/* ====================
   USER SCHEMA & MODEL
   ==================== */
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // stored hashed
  role: { type: String, required: true, enum: ['Admin', 'Manager', 'Employee'] },
});
const User = mongoose.model('User', userSchema);


/* =====================
   LOGIN ENDPOINT
   ===================== */
   app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      // Return user details (omit the password)
      return res.json({
        message: 'Login successful',
        user: { username: user.username, role: user.role },
      });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  });
app.post('/api/users', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  }
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    res.json({ message: 'User created successfully', user: { username, role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
// GET /api/users - Retrieves all users (excluding their passwords)
app.get('/api/users', async (req, res) => {
  try {
    // Exclude the password field by using projection: { password: 0 }
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving users' });
  }
});
// Update a user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, role, password } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    
    if (username) user.username = username;
    if (role) user.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    
    await user.save();
    const userWithoutPassword = { _id: user._id, username: user.username, role: user.role };
    res.json({ message: 'User updated successfully', user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Error updating user.' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user.' });
  }
});


/* ====================
   PROCESS & INSTANCE ROUTES
   ==================== */

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
  instanceName: { type: String, required: true }, // <-- New Field Added!
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

// API Routes for Instances
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
