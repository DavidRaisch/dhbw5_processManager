import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { customExtension } from './customExtension';
import customRules from './customRules'; // our custom rules module
import TopNavBar from './navBar';
import './manageProcess.css';

function ManageProcess() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Component states.
  const [processName, setProcessName] = useState('');
  const [processList, setProcessList] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  // New state to hold user projects.
  const [userProjects, setUserProjects] = useState([]);
  
  // State for delete confirmation modal.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  
  // State for generic alert modal.
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  const bpmnModeler = useRef(null);
  const bpmnEditorRef = useRef(null);
  
  // Get logged in user from sessionStorage.
  const user = JSON.parse(sessionStorage.getItem('user'));
  const roleOptions = ['Admin', 'Manager', 'Employee'];
  
  // Helper function to trigger an alert modal.
  const triggerAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertModal(true);
  };
  
  // Fetch full user details (including projects) after mount.
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${user._id}`);
        // Save full projects objects in userProjects state.
        setUserProjects(response.data.projects || []);
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };
    fetchUserDetails();
  }, [user._id]);
  
  // Initialize BPMN modeler and fetch processes & available projects.
  useEffect(() => {
    bpmnModeler.current = new BpmnModeler({
      container: bpmnEditorRef.current,
      additionalModules: [customRules],
      moddleExtensions: {
        role: customExtension
      }
    });
  
    bpmnModeler.current.createDiagram().catch(console.error);
  
    // When an element is clicked, update selected element and load its role/description.
    bpmnModeler.current.on('element.click', (event) => {
      const element = event.element;
      setSelectedElement(element);
      const businessObject = element.businessObject;
      const loadedRole = businessObject['role:role'] || businessObject.role || '';
      setRole(loadedRole);
      setDescription(businessObject.description || '');
    });
  
    // Only fetch processes after userProjects is loaded.
    // We also fetch available projects.
    fetchAvailableProjects();
    
    return () => {
      bpmnModeler.current.destroy();
    };
  }, []);
  
  // Whenever userProjects or processes are updated, fetch processes so filtering can take place.
  useEffect(() => {
    if (userProjects.length > 0) {
      fetchProcesses();
    }
  }, [userProjects]);
  
  useEffect(() => {
    if (selectedElement) {
      const modeling = bpmnModeler.current.get('modeling');
      const elementRegistry = bpmnModeler.current.get('elementRegistry');
      const element = elementRegistry.get(selectedElement.id);
      modeling.updateProperties(element, { role, description });
    }
  }, [role, description, selectedElement]);
  
  // Update fetchProcesses to filter saved processes by user's projects.
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      
      // Debug: log userProjects for verification.
      console.log("User projects:", userProjects);
      
      const filteredProcesses = response.data.filter(proc => {
        if (!proc.project) return false;
        // Extract the process project id, handling object or string.
        const procProjectId = typeof proc.project === 'object' && proc.project !== null 
          ? proc.project._id 
          : proc.project;
        // Check if this process's project id is in the user's projects.
        const isMatch = userProjects.some(p => p._id === procProjectId);
        console.log(`Process "${proc.name}" with project id: ${procProjectId}. Match: ${isMatch}`);
        return isMatch;
      });
      setProcessList(filteredProcesses);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };
  
  const fetchAvailableProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/projects');
      setAvailableProjects(response.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };
  
  // Check if a processId was passed via location.state (from a notification)
  useEffect(() => {
    if (location.state && location.state.processId) {
      const processId = location.state.processId;
      axios.get(`http://localhost:5001/api/processes/${processId}`)
        .then(response => {
          const proc = response.data;
          handleLoadProcess(proc);
          // Clear location state so that reloading doesn't re-load the process.
          navigate(location.pathname, { replace: true });
        })
        .catch(err => console.error("Error loading process from notification:", err));
    }
  }, [location.state, navigate]);
  
  const validateDiagram = () => {
    const elementRegistry = bpmnModeler.current.get('elementRegistry');
    const errors = [];
    elementRegistry.getAll().forEach((element) => {
      const bo = element.businessObject;
      if (bo) {
        if (bo.$type === 'bpmn:SequenceFlow' || bo.$type === 'bpmn:Process') return;
        const roleValue = (bo.role || bo['role:role'] || '').trim();
        if (roleValue === '') errors.push(`${bo.name || element.id} is missing a role.`);
        const descValue = (bo.description || '').trim();
        if (descValue === '') errors.push(`${bo.name || element.id} is missing a description.`);
      }
    });
    return errors;
  };
  
  const handleSaveToDatabase = () => {
    if (!processName) {
      triggerAlert('Missing Process Name', 'Please enter a process name.');
      return;
    }
    if (!selectedProject) {
      triggerAlert('Missing Project', 'Please select a project.');
      return;
    }
    const errors = validateDiagram();
    if (errors.length > 0) {
      triggerAlert('Validation Error', 'The following errors occurred:\n' + errors.join('\n'));
      return;
    }
    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios
        .post('http://localhost:5001/api/processes', { name: processName, xml, project: selectedProject })
        .then((response) => {
          triggerAlert('Success', response.data.message);
          fetchProcesses();
  
          // --- New Notification Logic ---
          // If current user is an employee, send a notification to managers.
          if (user.role === 'Employee') {
            axios.post('http://localhost:5001/api/notifications', {
              message: `Employee ${user.username} created a new process "${processName}".`,
              instanceId: response.data.process ? response.data.process._id : null,
              requestedBy: user.username,
              requestedById: user._id,
              targetRole: 'Manager',
              status: 'pending',
              project: selectedProject
            }).catch(err => {
              console.error('Error sending notification:', err);
            });
          }
          // --- End Notification Logic ---
        })
        .catch((err) => {
          console.error('Error saving process:', err);
          triggerAlert('Error', 'An error occurred while saving the process.');
        });
    });
  };
  
  const handleCreateNewProcess = () => {
    bpmnModeler.current
      .createDiagram()
      .then(() => {
        setProcessName('');
        setSelectedElement(null);
        setRole('');
        setDescription('');
        setSelectedProject('');
      })
      .catch((err) => {
        console.error('Error creating new diagram:', err);
        triggerAlert('Error', 'An error occurred while creating a new process.');
      });
  };
  
  const handleLoadProcess = (process) => {
    bpmnModeler.current
      .importXML(process.xml)
      .then(() => {
        setProcessName(process.name);
        setSelectedElement(null);
        setRole('');
        setDescription('');
        setSelectedProject(process.project ? (typeof process.project === 'object' ? process.project._id : process.project) : '');
      })
      .catch((err) => {
        console.error('Error loading process:', err);
        triggerAlert('Error', 'An error occurred while loading the process.');
      });
  };
  
  const handleDeleteProcess = (id) => {
    axios
      .delete(`http://localhost:5001/api/processes/${id}`)
      .then(() => {
        triggerAlert('Success', 'Process deleted');
        fetchProcesses();
      })
      .catch((err) => {
        console.error('Error deleting process:', err);
        triggerAlert('Error', 'An error occurred while deleting the process.');
      });
  };
  
  const confirmDelete = () => {
    if (processToDelete) {
      handleDeleteProcess(processToDelete);
      setProcessToDelete(null);
    }
    setShowDeleteModal(false);
  };
  
  // Custom function to get the label for the project dropdown.
  const getSelectedProjectLabel = () => {
    if (!selectedProject) return 'Select Project';
    const found = availableProjects.find(proj => proj._id === selectedProject);
    return found ? found.name : 'Select Project';
  };
  
  return (
    <>
      {/* Universal Top Navigation Bar */}
      <TopNavBar currentPage="Manage Process" />
      <div className="container-fluid bg-sidebar-grey" style={{ minHeight: '100vh' }}>
        <div className="row">
          {/* Left Sidebar: Saved Processes */}
          <div className="col-md-3 border-end pe-3 left-sidebar">
            <h5 className="mb-3">Saved Processes</h5>
            <div className="list-group">
              {processList.map((process) => (
                <div key={process._id} className="list-group-item mb-2">
                  <div className="fw-bold">{process.name}</div>
                  <div>
                    <em>{process.project ? process.project.name : 'No Project'}</em>
                  </div>
                  <div className="mt-2">
                    <button onClick={() => handleLoadProcess(process)} className="btn btn-sm btn-primary me-2">
                      Load
                    </button>
                    {user?.role === 'Manager' && (
                      <button
                        onClick={() => { setProcessToDelete(process._id); setShowDeleteModal(true); }}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
  
          {/* Main Content Area */}
          <div className="col-md-9">
            {/* BPMN Editor */}
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0">BPMN Editor</h5>
              </div>
              <div className="card-body p-0">
                <div ref={bpmnEditorRef} className="bpmn-editor-container"></div>
              </div>
            </div>
  
            {/* Process Information */}
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0">Process Information</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Process Name"
                    value={processName}
                    onChange={(e) => setProcessName(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  {/* Custom Bootstrap Dropdown for Project Selection */}
                  <div className="dropdown">
                    <button 
                      className="form-control dropdown-toggle custom-dropdown" 
                      type="button" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false"
                    >
                      {getSelectedProjectLabel()}
                    </button>
                    <ul className="dropdown-menu w-100">
                      {availableProjects.map((project) => (
                        <li key={project._id}>
                          <button className="dropdown-item" onClick={() => setSelectedProject(project._id)}>
                            {project.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={handleSaveToDatabase} className="btn btn-primary me-2">
                    Save to Database
                  </button>
                  <button onClick={handleCreateNewProcess} className="btn btn-secondary">
                    Create New Process
                  </button>
                </div>
              </div>
            </div>
  
            {/* Role & Description Assignment */}
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Assign Role and Description</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  {/* Custom Bootstrap Dropdown for Role Selection */}
                  <div className="dropdown">
                    <button 
                      className="form-control dropdown-toggle custom-dropdown" 
                      type="button" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false"
                    >
                      {role || 'Select Role'}
                    </button>
                    <ul className="dropdown-menu w-100">
                      {roleOptions.map((option, index) => (
                        <li key={index}>
                          <button className="dropdown-item" onClick={() => setRole(option)}>
                            {option}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <strong>Selected Element:</strong>{' '}
                  {selectedElement ? (selectedElement.businessObject.name || selectedElement.id) : 'None'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  
      {/* Delete Confirmation Modal */}
      <div className={`modal fade ${showDeleteModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Delete</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this process?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && <div className="modal-backdrop fade show"></div>}
  
      {/* Generic Alert Modal */}
      <div className={`modal fade ${showAlertModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{alertTitle}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowAlertModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{alertMessage}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowAlertModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAlertModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
}

export default ManageProcess;


//** Additional */
//TODO: OPTIONAL: load xml file to create new process
//TODO: OPTIONAL: option to make process builder full screen
//TODO: OPTIONAL: make description of flows after Gateway requiered


/** Things to clear */
//does flows and process need a role and description? Do role and description have to be mandatory in general?
//should flows after gateways be requiered to be named?

//should the creating a new process be priveliged to some user?
//make creating a process dependable on role of the user: Employer: needs permission from supervisior to create new process; Manager: can simply create a new Process


/** for report */
// delete button isnt visible for employees, they can request the cancelation of active instances, but not the process att all
// delete button asks if manager is sure, he wants to delete the process