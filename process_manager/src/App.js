// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './loginPage';
import StartPage from './startpage';
import ManageProcess from './manageProcess';
import ExecuteProcess from './executeProcess';
import UserManagement from './userManagement';
import PrivateRoute from './privateRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/start"
          element={
            <PrivateRoute>
              <StartPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/manage-users"
          element={
            <PrivateRoute>
              <UserManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/manage-process"
          element={
            <PrivateRoute>
              <ManageProcess />
            </PrivateRoute>
          }
        />
        <Route
          path="/execute-process"
          element={
            <PrivateRoute>
              <ExecuteProcess />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
