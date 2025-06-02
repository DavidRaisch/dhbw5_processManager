// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './loginPage';
import StartPage from './startpage';
import ManageProcess from './manageProcess';
import ExecuteProcess from './executeProcess';
import UserManagement from './userManagement';
import ProjectManagement from './projectManagement'; 
import PrivateRoute from './privateRoute';
import Notifications from './notificationPage';
import ChangePassword from './changePassword';
import ArchivedInstancesPage from './archivedInstances';

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
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />
        {/* New route for project creation/management */}
        <Route
          path="/manage-projects"
          element={
            <PrivateRoute>
              <ProjectManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <PrivateRoute>
              <ChangePassword />
            </PrivateRoute>
          }
        />
        <Route
          path="/archived-instances"
          element={
            <PrivateRoute>
              <ArchivedInstancesPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

