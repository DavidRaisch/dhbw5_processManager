import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './archivedInstances.css';

function ArchivedInstancesPage() {
  const navigate = useNavigate();
  const [archivedInstances, setArchivedInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);

  // Filter states
  const [projectFilter, setProjectFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  // "Created Date To" defaults to today to keep newest on top
  const [dateToFilter, setDateToFilter] = useState("");
  const [completedFromFilter, setCompletedFromFilter] = useState("");
  const [completedToFilter, setCompletedToFilter] = useState("");

  // For toggling filter display
  const [showFilters, setShowFilters] = useState(false);
  // For modal instance details
  const [selectedInstance, setSelectedInstance] = useState(null);

  // For available projects and processes (for dropdown options)
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableProcesses, setAvailableProcesses] = useState([]);

  // Build a lookup map for project id to project name.
  const projectMap = availableProjects.reduce((acc, project) => {
    acc[project._id] = project.name;
    return acc;
  }, {});

  // Fetch archived instances (non-running) on mount
  useEffect(() => {
    const fetchArchivedInstances = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/instances');
        const allInstances = response.data;
        const archived = allInstances.filter(inst => inst.status !== 'running');
        setArchivedInstances(archived);
      } catch (err) {
        console.error('Error fetching archived instances:', err);
      }
    };
    fetchArchivedInstances();
  }, []);

  // Fetch available projects for the dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/projects');
        setAvailableProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch available processes for the dropdown
  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/processes');
        setAvailableProcesses(response.data);
      } catch (err) {
        console.error('Error fetching processes:', err);
      }
    };
    fetchProcesses();
  }, []);

  // On load or whenever archivedInstances change, sort by newest on top.
  useEffect(() => {
    const sortedArchived = [...archivedInstances].sort(
      (a, b) => new Date(b.created) - new Date(a.created)
    );
    setFilteredInstances(sortedArchived);
  }, [archivedInstances]);

  // Apply filters and sort (newest on top)
  const applyFilters = () => {
    let filtered = [...archivedInstances];

    if (projectFilter) {
      filtered = filtered.filter(inst => {
        const projName = typeof inst.project === 'object'
          ? inst.project.name
          : projectMap[inst.project] || "";
        return projName.toLowerCase() === projectFilter.toLowerCase();
      });
    }
    if (processFilter) {
      filtered = filtered.filter(inst =>
        (inst.processName || "").toLowerCase() === processFilter.toLowerCase()
      );
    }
    if (statusFilter) {
      filtered = filtered.filter(inst =>
        (inst.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }
    if (dateFromFilter) {
      const dateFrom = new Date(dateFromFilter);
      filtered = filtered.filter(inst => new Date(inst.created) >= dateFrom);
    }
    if (dateToFilter) {
      const dateTo = new Date(dateToFilter);
      filtered = filtered.filter(inst => new Date(inst.created) <= dateTo);
    }
    if (completedFromFilter) {
      const compFrom = new Date(completedFromFilter);
      filtered = filtered.filter(inst =>
        inst.completedAt && new Date(inst.completedAt) >= compFrom
      );
    }
    if (completedToFilter) {
      const compTo = new Date(completedToFilter);
      filtered = filtered.filter(inst =>
        inst.completedAt && new Date(inst.completedAt) <= compTo
      );
    }

    filtered.sort((a, b) => new Date(b.created) - new Date(a.created));
    setFilteredInstances(filtered);
  };

  // Clear all filters except "Created Date To" (to maintain newest on top)
  const clearFilters = () => {
    setProjectFilter("");
    setProcessFilter("");
    setStatusFilter("");
    setDateFromFilter("");
    setCompletedFromFilter("");
    setCompletedToFilter("");
    const sortedArchived = [...archivedInstances].sort(
      (a, b) => new Date(b.created) - new Date(a.created)
    );
    setFilteredInstances(sortedArchived);
  };

  const closeModal = () => {
    setSelectedInstance(null);
  };

  return (
    <div className="archived-instances-container container-fluid">
      <div className="header d-flex justify-content-between align-items-center my-3">
        <h2>Archived Instances</h2>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      <div className="filter-section mb-3">
        <div
          className="filter-header d-flex align-items-center"
          onClick={() => setShowFilters(prev => !prev)}
          style={{ cursor: 'pointer' }}
        >
          <h4 className="me-2">Filter</h4>
          <span className="toggle-icon">{showFilters ? "▲" : "▼"}</span>
        </div>
        {showFilters && (
          <div className="row align-items-end g-3">
            {/* Project Dropdown */}
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Project:</label>
              <div className="dropdown">
                <button
                  className="form-control dropdown-toggle custom-dropdown"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  {projectFilter || 'All Projects'}
                </button>
                <ul className="dropdown-menu w-100">
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setProjectFilter("")}
                    >
                      All Projects
                    </button>
                  </li>
                  {availableProjects.map(project => (
                    <li key={project._id}>
                      <button
                        className="dropdown-item"
                        onClick={() => setProjectFilter(project.name)}
                      >
                        {project.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Process Dropdown */}
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Process:</label>
              <div className="dropdown">
                <button
                  className="form-control dropdown-toggle custom-dropdown"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  {processFilter || 'All Processes'}
                </button>
                <ul className="dropdown-menu w-100">
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setProcessFilter("")}
                    >
                      All Processes
                    </button>
                  </li>
                  {availableProcesses.map(process => (
                    <li key={process._id}>
                      <button
                        className="dropdown-item"
                        onClick={() => setProcessFilter(process.name)}
                      >
                        {process.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Status Dropdown */}
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Status:</label>
              <div className="dropdown">
                <button
                  className="form-control dropdown-toggle custom-dropdown"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  {statusFilter
                    ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
                    : 'All Statuses'}
                </button>
                <ul className="dropdown-menu w-100">
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setStatusFilter("")}
                    >
                      All Statuses
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setStatusFilter("finished")}
                    >
                      Finished
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item"
                      onClick={() => setStatusFilter("canceled")}
                    >
                      Canceled
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Created Date From:</label>
              <input
                type="date"
                className="form-control"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Created Date To:</label>
              <input
                type="date"
                className="form-control"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Completed Date From:</label>
              <input
                type="date"
                className="form-control"
                value={completedFromFilter}
                onChange={(e) => setCompletedFromFilter(e.target.value)}
              />
            </div>
            <div className="col" style={{ minWidth: '150px' }}>
              <label className="form-label">Completed Date To:</label>
              <input
                type="date"
                className="form-control"
                value={completedToFilter}
                onChange={(e) => setCompletedToFilter(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <button className="btn btn-primary me-2" onClick={applyFilters}>
                Apply Filters
              </button>
              <button className="btn btn-outline-secondary" onClick={clearFilters}>
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instance List – styled as Bootstrap list-group items */}
      <ul className="list-group">
        {filteredInstances.length > 0 ? (
          filteredInstances.map(inst => (
            <li
              key={inst._id}
              className="list-group-item list-group-item-action instance-item"
              onClick={() => setSelectedInstance(inst)}
            >
              <div className="fw-semibold">{inst.instanceName}</div>
            </li>
          ))
        ) : (
          <li className="list-group-item">
            No archived instances found with current filters.
          </li>
        )}
      </ul>

      {/* Details Modal (not fullscreen) */}
      {selectedInstance && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{selectedInstance.instanceName}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <div className="modal-body">
                  <p><strong>Process:</strong> {selectedInstance.processName}</p>
                  <p>
                    <strong>Project:</strong>{" "}
                    {typeof selectedInstance.project === 'object'
                      ? selectedInstance.project.name
                      : projectMap[selectedInstance.project] || 'No Project'}
                  </p>
                  <p><strong>Status:</strong> {selectedInstance.status}</p>
                  <p>
                    <strong>Created:</strong> {new Date(selectedInstance.created).toLocaleString()}
                  </p>
                  {selectedInstance.completedAt && (
                    <p>
                      <strong>Completed:</strong> {new Date(selectedInstance.completedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
}

export default ArchivedInstancesPage;











//TODO: inlcude nav bar similiar design at the top

