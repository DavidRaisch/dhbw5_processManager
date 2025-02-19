import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import './executeProcess.css';

function ExecuteProcess() {
  const location = useLocation();
  const instanceIdFromNotification = location.state?.instanceId;

  // State management
  const [processList, setProcessList] = useState([]);
  const [activeInstances, setActiveInstances] = useState([]);
  const [archivedInstances, setArchivedInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [userProjects, setUserProjects] = useState([]);
  const [selectedElementDetails, setSelectedElementDetails] = useState(null);

  // BPMN viewer references
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);
  const currentUser = JSON.parse(sessionStorage.getItem('user'));

  // Function to handle BPMN element clicks
  const handleElementClick = (event) => {
    const element = event.element;
    const details = {
      name: element.businessObject.name || 'Unnamed',
      role: element.businessObject.get('role:role') || 'No role assigned',
      description: element.businessObject.get('role:description') || 'No description'
    };
    setSelectedElementDetails(details);
  };

  // User and project initialization
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${currentUser._id}`);
        const userDetails = response.data;
        if (userDetails.projects && Array.isArray(userDetails.projects)) {
          const names = userDetails.projects.map(proj => proj.name);
          setUserProjects(names);
        }
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };
    fetchUserDetails();
  }, [currentUser._id]);

  // Process and instance data fetching
  useEffect(() => {
    userProjects.length > 0 ? fetchProcesses() : setProcessList([]);
  }, [userProjects]);

  useEffect(() => {
    processList.length > 0 ? fetchInstances() : setActiveInstances([]);
  }, [processList]);

  // BPMN viewer lifecycle management
  useEffect(() => {
    if (instanceIdFromNotification) {
      setSelectedInstanceId(instanceIdFromNotification);
      setSelectedProcess(null);
      setSelectedElementDetails(null);
    }
  }, [instanceIdFromNotification]);

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

  // Data fetching functions
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      const filtered = response.data.filter(proc => 
        proc.project && userProjects.includes(proc.project.name)
      );
      setProcessList(filtered);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  const fetchInstances = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/instances');
      const allowedNames = new Set(processList.map(p => p.name));
      const active = response.data.filter(inst => 
        inst.status === 'running' && allowedNames.has(inst.processName)
      );
      const archived = response.data
        .filter(inst => 
          inst.status !== 'running' && allowedNames.has(inst.processName)
        )
        .sort((a, b) => new Date(b.created) - new Date(a.created)); // Newest first
      setActiveInstances(active);
      setArchivedInstances(archived);
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  // Instance management
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

  // Process creation and navigation
  const createNewInstance = async (process, instanceName) => {
    if (!instanceName) {
      alert("Please enter an instance name.");
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

  // Element state management
  const getElementState = (elementId) => {
    const element = viewerRef.current.get('elementRegistry').find(el => el.id === elementId);
    return element ? {
      id: element.id,
      name: element.businessObject.name || 'Unnamed',
      role: element.businessObject.get('role:role') || 'No role assigned',
      description: element.businessObject.get('role:description') || 'No description',
    } : null;
  };

  // Process navigation handlers
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

  // Process completion and cancellation
  const finishProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'finished' });
    handleProcessCompletion(instanceId);
  };

  const cancelProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'canceled' });
    handleProcessCompletion(instanceId);
  };

  const handleProcessCompletion = (instanceId) => {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
    clearViewer();
  };

  // Request handling
  const requestApproval = async () => {
    const requestedById = currentUser._id;
    if (!requestedById) {
      alert("No user id found, please login again.");
      return;
    }

    const processOfInstance = processList.find(p => p.name === selectedInstance.processName);
    const projectId = processOfInstance?.project?._id || processOfInstance?.project;
    if (!projectId) {
      alert("No project assigned to the process.");
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
      alert('Approval request sent to Manager.');
    } catch (err) {
      console.error('Error sending approval request:', err);
      alert('Error sending approval request.');
    }
  };

  const requestCancel = async (instanceId) => {
    const requestedById = currentUser._id;
    if (!requestedById) {
      alert("No user id found, please login again.");
      return;
    }

    const processOfInstance = processList.find(p => p.name === selectedInstance.processName);
    const projectId = processOfInstance?.project?._id || processOfInstance?.project;
    if (!projectId) {
      alert("No project assigned to the process.");
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
      alert('Cancellation request sent to Manager.');
    } catch (err) {
      console.error('Error sending cancellation request:', err);
      alert('Error sending cancellation request.');
    }
  };

  // UI helpers
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

  // Derived data
  const selectedInstance = [...activeInstances, ...archivedInstances]
    .find(i => i._id === selectedInstanceId);
  const nextElements = selectedInstance?.status === 'running' 
    ? selectedInstance.sequenceMap[selectedInstance.position] || []
    : [];
  const getAssignedProjectName = () => {
    const proc = processList.find(p => p.name === selectedInstance?.processName);
    return proc?.project?.name || "No Project Assigned";
  };

  return (
    <div className="container-fluid bg-sidebar-grey" style={{ minHeight: '100vh' }}>
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
                <small className="text-muted">{process.project?.name || 'No Project'}</small>
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

          <h5 className="mb-3">Archived Instances</h5>
          <div className="overflow-auto" style={{ maxHeight: '400px' }}>
            <ul className="list-group">
              {archivedInstances.map((instance) => (
                <li
                  key={instance._id}
                  className={`list-group-item list-group-item-action ${selectedInstanceId === instance._id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedInstanceId(instance._id);
                    setSelectedProcess(null);
                    setSelectedElementDetails(null);
                  }}
                >
                  <div className="fw-medium">{instance.instanceName}</div>
                  <small className="text-muted">{instance.processName} - {instance.status}</small>
                </li>
              ))}
            </ul>
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
                <div className="card-header">
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
                          <strong>Project:</strong> {getAssignedProjectName()}
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
                            {selectedInstance.gatewayChoices?.length > 0 ? (
                              <div className="p-3 border rounded">
                                <h5>Select Path:</h5>
                                <div className="d-flex flex-wrap gap-2 justify-content-center">
                                  {selectedInstance.gatewayChoices.map((choice) => (
                                    <button
                                      key={choice.target}
                                      onClick={() => handleGatewayChoice(selectedInstanceId, choice.target)}
                                      className="btn btn-primary"
                                    >
                                      {choice.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="d-flex justify-content-center gap-2">
                                {nextElements.length === 0 ? (
                                  <button onClick={() => finishProcess(selectedInstanceId)} className="btn btn-success">
                                    Complete Process
                                  </button>
                                ) : (
                                  <button onClick={() => handleNextStep(selectedInstanceId)} className="btn btn-primary">
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

              {/* Element Details (if any) */}
              {selectedElementDetails && (
                <div className="element-details mt-3 p-3 position-relative">
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
              )}
            </>
          )}

          {/* BPMN Viewer Container (only rendered when a process or instance is selected) */}
          {(selectedProcess || selectedInstance) && (
            <div className="bpmn-viewer-container mb-3">
              <div ref={bpmnContainerRef} className="w-100 h-100"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecuteProcess;








/** Additional Improvments */
//TODO: OPTIONAL: Search Bar for available Processes


/** Notes for report */
//Only processes and instances of the assigned projects are displayed for every user