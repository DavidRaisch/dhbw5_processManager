await axios.put(
  `http://localhost:5001/api/projects/${editProject._id}`,
  { name: editProject.name, description: editProject.description }
);