// userManagement.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './userManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', role: 'Employee', password: '', projects: [] });
  const [editingUser, setEditingUser] = useState(null);
  const [availableProjects, setAvailableProjects] = useState([]);
  const roleOptions = ['Admin', 'Manager', 'Employee'];

  useEffect(() => {
    fetchUsers();
    fetchAvailableProjects();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAvailableProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/projects');
      setAvailableProjects(response.data);
    } catch (error) {
      console.error('Error fetching available projects:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert('Username and Password are required');
      return;
    }
    // Ensure uniqueness in newUser.projects
    const uniqueProjects = [...new Set(newUser.projects)];
    try {
      await axios.post('http://localhost:5001/api/users', { ...newUser, projects: uniqueProjects });
      fetchUsers();
      setNewUser({ username: '', role: 'Employee', password: '', projects: [] });
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleEditUser = (user) => {
    // Convert projects to an array of IDs if they are objects.
    const projects =
      user.projects && Array.isArray(user.projects)
        ? user.projects.map(proj => (typeof proj === 'object' ? proj._id : proj))
        : [];
    setEditingUser({ ...user, projects });
  };

  const handleUpdateUser = async () => {
    if (!editingUser.username) {
      alert('Username is required');
      return;
    }
    const uniqueProjects = [...new Set(editingUser.projects)];
    try {
      await axios.put(`http://localhost:5001/api/users/${editingUser._id}`, { ...editingUser, projects: uniqueProjects });
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`http://localhost:5001/api/users/${id}`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Toggle project selection for new user
  const handleNewUserProjectToggle = (projectId) => {
    setNewUser(prevState => {
      let projects;
      if (prevState.projects.includes(projectId)) {
        projects = prevState.projects.filter(id => id !== projectId);
      } else {
        projects = [...prevState.projects, projectId];
      }
      projects = [...new Set(projects)]; // ensure uniqueness
      return { ...prevState, projects };
    });
  };

  // Toggle project selection for editing user
  const handleEditUserProjectToggle = (projectId) => {
    setEditingUser(prevState => {
      let projects;
      if (prevState.projects.includes(projectId)) {
        projects = prevState.projects.filter(id => id !== projectId);
      } else {
        projects = [...prevState.projects, projectId];
      }
      projects = [...new Set(projects)];
      return { ...prevState, projects };
    });
  };

  return (
    <div className="user-management">
      <h2>User Management</h2>

      {/* New User Form */}
      <div className="user-form">
        <h3>Create New User</h3>
        <input
          type="text"
          placeholder="Username"
          value={newUser.username}
          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={newUser.password}
          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
        />
        <select
          value={newUser.role}
          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <div className="project-assignment-box">
          <h4>Assign Projects</h4>
          {availableProjects.map((project) => (
            <label key={project._id}>
              <input
                type="checkbox"
                checked={newUser.projects.includes(project._id)}
                onChange={() => handleNewUserProjectToggle(project._id)}
              />
              {project.name}
            </label>
          ))}
        </div>
        <button onClick={handleCreateUser}>Create User</button>
      </div>

      {/* Edit User Form */}
      {editingUser && (
        <div className="user-form">
          <h3>Edit User</h3>
          <input type="text" value={editingUser.username} readOnly />
          <input
            type="password"
            placeholder="New Password"
            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
          />
          <select
            value={editingUser.role}
            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <div className="project-assignment-box">
            <h4>Assign Projects</h4>
            {availableProjects.map((project) => (
              <label key={project._id}>
                <input
                  type="checkbox"
                  checked={editingUser.projects.includes(project._id)}
                  onChange={() => handleEditUserProjectToggle(project._id)}
                />
                {project.name}
              </label>
            ))}
          </div>
          <button onClick={handleUpdateUser}>Update User</button>
          <button onClick={() => setEditingUser(null)}>Cancel</button>
        </div>
      )}

      {/* Users List */}
      <h3>Existing Users</h3>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Projects</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td>
                {user.projects && user.projects.length > 0
                  ? user.projects.map(project => project.name).join(', ')
                  : 'None'}
              </td>
              <td>
                <button onClick={() => handleEditUser(user)}>Edit</button>
                <button onClick={() => handleDeleteUser(user._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagement;




//TODO: use bootstrap checkbox and radio button groups for projects

//TODO: Change password optional, only role change should be possible => is already the case, but maybe it would be clearer if the password box would be displayed with clicking an extra "change password" button
