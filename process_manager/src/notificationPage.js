import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import axios from 'axios';
import './notificationPage.css';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  
  // Ensure that your login process stores the full user object (including _id) in sessionStorage.
  const currentUser = JSON.parse(sessionStorage.getItem('user'));

  // Fetch notifications from the backend when the component mounts.
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Retrieve notifications filtered by the current user's role.
      const response = await axios.get('http://localhost:5001/api/notifications', {
        params: { targetRole: currentUser.role },
      });
      setNotifications(response.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // When a notification is clicked, navigate to the execute process page.
  const handleNotificationClick = (notif) => {
    navigate('/execute-process', { state: { instanceId: notif.instanceId } });
  };

  // Approve a notification.
  // This function calls the backend PUT endpoint to update the notification.
  // In this example, we set:
  //  - targetRole to "Employee",
  //  - status to "approved",
  //  - message to "Your approval request has been approved."
  // You can adjust these values as needed.
  const approveNotification = async (notificationId) => {
    try {
      const updates = {
        targetRole: 'Employee',
        status: 'approved',
        message: 'Your approval request has been approved.',
      };

      await axios.put(`http://localhost:5001/api/notifications/${notificationId}`, updates);
      
      // Update the UI by removing the updated notification.
      setNotifications((prev) => prev.filter((notif) => notif._id !== notificationId));
    } catch (err) {
      console.error('Error updating notification:', err.response?.data || err);
      alert('Error updating notification');
    }
  };

  // Delete a notification.
  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`http://localhost:5001/api/notifications/${notificationId}`);
      setNotifications((prev) => prev.filter((notif) => notif._id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      alert('Error deleting notification');
    }
  };

  return (
    <div className="notifications-page" style={{ padding: '20px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '10px' }}>
        <FiArrowLeft size={16} /> Back
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
              </div>
              <div>
                {/* Only show the Accept button for pending notifications when the current user is a Manager */}
                {currentUser.role === 'Manager' && notif.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveNotification(notif._id);
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
            // Clear all notifications.
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
  );
}

export default Notifications;





//TODO: notifiaction should filter according to the assigned projects of the user.
//TODO: not only filter by role (manager), but also by projects assigned