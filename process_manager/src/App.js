import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './startpage.js';
import ManageProcess from './manageProcess.js';
import ExecuteProcess from './executeProcess.js';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/manage-process" element={<ManageProcess />} />
        <Route path="/execute-process" element={<ExecuteProcess />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;



