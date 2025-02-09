import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function StartPage() {
  const navigate = useNavigate();

  return (
    <div className="start-page">
      <h1>Process Manager</h1>
      <div className="button-container">
        <button onClick={() => navigate('/manage-process')} className="button manage">
          Manage Process
        </button>
        <button onClick={() => navigate('/execute-process')} className="button execute">
          Execute Process
        </button>
      </div>
    </div>
  );
}

export default StartPage;


//TODO: implement a login page, before landing on the starting page, which is also important for role managemnet 
