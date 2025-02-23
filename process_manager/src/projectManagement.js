import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TopNavBar from './navBar';
import './projectManagement.css';

function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  // State for delete confirmation modal.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  // State for generic alert modal.
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // State for project info modal.
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoProject, setInfoProject] = useState(null);

  // State for project edit modal.
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProject, setEditProject] = useState(null);

  // Helper function to trigger an alert modal.
  const triggerAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertModal(true);
  };

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
      triggerAlert('Missing Project Name', 'Project name is required');
      return;
    }
    if (!newProject.description) {
      triggerAlert('Missing Project Description', 'Project description is required');
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/projects', newProject);
      fetchProjects();
      setNewProject({ name: '', description: '' });
      triggerAlert('Success', 'Project created successfully');
    } catch (error) {
      console.error('Error creating project:', error);
      triggerAlert('Error', 'Error creating project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await axios.delete(`http://localhost:5001/api/projects/${projectId}`);
      fetchProjects();
      triggerAlert('Success', 'Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      triggerAlert('Error', 'Error deleting project');
    }
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      handleDeleteProject(projectToDelete);
      setProjectToDelete(null);
    }
    setShowDeleteModal(false);
  };

  const handleShowInfo = (project) => {
    setInfoProject(project);
    setShowInfoModal(true);
  };

  const handleShowEdit = (project) => {
    setEditProject(project);
    setShowEditModal(true);
  };

  const handleSaveEditProject = async () => {
    if (!editProject.description) {
      triggerAlert('Missing Project Description', 'Project description is required');
      return;
    }
    try {
      await axios.put(`http://localhost:5001/api/projects/${editProject._id}`, {
        description: editProject.description,
      });
      fetchProjects();
      triggerAlert('Success', 'Project updated successfully');
      setShowEditModal(false);
      setEditProject(null);
    } catch (error) {
      console.error('Error updating project:', error);
      triggerAlert('Error', 'Error updating project');
    }
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <TopNavBar currentPage="Manage Projects" />

      <div className="container-fluid my-4">
        <h2 className="mb-4">Project Management</h2>
        
        {/* Project Creation Form */}
        <div className="card mb-4">
          <div className="card-header">
            <h5>Create New Project</h5>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <input 
                type="text"
                className="form-control"
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <input 
                type="text"
                className="form-control"
                placeholder="Project Description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" onClick={handleCreateProject}>
              Create Project
            </button>
          </div>
        </div>

        {/* Existing Projects List */}
        <div className="card">
          <div className="card-header">
            <h5>Existing Projects</h5>
          </div>
          <ul className="list-group list-group-flush">
            {projects.map((project) => (
              <li
                key={project._id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <strong 
                    className="project-name"
                    onClick={() => handleShowInfo(project)}
                    style={{ cursor: 'pointer' }}
                  >
                    {project.name}
                  </strong>
                </div>
                <div>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleShowInfo(project)}
                  >
                    Info
                  </button>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleShowEdit(project)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setProjectToDelete(project._id);
                      setShowDeleteModal(true);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div className={`modal fade ${showDeleteModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Delete</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this project?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && <div className="modal-backdrop fade show"></div>}

      {/* Generic Alert Modal */}
      <div className={`modal fade ${showAlertModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{alertTitle}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowAlertModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{alertMessage}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowAlertModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAlertModal && <div className="modal-backdrop fade show"></div>}

      {/* Project Info Modal */}
      <div className={`modal fade ${showInfoModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{infoProject ? infoProject.name : ''} - Details</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p>{infoProject ? infoProject.description : 'No description available.'}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowInfoModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      {showInfoModal && <div className="modal-backdrop fade show"></div>}

      {/* Project Edit Modal */}
      <div className={`modal fade ${showEditModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit Project</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {editProject && (
                <>
                  <div className="mb-3">
                    <label className="form-label">Project Name</label>
                    <input type="text" className="form-control" value={editProject.name} readOnly />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Project Description</label>
                    <textarea 
                      className="form-control" 
                      value={editProject.description} 
                      onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEditProject}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEditModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
}

export default ProjectManagement;


