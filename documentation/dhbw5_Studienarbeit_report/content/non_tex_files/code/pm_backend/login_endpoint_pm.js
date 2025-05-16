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