// ProjectManagement.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
//import './projectManagement.css';

function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name) {
      alert('Project name is required');
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/projects', newProject);
      fetchProjects();
      setNewProject({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await axios.delete(`http://localhost:5001/api/projects/${projectId}`);
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div className="project-management">
      <h2>Project Management</h2>
      <div className="project-form">
        <input
          type="text"
          placeholder="Project Name"
          value={newProject.name}
          onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Project Description"
          value={newProject.description}
          onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
        />
        <button onClick={handleCreateProject}>Create Project</button>
      </div>
      <h3>Existing Projects</h3>
      <ul>
        {projects.map((project) => (
          <li key={project._id}>
            <strong>{project.name}</strong> - {project.description}
            <button onClick={() => handleDeleteProject(project._id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProjectManagement;


//describtion should only be displayed, if the user clicks on the project, or if the user clicks on a button "info"
