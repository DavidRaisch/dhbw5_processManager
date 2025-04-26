import React from 'react';
import TopNavBar from './navBar';
import './startPage.css';

function StartPage() {
  const currentUser = JSON.parse(sessionStorage.getItem('user'));
  const welcomeMessage = currentUser ? `Welcome, ${currentUser.username}!` : "Welcome!";

  return (
    <div className="start-page-container" style={{ minHeight: '100vh'}}>
      {/* The TopNavBar now serves as the main navigation */}
      <TopNavBar currentPage="Home" />
      <div className="container welcome-content d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <h1 className="text-dark">{welcomeMessage}</h1>
        <p className="lead text-dark">Select an option from the navigation bar above to begin.</p>
      </div>
    </div>
  );
}

export default StartPage;


//TODO: admin start page add padding-top


