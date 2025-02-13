// StartPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './startPage.css';
import { 
  FiSettings, 
  FiPlayCircle, 
  FiUsers, 
  FiLogOut 
} from 'react-icons/fi';

function StartPage() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user'));

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="start-page">
      {user && (
        <div className="user-role-badge">
          <span>{user.username}</span>
        </div>
      )}
      
      <button 
        className="logout-button"
        onClick={handleLogout}
        aria-label="Logout"
      >
        <FiLogOut size={16} />
        Logout
      </button>

      <h1 className="page-title">Process Manager</h1>

      <div className="button-container">
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
        
        {user?.role === 'Admin' && (
          <button 
            onClick={() => navigate('/manage-users')} 
            className="action-button manage-users"
          >
            <FiUsers size={20} />
            Manage Users
          </button>
        )}
      </div>
    </div>
  );
}

export default StartPage;





/** Additional Add-Ons */
//TODO: get role of user as a dropdown in the top left corner
//TODO: get a custom password change site for only the individual user also in the dropdown menu
//TODO: admin only user managment, no process rights, except if it is possible to get two roles