app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).populate('projects', 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving users' });
  }
});