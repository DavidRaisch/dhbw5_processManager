// StartPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './startPage.css';
import { FiSettings, FiPlayCircle, FiUsers, FiLogOut, FiBell } from 'react-icons/fi';

function StartPage() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user'));
  const [notifications, setNotifications] = useState([]);

  // Load notifications from localStorage on mount.
  useEffect(() => {
    const storedNotifications = JSON.parse(localStorage.getItem('notifications')) || [];
    setNotifications(storedNotifications);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="start-page">
      {/* User Role Badge */}
      {user && (
        <div className="user-role-badge">
          <span>{user.username}</span>
        </div>
      )}

      {/* Logout Button */}
      <button className="logout-button" onClick={handleLogout} aria-label="Logout">
        <FiLogOut size={16} />
        Logout
      </button>

      <h1 className="page-title">Process Manager</h1>

      {/* Notification Button */}
      <div className="notifications-button-container">
        <button 
          className="notifications-button" 
          onClick={() => navigate('/notifications')}
        >
          <FiBell size={20} />
          Notifications
          {notifications.length > 0 && (
            <span className="notification-count">{notifications.length}</span>
          )}
        </button>
      </div>

      <div className="button-container">
        {/* Show Process Buttons for Employees/Managers */}
        {(user?.role === 'Employee' || user?.role === 'Manager') && (
          <>
            <button 
              onClick={() => navigate('/manage-process')} 
              className="action-button manage"
            >
              <FiSettings size={20} />
              Manage Process
            </button>
            <button 
              onClick={() => navigate('/execute-process')} 
              className="action-button execute"
            >
              <FiPlayCircle size={20} />
              Execute Process
            </button>
          </>
        )}
        
        {/* Show User & Project Management only for Admins */}
        {user?.role === 'Admin' && (
          <>
            <button 
              onClick={() => navigate('/manage-users')} 
              className="action-button manage-users"
            >
              <FiUsers size={20} />
              Manage Users
            </button>
            <button 
              onClick={() => navigate('/manage-projects')} 
              className="action-button manage-projects"
            >
              <FiSettings size={20} />
              Manage Projects
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default StartPage;







/** Additional Add-Ons */
//TODO: get role of user and associated project as a dropdown in the top left corner
//TODO: get a custom password change site for only the individual user also in the dropdown menu
//TODO: admin only user managment, no process rights, except if it is possible to get two roles