import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Filter, ArrowLeft} from 'react-bootstrap-icons';
import TopNavBar from './navBar';
import './archivedInstances.css';

function ArchivedInstancesPage() {
  const navigate = useNavigate();
  const [archivedInstances, setArchivedInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);

  // Filter input states
  const [projectFilter, setProjectFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [completedFromFilter, setCompletedFromFilter] = useState("");
  const [completedToFilter, setCompletedToFilter] = useState("");

  // State for applied filters (only updated on Apply Filters click)
  const [appliedFilters, setAppliedFilters] = useState({
    project: "",
    process: "",
    status: "",
    creation: { from: "", to: "" },
    completion: { from: "", to: "" }
  });

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

  // Compute filter count based on applied filters.
  // Date ranges count as one filter each if either start or end is set.
  const creationDateApplied = appliedFilters.creation.from !== "" || appliedFilters.creation.to !== "";
  const completionDateApplied = appliedFilters.completion.from !== "" || appliedFilters.completion.to !== "";
  const otherFilters = [appliedFilters.project, appliedFilters.process, appliedFilters.status]
    .filter(filter => filter !== "").length;
  const filterCount = otherFilters + (creationDateApplied ? 1 : 0) + (completionDateApplied ? 1 : 0);

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

  // Apply filters and update appliedFilters state.
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

    // Update the applied filters state
    setAppliedFilters({
      project: projectFilter,
      process: processFilter,
      status: statusFilter,
      creation: { from: dateFromFilter, to: dateToFilter },
      completion: { from: completedFromFilter, to: completedToFilter }
    });
  };

  // Clear all filters and reset appliedFilters state
  const clearFilters = () => {
    setProjectFilter("");
    setProcessFilter("");
    setStatusFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setCompletedFromFilter("");
    setCompletedToFilter("");
    setAppliedFilters({
      project: "",
      process: "",
      status: "",
      creation: { from: "", to: "" },
      completion: { from: "", to: "" }
    });
    const sortedArchived = [...archivedInstances].sort(
      (a, b) => new Date(b.created) - new Date(a.created)
    );
    setFilteredInstances(sortedArchived);
  };

  const closeModal = () => {
    setSelectedInstance(null);
  };

  return (
    <>
      <TopNavBar currentPage="Archived Instances" />
      <div className="container-fluid" style={{ minHeight: '100vh' }}>
        {/* Page Header Card */}
        <div className="header-card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Archived Instances</h5>
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} /> Back
            </button>
          </div>
        </div>

        {/* Combined Instance List & Filter Card */}
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Instance List</h5>
            <button 
              className={`filter-dropdown position-relative d-flex align-items-center justify-content-center btn ${showFilters ? 'btn-secondary' : 'btn-outline-secondary'}`} 
              onClick={() => setShowFilters(prev => !prev)}
            >
              <Filter size={20} />
              {filterCount > 0 && (
                <span className="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle">
                  {filterCount}
                </span>
              )}
            </button>
          </div>
          {showFilters && (
            <div className="card-body">
              {/* First row: Dropdown Filters */}
              <div className="row align-items-end g-3 mb-3">
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
              </div>

              {/* Second row: Date Filters */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Creation Date from/to</label>
                  <div className="d-flex">
                    <input
                      type="date"
                      className="form-control me-2"
                      value={dateFromFilter}
                      onChange={(e) => setDateFromFilter(e.target.value)}
                    />
                    <input
                      type="date"
                      className="form-control"
                      value={dateToFilter}
                      onChange={(e) => setDateToFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Completion Date from/to</label>
                  <div className="d-flex">
                    <input
                      type="date"
                      className="form-control me-2"
                      value={completedFromFilter}
                      onChange={(e) => setCompletedFromFilter(e.target.value)}
                    />
                    <input
                      type="date"
                      className="form-control"
                      value={completedToFilter}
                      onChange={(e) => setCompletedToFilter(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Third row: Action Buttons */}
              <div className="row">
                <div className="col-auto">
                  <button className="btn btn-primary me-2" onClick={applyFilters}>
                    Apply Filters
                  </button>
                  <button className="btn btn-outline-secondary" onClick={clearFilters}>
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
          {showFilters && <hr className="m-0" />}
          <div className="card-body">
            {filteredInstances.length > 0 ? (
              <ul className="list-group list-group-flush">
                {filteredInstances.map(inst => (
                  <li
                    key={inst._id}
                    className="list-group-item list-group-item-action"
                    onClick={() => setSelectedInstance(inst)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="fw-semibold">{inst.instanceName}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No archived instances found with current filters.</p>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {selectedInstance && (
          <>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{selectedInstance.instanceName}</h5>
                    <button type="button" className="btn btn-close" onClick={closeModal}></button>
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
    </>
  );
}

export default ArchivedInstancesPage;

