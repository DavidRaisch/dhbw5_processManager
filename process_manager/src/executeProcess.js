// ExecuteProcess.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

function ExecuteProcess() {
  // List of BPMN process templates
  const [processList, setProcessList] = useState([]);
  // Instances that are still running
  const [activeInstances, setActiveInstances] = useState([]);
  // Instances that have finished or canceled (archived)
  const [archivedInstances, setArchivedInstances] = useState([]);
  // Currently selected instance (by _id)
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  // Currently selected process template (when starting a new instance)
  const [selectedProcess, setSelectedProcess] = useState(null);
  // New instance name input value (when creating an instance)
  const [newInstanceName, setNewInstanceName] = useState("");
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);

  // Fetch processes and instances on mount.
  useEffect(() => {
    fetchProcesses();
    fetchInstances();
  }, []);

  // Clean up the viewer on unmount.
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // This effect both re‑creates the viewer (if needed) and loads the diagram.
  useEffect(() => {
    const loadDiagram = async () => {
      // If a process (or instance) is selected and there is no viewer,
      // create one.
      if ((selectedProcess || selectedInstanceId) && !viewerRef.current) {
        viewerRef.current = new NavigatedViewer({
          container: bpmnContainerRef.current,
          zoomScroll: false,
          moveCanvas: false,
        });
      }
      // If no viewer exists, nothing to load.
      if (!viewerRef.current) return;
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

  // Fetch available process templates from the backend.
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Fetch instances and separate them into active and archived.
  const fetchInstances = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/instances');
      const instances = response.data;
      const active = instances.filter((inst) => inst.status === 'running');
      const archived = instances.filter((inst) => inst.status !== 'running');
      setActiveInstances(active);
      setArchivedInstances(archived);
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  // Helper to update an instance in the backend and adjust local state accordingly.
  const updateInstance = async (instanceId, updatedData) => {
    try {
      const response = await axios.put(`http://localhost:5001/api/instances/${instanceId}`, updatedData);
      const updatedInstance = response.data.instance;
      if (updatedInstance.status !== 'running') {
        // Remove from activeInstances and add to archivedInstances.
        setActiveInstances((prev) => prev.filter((inst) => inst._id !== instanceId));
        setArchivedInstances((prev) => [...prev, updatedInstance]);
      } else {
        setActiveInstances((prev) =>
          prev.map((inst) => (inst._id === instanceId ? updatedInstance : inst))
        );
      }
    } catch (err) {
      console.error('Error updating instance:', err);
    }
  };

  // Create a new instance for a given process.
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
    const parsedXML = parser.parse(process.xml);
    const flowMap = {};

    // Ensure sequenceFlow is always an array.
    const sequenceFlows = Array.isArray(parsedXML.definitions.process.sequenceFlow)
      ? parsedXML.definitions.process.sequenceFlow
      : [parsedXML.definitions.process.sequenceFlow];

    sequenceFlows.forEach((flow) => {
      if (!flowMap[flow["@_sourceRef"]]) {
        flowMap[flow["@_sourceRef"]] = [];
      }
      flowMap[flow["@_sourceRef"]].push({
        target: flow["@_targetRef"],
        name: flow["@_name"] || 'Unnamed Flow',
      });
    });

    const newInstanceData = {
      processId: process._id || process.id,
      processName: process.name,
      instanceName, // Use the instance name provided in the input.
      xml: process.xml,
      currentElement: null,
      sequenceMap: flowMap,
      gatewayChoices: [],
      position: 'StartEvent_1',
      status: 'running',
      created: new Date(),
    };

    try {
      const response = await axios.post('http://localhost:5001/api/instances', newInstanceData);
      const savedInstance = response.data.instance;
      setActiveInstances((prev) => [...prev, savedInstance]);
      setSelectedInstanceId(savedInstance._id);
      setSelectedProcess(null);
      setNewInstanceName(""); // reset the instance name input

      // Load the new instance diagram.
      await viewerRef.current.importXML(process.xml);
      viewerRef.current.get('canvas').zoom('fit-viewport');

      const currentElement = getElementState('StartEvent_1');
      updateInstance(savedInstance._id, { currentElement });
    } catch (err) {
      console.error('Error creating new instance:', err);
    }
  };

  // Retrieve an element's state from the viewer.
  const getElementState = (elementId) => {
    const element = viewerRef.current.get('elementRegistry').find((el) => el.id === elementId);
    return element
      ? {
          id: element.id,
          name: element.businessObject.name || 'Unnamed',
          role: element.businessObject.get('role:role') || 'No role assigned',
          description: element.businessObject.get('role:description') || 'No description',
        }
      : null;
  };

  // Advance the process one step.
  const handleNextStep = (instanceId) => {
    const instance = activeInstances.find((i) => i._id === instanceId);
    if (!instance) return;

    const nextElements = instance.sequenceMap[instance.position] || [];
    if (nextElements.length > 1) {
      // More than one possible next step: show gateway choices.
      updateInstance(instanceId, { gatewayChoices: nextElements });
    } else if (nextElements.length === 1) {
      // Single next step: auto-advance.
      const newPosition = nextElements[0]?.target;
      const newElement = getElementState(newPosition);
      updateInstance(instanceId, { position: newPosition, currentElement: newElement, gatewayChoices: [] });
    }
  };

  // When multiple next paths exist, allow the user to choose.
  const handleGatewayChoice = (instanceId, target) => {
    const newElement = getElementState(target);
    updateInstance(instanceId, { position: target, currentElement: newElement, gatewayChoices: [] });
  };

  // Finish the process: update status and destroy the viewer.
  const finishProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'finished' });
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
    clearViewer();
  };

  // Cancel the process: update status and destroy the viewer.
  const cancelProcess = async (instanceId) => {
    await updateInstance(instanceId, { status: 'canceled' });
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
    clearViewer();
  };

  // Handler for the Close button: destroy the viewer and reset selections.
  const handleClose = () => {
    clearViewer();
    setSelectedInstanceId(null);
    setSelectedProcess(null);
  };

  // Helper to destroy the viewer.
  const clearViewer = () => {
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }
  };

  // Compute the selected instance (active or archived).
  const selectedInstance =
    activeInstances.find((i) => i._id === selectedInstanceId) ||
    archivedInstances.find((i) => i._id === selectedInstanceId);

  // For active instances, get the next available flows from the sequence map.
  const nextElements =
    selectedInstance && selectedInstance.status === 'running'
      ? selectedInstance.sequenceMap[selectedInstance.position] || []
      : [];

  return (
    <div
      style={{
        padding: '20px',
        border: '1px solid green',
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
      }}
    >
      {/* Left Sidebar */}
      <div style={{ width: '250px', borderRight: '1px solid gray', paddingRight: '10px' }}>
        <div>
          <h3>Available Processes</h3>
          <ul>
            {processList.map((process) => (
              <li
                key={process._id || process.id}
                style={{ cursor: 'pointer', padding: '5px', borderBottom: '1px solid lightgray' }}
                onClick={() => {
                  setSelectedProcess(process);
                  setSelectedInstanceId(null);
                }}
              >
                {process.name}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Active Instances</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {activeInstances.map((instance) => (
              <li
                key={instance._id}
                style={{
                  cursor: 'pointer',
                  padding: '5px',
                  backgroundColor: selectedInstanceId === instance._id ? '#e0f0ff' : 'white',
                  borderBottom: '1px solid lightgray',
                }}
                onClick={() => {
                  setSelectedInstanceId(instance._id);
                  setSelectedProcess(null);
                }}
              >
                <div>
                  <strong>{instance.instanceName}</strong>
                </div>
                <div>
                  <em>{instance.processName}</em>
                </div>
                <div>
                  <small>{new Date(instance.created).toLocaleString()}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Archived Processes section */}
        <div style={{ marginTop: '20px', borderTop: '1px solid gray', paddingTop: '10px' }}>
          <h3>Archived Processes</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {archivedInstances.map((instance) => (
                <li
                  key={instance._id}
                  style={{
                    cursor: 'pointer',
                    padding: '5px',
                    borderBottom: '1px solid lightgray',
                  }}
                  onClick={() => {
                    setSelectedInstanceId(instance._id);
                    setSelectedProcess(null);
                  }}
                >
                  <div>
                    <strong>{instance.instanceName}</strong>
                  </div>
                  <div>
                    <em>{instance.processName}</em>
                  </div>
                  <div>
                    <small>{new Date(instance.created).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          {selectedProcess ? (
            // Process selected for starting a new instance.
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <input
                type="text"
                value={selectedProcess.name}
                readOnly
                style={{ marginRight: '10px', flex: 1 }}
              />
              <input
                type="text"
                placeholder="Enter instance name"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                style={{ marginRight: '10px', flex: 1 }}
              />
              <button onClick={() => createNewInstance(selectedProcess, newInstanceName)}>
                Start New Instance
              </button>
            </div>
          ) : (
            // Otherwise, show the selected instance details.
            <input
              type="text"
              value={
                selectedInstance
                  ? `${selectedInstance.instanceName} - ${selectedInstance.processName}`
                  : 'Select a process'
              }
              readOnly
              placeholder="Process Name"
              style={{ flex: 1 }}
            />
          )}
          <div>
            <button onClick={handleClose}>Close</button>
          </div>
        </div>

        {/* BPMN Viewer Container */}
        <div style={{ flex: 1, height: '500px', border: '1px solid black', overflow: 'hidden' }}>
          <div ref={bpmnContainerRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        {selectedInstanceId && (
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '400px',
              border: '1px solid black',
            }}
          >
            {/* Navigation Window Header with Instance Details */}
            {selectedInstance && (
              <div
                style={{
                  borderBottom: '1px solid gray',
                  padding: '5px',
                  alignSelf: 'stretch', // This forces the header to fill the parent's width
                  textAlign: 'center',
                }}
              >
                <strong>{selectedInstance.instanceName}</strong> -{' '}
                <em>{selectedInstance.processName}</em> -{' '}
                <small>{new Date(selectedInstance.created).toLocaleString()}</small>
              </div>
            )}
            {/* Display status if the instance is archived */}
            {selectedInstance && selectedInstance.status !== 'running' ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Process Status: {selectedInstance.status}</h3>
              </div>
            ) : (
              // Otherwise, display active process details and navigation controls.
              <>
                {selectedInstance?.currentElement ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h3>{selectedInstance.currentElement.name}</h3>
                    <p>Role: {selectedInstance.currentElement.role}</p>
                    <p>Description: {selectedInstance.currentElement.description}</p>
                  </div>
                ) : (
                  <p>No active element</p>
                )}

                {selectedInstance?.gatewayChoices && selectedInstance.gatewayChoices.length > 0 ? (
                  <div>
                    <h4>Choose Path:</h4>
                    {selectedInstance.gatewayChoices.map((choice) => (
                      <button
                        key={choice.target}
                        onClick={() => handleGatewayChoice(selectedInstanceId, choice.target)}
                        style={{ margin: '5px' }}
                      >
                        {choice.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    {nextElements.length === 0 ? (
                      <button onClick={() => finishProcess(selectedInstanceId)} style={{ marginTop: '10px' }}>
                        Finish Process
                      </button>
                    ) : (
                      <button
                        onClick={() => handleNextStep(selectedInstanceId)}
                        style={{ marginTop: '10px' }}
                        disabled={!selectedInstance?.position}
                      >
                        Next →
                      </button>
                    )}
                  </div>
                )}
                {/* Show Cancel Process only if there are next elements */}
                {nextElements.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <button onClick={() => cancelProcess(selectedInstanceId)}>Cancel Process</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecuteProcess;











/** Requiered Improvments */
//TODO: Send notification to Manager specific matching to the project the Manager leads and the Process is assigned to
//TODO: User can only See the process assigned to their project
//TODO: send messages to User, if the element requieres there work
//TODO: include a css file, to make the site more appealing


/** Additional Improvments */
//TODO: sort activeProcesses, so the newest process is on top
//TODO: Search Bar for available Processes