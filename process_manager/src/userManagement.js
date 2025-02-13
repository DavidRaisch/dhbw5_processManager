import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './userManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', role: 'Employee', password: '' });
  const [editingUser, setEditingUser] = useState(null);
  const roleOptions = ['Admin', 'Manager', 'Employee'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert('Username and Password are required');
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/users', newUser);
      fetchUsers();
      setNewUser({ username: '', role: 'Employee', password: '' });
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleUpdateUser = async () => {
    if (!editingUser.username) {
      alert('Username is required');
      return;
    }
    try {
      await axios.put(`http://localhost:5001/api/users/${editingUser._id}`, editingUser);
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

  return (
    <div className="user-management">
      <h2>User Management</h2>

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
        <button onClick={handleCreateUser}>Create User</button>
      </div>

      {editingUser && (
        <div className="user-form">
          <h3>Edit User</h3>
          <input
            type="text"
            value={editingUser.username}
            readOnly
          />
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
          <button onClick={handleUpdateUser}>Update User</button>
          <button onClick={() => setEditingUser(null)}>Cancel</button>
        </div>
      )}

      <h3>Existing Users</h3>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.username}</td>
              <td>{user.role}</td>
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


//TODO: User should be able to have multiple project
//TODO: Usermanagment needs to be able to modify the according project of a user
//TODO: Change password optional, only role change should be possible
