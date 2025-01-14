import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function StartPage() {
  const navigate = useNavigate();

  return (
    <div className="start-page">
      <h1>Process Manager</h1>
      <div className="button-container">
        <button onClick={() => navigate('/create-process')} className="button create">
          Create Process
        </button>
        <button onClick={() => navigate('/edit-process')} className="button edit">
          Edit Process
        </button>
        <button onClick={() => navigate('/execute-process')} className="button execute">
          Execute Process
        </button>
      </div>
    </div>
  );
}

export default StartPage;
