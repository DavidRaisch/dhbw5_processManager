await axios.put(
  `http://localhost:5001/api/users/${editingUser._id}`,
  { ...editingUser, projects: uniqueProjects }
);