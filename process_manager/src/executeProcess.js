import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import './executeProcess.css';
import TopNavBar from './navBar';

function ExecuteProcess() {
  const location = useLocation();
  const navigate = useNavigate();
  const instanceIdFromNotification = location.state?.instanceId;
  const notificationIdFromNotification = location.state?.notificationId;

  // State management
  const [processList, setProcessList] = useState([]);
  const [activeInstances, setActiveInstances] = useState([]);
  const [archivedInstances, setArchivedInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  // Store full project objects for better matching by id.
  const [userProjects, setUserProjects] = useState([]); 
  const [selectedElementDetails, setSelectedElementDetails] = useState(null);
  const [assignedProjectName, setAssignedProjectName] = useState(''); // State for project name
  const [pendingNotificationId, setPendingNotificationId] = useState(null);

  // State for generic alert modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  // BPMN viewer references
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);
  const currentUser = JSON.parse(sessionStorage.getItem('user'));

  // Helper function to trigger an alert modal.
  const triggerAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertModal(true);
  };

  // Clear location state after processing it.
  useEffect(() => {
    const instId = instanceIdFromNotification;
    const notifId = notificationIdFromNotification;
    if (instId || notifId) {
      navigate(location.pathname, { replace: true });
      if (instId) {
        setSelectedInstanceId(instId);
        setSelectedProcess(null);
        setSelectedElementDetails(null);
      }
      if (notifId) {
        setPendingNotificationId(notifId);
      }
    }
  }, [instanceIdFromNotification, notificationIdFromNotification, location.pathname, navigate]);

  // User and project initialization
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${currentUser._id}`);
        const userDetails = response.data;
        // Instead of saving only project names, save full project objects (or at least _id and name)
        if (userDetails.projects && Array.isArray(userDetails.projects)) {
          setUserProjects(userDetails.projects);
        }
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };
    fetchUserDetails();
  }, [currentUser._id]);

  // Process and instance data fetching
  // Wait until both userProjects and processes are available.
  useEffect(() => {
    if (userProjects.length > 0) {
      fetchProcesses();
    } else {
      setProcessList([]);
    }
  }, [userProjects]);

  // Fetch instances only when both processList and userProjects are ready.
  useEffect(() => {
    if (processList.length > 0 && userProjects.length > 0) {
      fetchInstances();
    } else {
      setActiveInstances([]);
    }
  }, [processList, userProjects]);

  // BPMN viewer lifecycle management
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Diagram loading logic
  useEffect(() => {
    const loadDiagram = async () => {
      if ((selectedProcess || selectedInstanceId) && !viewerRef.current) {
        viewerRef.current = new NavigatedViewer({
          container: bpmnContainerRef.current,
          zoomScroll: false,
          moveCanvas: false,
        });
      }
      try {
        if (selectedProcess) {
          await viewerRef.current.importXML(selectedProcess.xml);
          viewerRef.current.get('canvas').zoom('fit-viewport');
        } else if (selectedInstanceId) {
          const instance = [...activeInstances, ...archivedInstances].find(
            (i) => i._id === selectedInstanceId
          );
          if (instance) {
            await viewerRef.current.importXML(instance.xml);
            viewerRef.current.get('canvas').zoom('fit-viewport');
          }
        }
      } catch (error) {
        console.error('Error loading diagram:', error);
      }
    };
    loadDiagram();
  }, [selectedProcess, selectedInstanceId, activeInstances, archivedInstances]);

  // Attach event listener for element clicks on the BPMN diagram
  useEffect(() => {
    if (viewerRef.current) {
      const eventBus = viewerRef.current.get('eventBus');
      eventBus.on('element.click', handleElementClick);
      return () => {
        eventBus.off('element.click', handleElementClick);
      };
    }
  }, [selectedProcess, selectedInstanceId]);

  const handleElementClick = (event) => {
    const element = event.element;
    const details = {
      name: element.businessObject.name || 'Unnamed',
      role: element.businessObject.get('role:role') || 'No role assigned',
      description: element.businessObject.get('role:description') || 'No description'
    };
    setSelectedElementDetails(details);
  };

  // Updated fetchProcesses: now compare project IDs from the process against the userProjects.
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      const filtered = response.data.filter(proc => {
        if (!proc.project) return false;
        // Determine the project id from process.project, whether it's an object or a string.
        const processProjectId = typeof proc.project === 'object' && proc.project !== null 
          ? proc.project._id 
          : proc.project;
        // Check if any user project matches this id.
        return userProjects.some(proj => proj._id === processProjectId);
      });
      setProcessList(filtered);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Updated fetchInstances: now compare instance project id against userProjects.
  const fetchInstances = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/instances');
      
      // Debug log: see what the API returns
      console.log("Fetched instances:", response.data);
      console.log("User projects:", userProjects);

      const active = response.data.filter(inst => {
        if (inst.status !== 'running' || !inst.project) return false;
        
        // If instance.project is an object, extract its _id; otherwise assume it's the project id.
        const instanceProjectId = typeof inst.project === 'object' && inst.project !== null 
          ? inst.project._id 
          : inst.project;
        
        // Debug log each instance's project for verification.
        console.log(`Instance "${inst.instanceName}" has project id:`, instanceProjectId);
        
        // Return true only if one of the user's projects matches this id.
        return userProjects.some(proj => proj._id === instanceProjectId);
      });

      // For archived instances, we filter as before (you can adjust if needed).
      const allowedNames = new Set(processList.map(p => p.name));
      const archived = response.data
        .filter(inst =>
          inst.status !== 'running' && allowedNames.has(inst.processName)
        )
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      console.log("Filtered active instances:", active);
      setActiveInstances(active);
      setArchivedInstances(archived);
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  const updateInstance = async (instanceId, updatedData) => {
    try {
      const response = await axios.put(
        `http://localhost:5001/api/instances/${instanceId}`,
        updatedData
      );
      const updatedInstance = response.data.instance;
      updateInstanceState(updatedInstance);
    } catch (err) {
      console.error('Error updating instance:', err);
    }
  };

  const updateInstanceState = (updatedInstance) => {
    if (updatedInstance.status !== 'running') {
      setActiveInstances(prev => prev.filter(inst => inst._id !== updatedInstance._id));
      setArchivedInstances(prev => [...prev, updatedInstance]);
    } else {
      setActiveInstances(prev => 
        prev.map(inst => (inst._id === updatedInstance._id ? updatedInstance : inst))
      );
    }
  };

  const createNewInstance = async (process, instanceName) => {
    if (!instanceName) {
      triggerAlert("Missing Instance Name", "Please enter an instance name.");
      return;
    }
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
    });
    try {
      const parsedXML = parser.parse(process.xml);
      const flowMap = buildFlowMap(parsedXML);
      const newInstanceData = buildInstanceData(process, instanceName, flowMap);
      const response = await axios.post(
        'http://localhost:5001/api/instances',
        newInstanceData
      );
      handleNewInstanceResponse(response.data.instance, process);
    } catch (err) {
      console.error('Error creating new instance:', err);
    }
  };

  const buildFlowMap = (parsedXML) => {
    const flowMap = {};
    const sequenceFlows = Array.isArray(parsedXML.definitions.process.sequenceFlow)
      ? parsedXML.definitions.process.sequenceFlow
      : [parsedXML.definitions.process.sequenceFlow];
    sequenceFlows.forEach(flow => {
      const source = flow["@_sourceRef"];
      flowMap[source] = flowMap[source] || [];
      flowMap[source].push({
        target: flow["@_targetRef"],
        name: flow["@_name"] || 'Unnamed Flow',
      });
    });
    return flowMap;
  };

  // In instance data, we pass process.project as is (now a full object or string representing the id).
  const buildInstanceData = (process, instanceName, flowMap) => ({
    processId: process._id,
    processName: process.name,
    instanceName,
    xml: process.xml,
    currentElement: null,
    sequenceMap: flowMap,
    gatewayChoices: [],
    position: 'StartEvent_1',
    status: 'running',
    created: new Date(),
    project: process.project
  });

  const handleNewInstanceResponse = async (savedInstance, process) => {
    setActiveInstances(prev => [...prev, savedInstance]);
    setSelectedInstanceId(savedInstance._id);
    setSelectedProcess(null);
    setNewInstanceName("");
    await viewerRef.current.importXML(process.xml);
    viewerRef.current.get('canvas').zoom('fit-viewport');
    updateInstance(savedInstance._id, { 
      currentElement: getElementState('StartEvent_1') 
    });
  };

  const getElementState = (elementId) => {
    const element = viewerRef.current.get('elementRegistry').find(el => el.id === elementId);
    return element ? {
      id: element.id,
      name: element.businessObject.name || 'Unnamed',
      role: element.businessObject.get('role:role') || 'No role assigned',
      description: element.businessObject.get('role:description') || 'No description',
    } : null;
  };

  const handleNextStep = (instanceId) => {
    const instance = activeInstances.find(i => i._id === instanceId);
    if (!instance) return;
    const nextElements = instance.sequenceMap[instance.position] || [];
    if (nextElements.length > 1) {
      updateInstance(instanceId, { gatewayChoices: nextElements });
    } else if (nextElements.length === 1) {
      const newPosition = nextElements[0]?.target;
      updateInstance(instanceId, { 
        position: newPosition, 
        currentElement: getElementState(newPosition), 
        gatewayChoices: [] 
      });
    }
  };

  const handleGatewayChoice = (instanceId, target) => {
    updateInstance(instanceId, { 
      position: target, 
      currentElement: getElementState(target), 
      gatewayChoices: [] 
    });
  };

  const finishProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'finished', completedAt: new Date() });
    handleProcessCompletion(instanceId);
  };

  const cancelProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'canceled', completedAt: new Date()  });
    handleProcessCompletion(instanceId);
  };

  const handleProcessCompletion = (instanceId) => {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
    clearViewer();
  };

  const requestApproval = async () => {
    const requestedById = currentUser._id;
    if (!requestedById) {
      triggerAlert("Missing User ID", "No user id found, please login again.");
      return;
    }
    // Find the process for the selected instance.
    const processOfInstance = processList.find(p => p.name === selectedInstance.processName);
    // Using the project id from the process (which is either an object or string).
    const projectId = processOfInstance?.project?._id || processOfInstance?.project;
    if (!projectId) {
      triggerAlert("Missing Project", "No project assigned to the process.");
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/notifications', {
        message: `User ${currentUser.username} requested approval for instance "${selectedInstance.instanceName}"`,
        instanceId: selectedInstance._id,
        requestedBy: currentUser.username,
        requestedById,
        targetRole: 'Manager',
        status: 'pending',
        project: projectId
      });
      triggerAlert("Success", "Approval request sent to Manager.");
    } catch (err) {
      console.error('Error sending approval request:', err);
      triggerAlert("Error", "Error sending approval request.");
    }
  };

  const requestCancel = async (instanceId) => {
    const requestedById = currentUser._id;
    if (!requestedById) {
      triggerAlert("Missing User ID", "No user id found, please login again.");
      return;
    }
    const processOfInstance = processList.find(p => p.name === selectedInstance.processName);
    const projectId = processOfInstance?.project?._id || processOfInstance?.project;
    if (!projectId) {
      triggerAlert("Missing Project", "No project assigned to the process.");
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/notifications', {
        message: `User ${currentUser.username} requested cancellation of instance "${selectedInstance.instanceName}"`,
        instanceId,
        requestedBy: currentUser.username,
        requestedById,
        targetRole: 'Manager',
        status: 'pending',
        project: projectId
      });
      triggerAlert("Success", "Cancellation request sent to Manager.");
    } catch (err) {
      console.error('Error sending cancellation request:', err);
      triggerAlert("Error", "Error sending cancellation request.");
    }
  };

  const handleClose = () => {
    clearViewer();
    setSelectedInstanceId(null);
    setSelectedProcess(null);
    setSelectedElementDetails(null);
  };

  const clearViewer = () => {
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }
  };

  const selectedInstance = [...activeInstances, ...archivedInstances]
    .find(i => i._id === selectedInstanceId);

  // Fetch project name when selectedInstance changes
  useEffect(() => {
    if (selectedInstance && selectedInstance.project) {
      axios.get(`http://localhost:5001/api/projects/${selectedInstance.project._id || selectedInstance.project}`)
        .then(response => {
          setAssignedProjectName(response.data.name);
        })
        .catch(error => {
          console.error("Error fetching project name:", error);
          setAssignedProjectName("No Project Assigned");
        });
    }
  }, [selectedInstance]);

  const nextElements = selectedInstance?.status === 'running' 
    ? selectedInstance.sequenceMap[selectedInstance.position] || []
    : [];

  // Manager response to instance approval requests
  const respondToInstanceRequest = async (accepted) => {
    if (!pendingNotificationId || !selectedInstance) return;
    try {
      // Remove original notification
      await axios.delete(`http://localhost:5001/api/notifications/${pendingNotificationId}`);
      // Notify employee
      await axios.post('http://localhost:5001/api/notifications', {
        message: accepted
          ? `Request accepted & continued to next step for instance "${selectedInstance.instanceName}".`
          : `Request denied for instance "${selectedInstance.instanceName}".`,
        instanceId: selectedInstance._id,
        requestedBy: currentUser.username,
        requestedById: currentUser._id,
        targetRole: 'Employee',
        status: accepted ? 'approved' : 'dismissed',
        project: selectedInstance.project?._id || selectedInstance.project
      });
      if (accepted) {
        const nextElements = selectedInstance.sequenceMap[selectedInstance.position] || [];
        if (nextElements.length === 0) {
          await finishProcess(selectedInstanceId);
        } else {
          handleNextStep(selectedInstanceId);
        }
      }
      triggerAlert('Success', accepted ? 'Request accepted & moved to next step.' : 'Request denied.');
      // Exit notification mode: revert to normal controls
      setPendingNotificationId(null);
    } catch (err) {
      console.error('Error responding to request:', err);
      triggerAlert('Error', 'Error processing request.');
    }
  };

  return (
    <>
      {/* Universal Top Navigation Bar */}
      <TopNavBar currentPage="Execute Process" />
      <div className="container-fluid bg-sidebar-grey" style={{ minHeight: '100vh'}}>
        <div className="row">
          {/* Left Sidebar */}
          <div className="col-md-3 border-end pe-3 left-sidebar">
            <h5 className="mb-3">Available Processes</h5>
            <ul className="list-group mb-4">
              {processList.map((process) => (
                <li
                  key={process._id}
                  className={`list-group-item list-group-item-action ${selectedProcess?._id === process._id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedProcess(process);
                    setSelectedInstanceId(null);
                    setSelectedElementDetails(null);
                  }}
                >
                  <div className="fw-bold">{process.name}</div>
                  <small className="text-muted">
                    {process.project?.name || 'No Project'}
                  </small>
                </li>
              ))}
            </ul>

            <h5 className="mb-3">Active Instances</h5>
            <ul className="list-group mb-4">
              {activeInstances.map((instance) => (
                <li
                  key={instance._id}
                  className={`list-group-item list-group-item-action ${selectedInstanceId === instance._id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedInstanceId(instance._id);
                    setSelectedProcess(null);
                    setSelectedElementDetails(null);
                  }}
                >
                  <div className="fw-semibold">{instance.instanceName}</div>
                  <small className="text-muted">{instance.processName}</small>
                  <br />
                  <small className="text-muted">{new Date(instance.created).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>

            <h5 className="mb-3"></h5>
            <div>
              <button className="btn btn-secondary w-100" onClick={() => navigate('/archived-instances')}>
                View Archived Instances
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-md-9">
            {/* Process Mode Header */}
            {selectedProcess && (
              <div className="d-flex justify-content-between align-items-center bg-light rounded p-3 mb-3">
                <div className="row g-2 align-items-center flex-grow-1">
                  <div className="col">
                    <input
                      type="text"
                      className="form-control"
                      value={selectedProcess.name}
                      readOnly
                    />
                  </div>
                  <div className="col">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Instance Name"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                    />
                  </div>
                  <div className="col-auto">
                    <button
                      className="btn btn-primary"
                      onClick={() => createNewInstance(selectedProcess, newInstanceName)}
                    >
                      Start Instance
                    </button>
                  </div>
                </div>
                <button className="btn btn-danger ms-2" onClick={handleClose}>
                  Close
                </button>
              </div>
            )}

            {/* No Selection Header */}
            {(!selectedProcess && !selectedInstance) && (
              <div className="d-flex justify-content-between align-items-center bg-light rounded p-3 mb-3">
                <input
                  type="text"
                  className="form-control flex-grow-1"
                  value="Select a process or instance"
                  readOnly
                />
                <button className="btn btn-danger ms-2" onClick={handleClose}>
                  Close
                </button>
              </div>
            )}

            {/* Instance Mode Navigation Window */}
            {selectedInstance && (
              <>
                <div className="card mb-3">
                  <div className="card-header bg-light">
                    <div className="row">
                      <div className="col">
                        <h5 className="mb-0">
                          {selectedInstance.instanceName} <small>({selectedInstance.processName})</small>
                        </h5>
                        <div className="d-flex justify-content-between mt-2">
                          <div>
                            <strong>Status:</strong>{" "}
                            <span className={selectedInstance.status === 'running' ? 'text-success' : 'text-secondary'}>
                              {selectedInstance.status.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <strong>Project:</strong> {assignedProjectName}
                          </div>
                          <div>
                            <strong>Created:</strong> {new Date(selectedInstance.created).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="col-auto">
                        <button type="button" className="btn-close" aria-label="Close" onClick={handleClose}></button>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    {selectedInstance.status !== 'running' ? (
                      <div className="text-center text-muted">
                        <h4>This instance has been {selectedInstance.status}</h4>
                      </div>
                    ) : (
                      <>
                        {selectedInstance.currentElement && (
                          <div className="mb-4 p-3 border rounded">
                            <h5>Current Step: {selectedInstance.currentElement.name}</h5>
                            <div className="row">
                              <div className="col-md-6">
                                <label className="fw-semibold">Assigned Role:</label>
                                <div>{selectedInstance.currentElement.role}</div>
                              </div>
                              <div className="col-md-6">
                                <label className="fw-semibold">Description:</label>
                                <div className="text-muted">{selectedInstance.currentElement.description}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="d-flex flex-column gap-3">
                          {currentUser.role === 'Employee' && selectedInstance.currentElement?.role !== 'Employee' ? (
                            <div className="alert alert-warning text-center" role="alert">
                              <p className="mb-2">You need manager approval to proceed with this step</p>
                              <button onClick={requestApproval} className="btn btn-primary">
                                Request Manager Approval
                              </button>
                            </div>
                          ) : (
                            <>
                              {pendingNotificationId ? (
                                <div className="d-flex flex-column align-items-center gap-2">
                                  {nextElements.length === 0 ? (
                                    <button onClick={() => respondToInstanceRequest(true)} className="btn btn-success w-auto">
                                      Accept Request & Complete Process
                                    </button>
                                  ) : (
                                    <button onClick={() => respondToInstanceRequest(true)} className="btn btn-success w-auto">
                                      Accept Request & Continue to Next Step
                                    </button>
                                  )}
                                  <button onClick={() => respondToInstanceRequest(false)} className="btn btn-danger w-auto">
                                    Deny Request
                                  </button>
                                </div>
                              ) : (
                                <div className="d-flex justify-content-center gap-2">
                                  {nextElements.length === 0 ? (
                                    <button onClick={() => finishProcess(selectedInstanceId)} className="btn btn-success w-auto">
                                      Complete Process
                                    </button>
                                  ) : (
                                    <button onClick={() => handleNextStep(selectedInstanceId)} className="btn btn-primary w-auto">
                                      Continue to Next Step &rarr;
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          <div className="d-flex justify-content-center gap-2">
                            {currentUser.role === 'Employee' ? (
                              <button onClick={() => requestCancel(selectedInstanceId)} className="btn btn-outline-danger">
                                Request Cancellation
                              </button>
                            ) : (
                              <button onClick={() => cancelProcess(selectedInstanceId)} className="btn btn-outline-danger">
                                Cancel Process
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Header for Element Details */}
                {selectedElementDetails && (
                  <div className="card mb-3">
                    <div className="card-header bg-light">
                      <h5 className="mb-0">Element Details</h5>
                    </div>
                    <div className="card-body position-relative">
                      <button 
                        type="button" 
                        className="btn-close position-absolute top-0 end-0 m-2" 
                        aria-label="Close"
                        onClick={() => setSelectedElementDetails(null)}
                      ></button>
                      <h5>{selectedElementDetails.name}</h5>
                      <p><strong>Role:</strong> {selectedElementDetails.role}</p>
                      <p><strong>Description:</strong> {selectedElementDetails.description}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Header for BPMN Viewer Container */}
            {(selectedProcess || selectedInstanceId) && (
              <div className="card mb-3">
                <div className="card-header bg-light">
                  <h5 className="mb-0">Diagram Viewer</h5>
                </div>
                <div className="card-body p-0 bpmn-viewer-container">
                  <div ref={bpmnContainerRef} className="w-100 h-100"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default ExecuteProcess;
