import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoxArrowInRight } from 'react-bootstrap-icons';
import axios from 'axios';
import TopNavBar from './navBar';
import './loginPage.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // On mount, clear any stored session data
  useEffect(() => {
    sessionStorage.removeItem('user');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/api/login', { username, password });
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/start');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    }
  };

  return (
    <>
      <TopNavBar minimal={true} currentPage="Process Manager" />
      <div className="login-page">
        <div className="login-card">
          <h2 className="text-center mb-4">Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            
            <button type="submit" className="btn btn-primary w-100"> <BoxArrowInRight size={20} className="me-1" />Login</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default LoginPage;



/** Additional Add-Ons */
//TODO: OPTIONAL: user should be able to have multiple roles (for example admin and manager)