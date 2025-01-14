import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './startpage.js';
import CreateProcess from './createProcess.js';
import EditProcess from './editProcess.js';
import ExecuteProcess from './executeProcess.js';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/create-process" element={<CreateProcess />} />
        <Route path="/edit-process" element={<EditProcess />} />
        <Route path="/execute-process" element={<ExecuteProcess />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
