import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { Person, House, Gear, PlayCircle, Bell } from 'react-bootstrap-icons';
import axios from 'axios';
import './navBar.css';

function TopNavBar({ currentPage }) {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user'));
  const [notifications, setNotifications] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  // Fetch full user details to extract project names
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${user._id}`);
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
  }, [user._id]);

  // Fetch notifications whenever the userProjects or role changes
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Build a comma-separated string of project names.
        const projectQuery = userProjects.length > 0 ? userProjects.join(',') : '';
        console.log("Fetching notifications with parameters:", {
          targetRole: user.role,
          projectNames: projectQuery
        });
        const notifResponse = await axios.get('http://localhost:5001/api/notifications', {
          params: { targetRole: user.role, projectNames: projectQuery },
        });
        console.log("Fetched notifications:", notifResponse.data);
        setNotifications(notifResponse.data);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, [userProjects, user.role]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  // Helper function to determine if a given page is active.
  const isActive = (page) => currentPage === page ? 'active' : '';

  return (
    <nav className="navbar navbar-expand-lg navbar-dark top-nav-red mb-3">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">ZenithFlow</a>
        <div className="collapse navbar-collapse">
          {/* Navigation links rendered as Bootstrap nav-pills */}
          <ul className="nav nav-pills ms-auto">
            <li className="nav-item">
              <button
                onClick={() => navigate('/start')}
                type="button"
                className={`nav-link text-light ${isActive('Home')}`}
              >
                <House size={20} className="me-1" />
                Home
              </button>
            </li>
            <li className="nav-item">
              <button
                onClick={() => navigate('/manage-process')}
                type="button"
                className={`nav-link text-light ${isActive('Manage Process')}`}
              >
                <Gear size={20} className="me-1" />
                Manage Process
              </button>
            </li>
            <li className="nav-item">
              <button
                onClick={() => navigate('/execute-process')}
                type="button"
                className={`nav-link text-light ${isActive('Execute Process')}`}
              >
                <PlayCircle size={20} className="me-1" />
                Execute Process
              </button>
            </li>
          </ul>
        </div>
        <div className="d-flex align-items-center">
          <button
            className="btn btn-outline-light position-relative me-3"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle">
                {notifications.length}
              </span>
            )}
          </button>
          <div className="dropdown">
            <button
              className="btn dropdown-toggle user-role-badge btn-outline-light"
              type="button"
              id="userDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <Person size={20} className="me-2" />
              {user.username}
            </button>
            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
              <li className="dropdown-item-text" style={{ whiteSpace: 'normal' }}>
                <strong>Username:</strong> {user.username}
              </li>
              <li className="dropdown-item-text">
                <strong>Role:</strong> {user.role}
              </li>
              <li className="dropdown-item-text" style={{ whiteSpace: 'normal' }}>
                <strong>Projects:</strong> {userProjects.length > 0 ? userProjects.join(', ') : 'None'}
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  <FiLogOut size={16} className="me-2" />
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNavBar;



//TODO: navBar should always be visible, main page should scroll with navBar static at the top
//TODO: on the left side, the name of the project should be displayed, to identify which side the user is currently on it should label the button of the current page.