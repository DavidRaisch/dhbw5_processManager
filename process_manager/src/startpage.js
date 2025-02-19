// StartPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSettings, FiPlayCircle, FiUsers, FiLogOut, FiBell } from 'react-icons/fi';
import { Person } from 'react-bootstrap-icons'; 
import axios from 'axios';
import './startPage.css'; // Contains our custom styles

function StartPage() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem('user'));
  const [notifications, setNotifications] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  // Fetch full user details to extract project names
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${currentUser._id}`);
        const userDetails = response.data;
        if (userDetails.projects && Array.isArray(userDetails.projects)) {
          const names = userDetails.projects.map(proj => proj.name);
          console.log("Fetched user project names:", names);
          setUserProjects(names);
        } else {
          console.log("No projects found in user record");
        }
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };
    fetchUserDetails();
  }, [currentUser._id]);

  // Fetch notifications whenever the userProjects or role changes
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Build a comma-separated string of project names.
        const projectQuery = userProjects.length > 0 ? userProjects.join(',') : '';
        console.log("Fetching notifications with parameters:", {
          targetRole: currentUser.role,
          projectNames: projectQuery
        });
        const notifResponse = await axios.get('http://localhost:5001/api/notifications', {
          params: { targetRole: currentUser.role, projectNames: projectQuery },
        });
        console.log("Fetched notifications:", notifResponse.data);
        setNotifications(notifResponse.data);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, [userProjects, currentUser.role]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div
      className="container-fluid d-flex flex-column align-items-center min-vh-100 p-4"
      style={{ background: 'linear-gradient(135deg, #f5f7fa, #c3cfe2)' }}
    >
      {/* User Dropdown for Badge and Details */}
      {currentUser && (
        <div className="dropdown position-absolute top-0 start-0 m-3">
          <button
            className="btn dropdown-toggle user-role-badge"
            type="button"
            id="userDropdown"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <Person size={20} className="me-2" />
            <span>{currentUser.username}</span>
          </button>
          <ul className="dropdown-menu" aria-labelledby="userDropdown">
            <li className="dropdown-item-text" style={{ whiteSpace: 'normal' }}>
              <strong>Benutzername:</strong> {currentUser.username}
            </li>
            <li className="dropdown-item-text">
              <strong>Role:</strong> {currentUser.role}
            </li>
            <li className="dropdown-item-text" style={{ whiteSpace: 'normal' }}>
              <strong>Projects:</strong> {userProjects.length > 0 ? userProjects.join(', ') : 'None'}
            </li>
            <li>
              <hr className="dropdown-divider" />
            </li>
            <li>
              <button className="dropdown-item logout-btn" onClick={handleLogout}>
                <FiLogOut size={16} className="me-2" />
                Logout
              </button>
            </li>
          </ul>
        </div>
      )}

      <h1 className="mt-5 text-dark">Process Manager</h1>

      <div className="row mt-4 justify-content-center w-100">
        {(currentUser?.role === 'Employee' || currentUser?.role === 'Manager') && (
          <>
            <div className="col-md-4 col-12 mb-3">
              <button
                onClick={() => navigate('/manage-process')}
                className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center"
              >
                <FiSettings size={40} className="me-2" />
                Manage Process
              </button>
            </div>
            <div className="col-md-4 col-12 mb-3">
              <button
                onClick={() => navigate('/execute-process')}
                className="btn btn-info btn-lg w-100 d-flex align-items-center justify-content-center"
              >
                <FiPlayCircle size={40} className="me-2" />
                Execute Process
              </button>
            </div>
          </>
        )}

        {currentUser?.role === 'Admin' && (
          <>
            <div className="col-md-4 col-12 mb-3">
              <button
                onClick={() => navigate('/manage-users')}
                className="btn btn-warning btn-lg w-100 d-flex align-items-center justify-content-center"
              >
                <FiUsers size={40} className="me-2" />
                Manage Users
              </button>
            </div>
            <div className="col-md-4 col-12 mb-3">
              <button
                onClick={() => navigate('/manage-projects')}
                className="btn btn-secondary btn-lg w-100 d-flex align-items-center justify-content-center"
              >
                <FiSettings size={40} className="me-2" />
                Manage Projects
              </button>
            </div>
          </>
        )}
      </div>

      {/* Notifications Button using Bootstrap */}
      <button
        className="btn btn-outline-danger position-fixed top-0 end-0 m-3"
        onClick={() => navigate('/notifications')}
      >
        <FiBell size={20} />
        {notifications.length > 0 && (
          <span className="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle">
            {notifications.length}
          </span>
        )}
      </button>
    </div>
  );
}

export default StartPage;










//TODO: make user details always in the next line


/** Additional Add-Ons */
//TODO: get a custom password change site for only the individual user also in the dropdown menu

