import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { Person, House, Gear, PlayCircle, Bell, Users, PersonFillGear } from 'react-bootstrap-icons';
import axios from 'axios';
import './navBar.css';

function TopNavBar({ currentPage, minimal }) {
  const navigate = useNavigate();
  const storedUser = sessionStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;
  // Determine whether to render the minimal version
  const isMinimal = minimal || !user;

  // Only set up these states/effects if we're not in minimal mode.
  const [notifications, setNotifications] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  useEffect(() => {
    if (!isMinimal) {
      axios
        .get(`http://localhost:5001/api/users/${user._id}`)
        .then((response) => {
          const userDetails = response.data;
          if (userDetails.projects && Array.isArray(userDetails.projects)) {
            const names = userDetails.projects.map((proj) => proj.name);
            setUserProjects(names);
          }
        })
        .catch((err) => console.error('Error fetching user details:', err));
    }
  }, [isMinimal, user]);

  useEffect(() => {
    if (!isMinimal) {
      const projectQuery = userProjects.length > 0 ? userProjects.join(',') : '';
      axios
        .get('http://localhost:5001/api/notifications', {
          params: { targetRole: user.role, projectNames: projectQuery },
        })
        .then((response) => setNotifications(response.data))
        .catch((err) => console.error('Error fetching notifications:', err));
    }
  }, [isMinimal, userProjects, user]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

    // Helper to determine active nav item styling
    const isActive = (page) => currentPage === page ? 'active' : '';

  return (
    <nav className="navbar navbar-expand-lg navbar-dark top-nav-red fixed-top mb-3">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">{'ZenithFlow'}</a>
        {!isMinimal && (
          <>
            <div className="collapse navbar-collapse">
              <ul className="nav nav-pills ms-auto">
                {user.role === 'Admin' ? (
                  <>
                     <li className="nav-item">
                      <button
                        onClick={() => navigate('/start')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Home')}`}
                      >
                        <House size={20} className="me-1" />
                        Home
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        onClick={() => navigate('/manage-users')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Manage Users')}`}
                      >
                        <PersonFillGear size={20} className="me-1" />
                        Manage Users
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        onClick={() => navigate('/manage-projects')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Manage Projects')}`}
                      >
                        <Gear size={20} className="me-1" />
                        Manage Projects
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="nav-item">
                      <button
                        onClick={() => navigate('/start')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Home')}`}
                      >
                        <House size={20} className="me-1" />
                        Home
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        onClick={() => navigate('/manage-process')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Manage Process')}`}
                      >
                        <Gear size={20} className="me-1" />
                        Manage Process
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        onClick={() => navigate('/execute-process')}
                        type="button"
                        className={`nav-link text-light 
                          ${isActive('Execute Process')}`}
                      >
                        <PlayCircle size={20} className="me-1" />
                        Execute Process
                      </button>
                    </li>
                  </>
                )}
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
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={handleLogout}>
                      <FiLogOut size={16} className="me-2" />
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

export default TopNavBar;

