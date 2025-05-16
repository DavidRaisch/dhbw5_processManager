const handleCreateProject = async () => {
  if (!newProject.name || !newProject.description) {
    triggerAlert('Missing Project Information', 'Project name and description are required');
    return;
  }
  try {
    await axios.post('http://localhost:5001/api/projects', newProject);
    fetchProjects();
    setNewProject({ name: '', description: '' });
    triggerAlert('Success', 'Project created successfully');
  } catch (err) {
    console.error('Error creating project:', err);
    triggerAlert('Error', 'Error creating project');
  }
};
