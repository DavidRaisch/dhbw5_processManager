import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TopNavBar from './navBar';
import './changePassword.css';

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    // You may add additional validations here (e.g. minimum length)

    try {
      const response = await axios.put(
        `http://localhost:5001/api/users/${user._id}/changePassword`,
        { currentPassword, newPassword }
      );
      setSuccess(response.data.message);
      // Optionally, you could log the user out or update the session here
    } catch (err) {
      setError(err.response?.data.error || 'Error updating password');
    }
  };

  return (
    <>
      <TopNavBar currentPage="Change Password" />
      <div className="container change-password-container">
        <h2 className="mb-4 text-center">Change Password</h2>
        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="form-group mb-3">
            <label>Current Password</label>
            <input
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group mb-3">
            <label>New Password</label>
            <input
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group mb-3">
            <label>Confirm New Password</label>
            <input
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <button type="submit" className="btn btn-primary">Set new Password</button>
        </form>
        <button className="btn btn-secondary mt-3" onClick={() => navigate(-1)}>Back</button>
      </div>
    </>
  );
}

export default ChangePassword;
