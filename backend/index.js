// backend.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bpmn', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.error(err));

/* ====================
   NOTIFICATION SCHEMA & MODEL
   ===================== */
   const notificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instance', required: true },
    requestedBy: { type: String, required: true },
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetRole: { type: String, enum: ['Admin', 'Manager', 'Employee'], default: 'Manager' },
    status: { type: String, enum: ['pending', 'approved', 'dismissed'], default: 'pending' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }
  });
  const Notification = mongoose.model('Notification', notificationSchema);
  

/* ====================
   NOTIFICATION ENDPOINTS
   ===================== */

// Create a new notification
app.post('/api/notifications', async (req, res) => {
  const { message, instanceId, requestedBy, requestedById, targetRole, status, project } = req.body;
  if (!message || !instanceId || !requestedBy || !requestedById || !project) {
    return res.status(400).json({ error: 'Missing required fields for notification.' });
  }
  try {
    const notification = new Notification({
      message,
      instanceId,
      requestedBy,
      requestedById,
      targetRole: targetRole || 'Manager',
      status: status || 'pending',
      project
    });
    await notification.save();
    res.json({ message: 'Notification created', notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating notification' });
  }
});


// GET notifications filtered by targetRole and project names
app.get('/api/notifications', async (req, res) => {
  const { targetRole, projectNames } = req.query;
  try {
    let filter = {};
    if (targetRole) filter.targetRole = targetRole;
    // First, fetch notifications matching role
    const notifications = await Notification.find(filter).populate('project', 'name');
    // If projectNames is provided, filter in memory by comparing the populated project's name.
    if (projectNames) {
      const namesArray = projectNames.split(',').map(name => name.trim()).filter(name => name);
      const filtered = notifications.filter(notif => 
        notif.project && namesArray.includes(notif.project.name)
      );
      return res.json(filtered);
    }
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});




// Delete a notification by ID
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting notification.' });
  }
});

// Update an existing notification
app.put('/api/notifications/:id', async (req, res) => {
  const updates = req.body;
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Notification updated successfully.', notification });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Error updating notification.' });
  }
});


/* ====================
   PROJECT SCHEMA & MODEL
   ===================== */
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const Project = mongoose.model('Project', projectSchema);

/* ====================
   USER SCHEMA & MODEL (updated to include projects)
   ===================== */
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['Admin', 'Manager', 'Employee'] },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
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
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
    return res.json({
      message: 'Login successful',
      user: { _id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create User Endpoint (POST /api/users)
app.post('/api/users', async (req, res) => {
  const { username, password, role, projects } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  }
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'User already exists.' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Ensure projects array is unique (if provided)
    const uniqueProjects = projects ? [...new Set(projects)] : [];
    const newUser = new User({ username, password: hashedPassword, role, projects: uniqueProjects });
    await newUser.save();
    res.json({ 
      message: 'User created successfully', 
      user: { _id: newUser._id, username, role, projects: newUser.projects } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET Users (GET /api/users) - Populate projects with only the name field.
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).populate('projects', 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving users' });
  }
});

// GET a single user with projects populated and password excluded
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 }).populate('projects', 'name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving user' });
  }
});


// Update User Endpoint (PUT /api/users/:id)
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, role, password, projects } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (username) user.username = username;
    if (role) user.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    if (projects) {
      // Ensure uniqueness
      user.projects = [...new Set(projects)];
    }
    await user.save();
    const userWithoutPassword = { _id: user._id, username: user.username, role: user.role, projects: user.projects };
    res.json({ message: 'User updated successfully', user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Error updating user.' });
  }
});

// Delete User Endpoint (DELETE /api/users/:id)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user.' });
  }
});

// Assign Projects Endpoint (POST /api/users/:userId/assign-projects)
app.post('/api/users/:userId/assign-projects', async (req, res) => {
  const { userId } = req.params;
  const { projectIds } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.projects = [...new Set(projectIds)];
    await user.save();
    res.json({ message: 'User projects updated successfully', projects: user.projects });
  } catch (err) {
    res.status(500).json({ error: "Error updating user's projects" });
  }
});

// Change Password Endpoint
app.put('/api/users/:id/changePassword', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    // Compare the provided current password with the stored hash
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect.' });
    // Update the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ error: 'Error updating password.' });
  }
});


/* ====================
   PROJECT MANAGEMENT ENDPOINTS
   ===================== */

// Create Project Endpoint (POST /api/projects)
app.post('/api/projects', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required.' });
  try {
    const newProject = new Project({ name, description });
    await newProject.save();
    res.json({ message: 'Project created successfully', project: newProject });
  } catch (err) {
    res.status(500).json({ error: 'Error creating project' });
  }
});

// Get Projects (GET /api/projects)
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const projects = await Project.findById(req.params.id);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving projects' });
  }
});

// Update Project Endpoint (PUT /api/projects/:id)
app.put('/api/projects/:id', async (req, res) => {
  // Name und Beschreibung aus dem Request-Body ziehen
  const { name, description } = req.body;
  try {
    // Beide Felder updaten
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Error updating project' });
  }
});


// Delete Project Endpoint (DELETE /api/projects/:id)
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting project' });
  }
});

/* ====================
   PROCESS & INSTANCE ROUTES
   ===================== */

/* 
   UPDATED PROCESS SCHEMA:
   Now each process can be assigned to a project.
*/
const processSchema = new mongoose.Schema({
  name: { type: String, required: true },
  xml: { type: String, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdAt: { type: Date, default: Date.now },
});
const Process = mongoose.model('Process', processSchema);

// Instance Schema & Model
const instanceSchema = new mongoose.Schema({
  processId: { type: mongoose.Schema.Types.ObjectId, ref: 'Process', required: true },
  processName: { type: String, required: true },
  instanceName: { type: String, required: true },
  xml: { type: String, required: true },
  currentElement: { type: Object, default: null },
  sequenceMap: { type: Object, default: {} },
  gatewayChoices: { type: Array, default: [] },
  position: { type: String, required: true },
  status: { type: String, required: true, default: 'running' },
  created: { type: Date, default: Date.now },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  completedAt: { type: Date, default: null }
});
const Instance = mongoose.model('Instance', instanceSchema);

// Process Endpoints remain similar, with population of project.
app.post('/api/processes', async (req, res) => {
  const { name, xml, project } = req.body;
  if (!name || !xml) return res.status(400).json({ error: 'Name and XML are required' });
  try {
    const existingProcess = await Process.findOne({ name });
    if (existingProcess) {
      existingProcess.xml = xml;
      existingProcess.project = project;
      await existingProcess.save();
      return res.json({
        message: 'Process with this name already exists and has been overwritten.',
        process: existingProcess,
      });
    }
    const newProcess = new Process({ name, xml, project });
    await newProcess.save();
    res.json({ message: 'New process created successfully.', process: newProcess });
  } catch (err) {
    res.status(500).json({ error: 'Error saving process' });
  }
});

app.get('/api/processes', async (req, res) => {
  try {
    const processes = await Process.find().populate('project', 'name');
    res.json(processes);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving processes' });
  }
});

app.get('/api/processes/:id', async (req, res) => {
  try {
    const process = await Process.findById(req.params.id).populate('project', 'name');
    if (!process) return res.status(404).json({ error: 'Process not found' });
    res.json(process);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving process' });
  }
});

app.delete('/api/processes/:id', async (req, res) => {
  try {
    const process = await Process.findByIdAndDelete(req.params.id);
    if (!process) return res.status(404).json({ error: 'Process not found' });
    res.json({ message: 'Process deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting process' });
  }
});

// Instances endpoints remain unchanged.
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


//TODO: structure this code in to more backend classes
