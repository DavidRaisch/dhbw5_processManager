import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TopNavBar from './navBar';
import './userManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', role: 'Employee', password: '', projects: [] });
  const [editingUser, setEditingUser] = useState(null);
  const [availableProjects, setAvailableProjects] = useState([]);
  const roleOptions = ['Admin', 'Manager', 'Employee'];

  // State for generic alert modal.
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // State for delete confirmation modal.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // State for change password modal.
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Helper to trigger alert modal
  const triggerAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertModal(true);
  };

  useEffect(() => {
    fetchUsers();
    fetchAvailableProjects();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('http://localhost:5001/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchAvailableProjects = async () => {
    try {
      const { data } = await axios.get('http://localhost:5001/api/projects');
      setAvailableProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleCreateUser = async () => {
    // require username, password, and at least one project
    if (!newUser.username || !newUser.password || newUser.projects.length === 0) {
      triggerAlert(
        'Missing Fields',
        'Username, Password and at least one project must be assigned'
      );
      return;
    }
    const uniqueProjects = [...new Set(newUser.projects)];
    try {
      await axios.post('http://localhost:5001/api/users', { ...newUser, projects: uniqueProjects });
      fetchUsers();
      setNewUser({ username: '', role: 'Employee', password: '', projects: [] });
      triggerAlert('Success', 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      triggerAlert('Error', 'Error creating user');
    }
  };

  const handleEditUser = (user) => {
    const projects = Array.isArray(user.projects)
      ? user.projects.map(p => (typeof p === 'object' ? p._id : p))
      : [];
    setEditingUser({ ...user, projects });
  };

  const handleUpdateUser = async () => {
    // require at least one project
    if (!editingUser.username || editingUser.projects.length === 0) {
      triggerAlert(
        'Missing Fields',
        'Username and at least one project must be assigned'
      );
      return;
    }
    const uniqueProjects = [...new Set(editingUser.projects)];
    try {
      await axios.put(
        `http://localhost:5001/api/users/${editingUser._id}`,
        { ...editingUser, projects: uniqueProjects }
      );
      setEditingUser(null);
      fetchUsers();
      triggerAlert('Success', 'User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      triggerAlert('Error', 'Error updating user');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await axios.delete(`http://localhost:5001/api/users/${id}`);
      fetchUsers();
      triggerAlert('Success', 'User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      triggerAlert('Error', 'Error deleting user');
    }
  };

  const confirmDelete = () => {
    if (userToDelete) handleDeleteUser(userToDelete);
    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  // Toggle project selection for new user.
  const handleNewUserProjectToggle = (projectId) => {
    setNewUser(prev => {
      const has = prev.projects.includes(projectId);
      const projects = has
        ? prev.projects.filter(id => id !== projectId)
        : [...prev.projects, projectId];
      return { ...prev, projects };
    });
  };

  // Toggle project selection for editing user.
  const handleEditUserProjectToggle = (projectId) => {
    setEditingUser(prev => {
      const has = prev.projects.includes(projectId);
      const projects = has
        ? prev.projects.filter(id => id !== projectId)
        : [...prev.projects, projectId];
      return { ...prev, projects };
    });
  };

  // Handle Change Password modal submission.
  const handleChangePassword = async () => {
    if (!newPassword) {
      triggerAlert('Missing Password', 'Please enter a new password');
      return;
    }
    try {
      await axios.put(`http://localhost:5001/api/users/${changePasswordUser._id}`, { password: newPassword });
      triggerAlert('Success', 'Password updated successfully');
      setShowChangePasswordModal(false);
      setChangePasswordUser(null);
      setNewPassword('');
      fetchUsers();
    } catch (error) {
      console.error('Error updating password:', error);
      triggerAlert('Error', 'Error updating password');
    }
  };

  return (
    <>
      <TopNavBar currentPage="Manage Users" />

      <div className="container-fluid my-4">
        <h2 className="mb-4">User Management</h2>

        {/* New User Form */}
        <div className="card mb-4">
          <div className="card-header"><h5>Create New User</h5></div>
          <div className="card-body">
            <input 
              type="text"
              className="form-control mb-3"
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
            <input 
              type="password"
              className="form-control mb-3"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            {/* Role Dropdown */}
            <div className="dropdown mb-3">
              <button 
                className="form-control dropdown-toggle custom-dropdown" 
                type="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
              >
                {newUser.role}
              </button>
              <ul className="dropdown-menu w-100">
                {roleOptions.map(role => (
                  <li key={role}>
                    <button
                      className="dropdown-item"
                      onClick={() => setNewUser({ ...newUser, role })}
                    >
                      {role}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {/* Projects */}
            <div className="project-assignment-box mb-3">
              <h5>Assign Projects</h5>
              {availableProjects.map(project => (
                <label key={project._id} className="form-check-label me-2">
                  <input
                    type="checkbox"
                    className="form-check-input me-1"
                    checked={newUser.projects.includes(project._id)}
                    onChange={() => handleNewUserProjectToggle(project._id)}
                  />
                  {project.name}
                </label>
              ))}
            </div>
            <button
              className={`btn btn-primary ${!newUser.username || !newUser.password || newUser.projects.length === 0
                ? 'opacity-50'
                : ''}`}
              onClick={handleCreateUser}
            >
              Create User
            </button>
          </div>
        </div>

        {/* Edit User Form */}
        {editingUser && (
          <div className="card mb-4">
            <div className="card-header"><h5>Edit User</h5></div>
            <div className="card-body">
              {/* Username jetzt editierbar */}
              <div className="mb-3">
                <input 
                  type="text"
                  className="form-control"
                  value={editingUser.username}
                  onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                />
              </div>
              {/* Role Dropdown */}
              <div className="dropdown mb-3">
                <button 
                  className="form-control dropdown-toggle custom-dropdown" 
                  type="button" 
                  data-bs-toggle="dropdown" 
                  aria-expanded="false"
                >
                  {editingUser.role}
                </button>
                <ul className="dropdown-menu w-100">
                  {roleOptions.map(role => (
                    <li key={role}>
                      <button
                        className="dropdown-item"
                        onClick={() => setEditingUser({ ...editingUser, role })}
                      >
                        {role}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Projects */}
              <div className="project-assignment-box mb-3">
                <h5>Assign Projects</h5>
                {availableProjects.map(project => (
                  <label key={project._id} className="form-check-label me-2">
                    <input
                      type="checkbox"
                      className="form-check-input me-1"
                      checked={editingUser.projects.includes(project._id)}
                      onChange={() => handleEditUserProjectToggle(project._id)}
                    />
                    {project.name}
                  </label>
                ))}
              </div>
              <button
                className={`btn btn-primary me-2 ${(!editingUser.username || editingUser.projects.length === 0) ? 'opacity-50' : ''}`}
                onClick={handleUpdateUser}
              >
                Update User
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="card">
          <div className="card-header"><h5>Existing Users</h5></div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Projects</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>
                      {user.projects?.length
                        ? user.projects.map(p => p.name).join(', ')
                        : 'None'}
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm me-2" onClick={() => handleEditUser(user)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-warning btn-sm me-2"
                        onClick={() => {
                          setChangePasswordUser(user);
                          setShowChangePasswordModal(true);
                        }}
                      >
                        Change Password
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setUserToDelete(user._id);
                          setShowDeleteModal(true);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div className={`modal fade ${showDeleteModal ? 'show d-block' : ''}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Delete</h5>
              <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this user?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && <div className="modal-backdrop fade show"></div>}

      {/* Change Password Modal */}
      <div className={`modal fade ${showChangePasswordModal ? 'show d-block' : ''}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Change Password for {changePasswordUser?.username}</h5>
              <button type="button" className="btn-close" onClick={() => setShowChangePasswordModal(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <input 
                type="password" 
                className="form-control" 
                placeholder="New Password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowChangePasswordModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleChangePassword}>
                Save Password
              </button>
            </div>
          </div>
        </div>
      </div>
      {showChangePasswordModal && <div className="modal-backdrop fade show"></div>}

      {/* Generic Alert Modal */}
      <div className={`modal fade ${showAlertModal ? 'show d-block' : ''}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{alertTitle}</h5>
              <button type="button" className="btn-close" onClick={() => setShowAlertModal(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{alertMessage}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowAlertModal(false)}>OK</button>
            </div>
          </div>
        </div>
      </div>
      {showAlertModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
}

export default UserManagement;




//TODO: A Project must be assigned to a user