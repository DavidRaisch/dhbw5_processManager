import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'react-bootstrap-icons';
import axios from 'axios';
import './notificationPage.css';
import TopNavBar from './navBar';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [userProjects, setUserProjects] = useState([]); // Array of project names
  const navigate = useNavigate();
  
  // currentUser from sessionStorage (this may only include _id, username, and role)
  const currentUser = JSON.parse(sessionStorage.getItem('user'));

  // Fetch full user details (with projects) on mount
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${currentUser._id}`);
        const userDetails = response.data;
        if (userDetails.projects && Array.isArray(userDetails.projects)) {
          // Extract the project names from the populated projects
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

  // Once userProjects is fetched, load notifications.
  useEffect(() => {
    fetchNotifications();
  }, [userProjects]);

  const fetchNotifications = async () => {
    try {
      // Build a comma-separated string of project names.
      const projectQuery = userProjects.length > 0 ? userProjects.join(',') : '';
      console.log("Fetching notifications with parameters:", {
        targetRole: currentUser.role,
        projectNames: projectQuery
      });
      
      // Retrieve notifications filtered by role and project names.
      const response = await axios.get('http://localhost:5001/api/notifications', {
        params: { targetRole: currentUser.role, projectNames: projectQuery },
      });
      console.log("Fetched notifications:", response.data);
      setNotifications(response.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // When a notification is clicked, navigate appropriately.
  const handleNotificationClick = (notif) => {
    // If the notification message indicates a new process was created,
    // navigate to the Manage Process page and pass the process ID.
    if (notif.message.toLowerCase().includes('created a new process')) {
      navigate('/manage-process', { state: { processId: notif.instanceId } });
    } else {
      // Otherwise, navigate to the Execute Process page as before.
      navigate('/execute-process', { state: { instanceId: notif.instanceId } });
    }
  };

  // Approve a notification.
  const approveNotification = async (notif) => {
    try {
      // Extract instance name from the notification message using regex.
      // Assumes the message is in the format: ... instance "InstanceName"
      const regex = /instance "([^"]+)"/;
      const match = notif.message.match(regex);
      const instanceName = match ? match[1] : 'this instance';
      
      const updates = {
        targetRole: 'Employee',
        status: 'approved',
        message: `Your approval request for instance "${instanceName}" has been approved.`,
      };

      await axios.put(`http://localhost:5001/api/notifications/${notif._id}`, updates);
      setNotifications(prev => prev.filter(n => n._id !== notif._id));
    } catch (err) {
      console.error('Error updating notification:', err.response?.data || err);
      alert('Error updating notification');
    }
  };

  // Delete a notification.
  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`http://localhost:5001/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      alert('Error deleting notification');
    }
  };

  return (
    <>
    <TopNavBar currentPage="Archived Instances" />
    <div className="notifications-page" style={{ padding: '20px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '10px' }}>
        <ArrowLeft size={16} /> Back
      </button>
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <p>No notifications</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {notifications.map((notif) => (
            <li
              key={notif._id}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '5px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div onClick={() => handleNotificationClick(notif)}>
                <p>{notif.message}</p>
                <small>{new Date(notif.timestamp).toLocaleString()}</small>
                {notif.project && (
                  <small style={{ display: 'block', fontStyle: 'italic' }}>
                    Project: {notif.project.name}
                  </small>
                )}
              </div>
              <div>
                {currentUser.role === 'Manager' && notif.status === 'pending' && !notif.message.toLowerCase().includes('created a new process') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveNotification(notif);
                    }}
                    style={{ marginRight: '5px' }}
                  >
                    Accept
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif._id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notifications.length > 0 && (
        <button
          onClick={() => {
            notifications.forEach((notif) => {
              deleteNotification(notif._id);
            });
          }}
          style={{ marginTop: '10px' }}
        >
          Clear All Notifications
        </button>
      )}
    </div>
    </>
  );
}

export default Notifications;



//TODO: bundle.js:120777 
            
            
//GET http://localhost:5001/api/notifications?targetRole=Manager&projectNames=Engineering,Software net::ERR_INSUFFICIENT_RESOURCES


//Resolve this problem




