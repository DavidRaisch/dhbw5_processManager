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
  // Instances that have finished (archived)
  const [archivedInstances, setArchivedInstances] = useState([]);
  // Currently selected instance (by _id)
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  // Currently selected process template (when starting a new instance)
  const [selectedProcess, setSelectedProcess] = useState(null);
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);

  // On mount, initialize the BPMN viewer and fetch processes/instances
  useEffect(() => {
    viewerRef.current = new NavigatedViewer({
      container: bpmnContainerRef.current,
      zoomScroll: false,
      moveCanvas: false
    });
    fetchProcesses();
    fetchInstances();
    return () => viewerRef.current.destroy();
  }, []);

  // Whenever the selected process or instance changes, load its diagram.
  useEffect(() => {
    const loadDiagram = async () => {
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

  // If a running instance is selected and it has multiple next steps but no gateway choices yet,
  // update it so that the available choices appear.
  useEffect(() => {
    if (selectedInstanceId) {
      const instance = activeInstances.find((i) => i._id === selectedInstanceId);
      if (instance) {
        const flows = instance.sequenceMap ? (instance.sequenceMap[instance.position] || []) : [];
        if (flows.length > 1 && (!instance.gatewayChoices || instance.gatewayChoices.length === 0)) {
          updateInstance(instance._id, { gatewayChoices: flows });
        }
      }
    }
  }, [selectedInstanceId, activeInstances]);

  // Fetch all available process templates from the backend.
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Fetch all instances and separate them into active and archived based on their status.
  const fetchInstances = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/instances');
      const instances = response.data;
      const active = instances.filter((inst) => inst.status === 'running');
      const archived = instances.filter((inst) => inst.status === 'finished');
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
      if (updatedInstance.status === 'finished') {
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

  // Create a new instance for a given process and persist it.
  const createNewInstance = async (process) => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true
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
        name: flow["@_name"] || 'Unnamed Flow'
      });
    });

    const newInstanceData = {
      processId: process._id || process.id,
      processName: process.name,
      xml: process.xml,
      currentElement: null,
      sequenceMap: flowMap,
      gatewayChoices: [],
      position: 'StartEvent_1',
      status: 'running',
      created: new Date()
    };

    try {
      const response = await axios.post('http://localhost:5001/api/instances', newInstanceData);
      const savedInstance = response.data.instance;
      setActiveInstances((prev) => [...prev, savedInstance]);
      setSelectedInstanceId(savedInstance._id);
      setSelectedProcess(null);

      await viewerRef.current.importXML(process.xml);
      viewerRef.current.get('canvas').zoom('fit-viewport');

      const currentElement = getElementState('StartEvent_1');
      updateInstance(savedInstance._id, { currentElement });
    } catch (err) {
      console.error('Error creating new instance:', err);
    }
  };

  // Retrieve the BPMN element's state (name, role, description) from the viewer.
  const getElementState = (elementId) => {
    const element = viewerRef.current.get('elementRegistry').find((el) => el.id === elementId);
    return element
      ? {
          id: element.id,
          name: element.businessObject.name || 'Unnamed',
          role: element.businessObject.get('role:role') || 'No role assigned',
          description: element.businessObject.get('role:description') || 'No description'
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

  // Finish the process: update its status to finished.
  const finishProcess = (instanceId) => {
    updateInstance(instanceId, { status: 'finished' });
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  };

  // Compute the selected instance (active or archived)
  const selectedInstance =
    activeInstances.find((i) => i._id === selectedInstanceId) ||
    archivedInstances.find((i) => i._id === selectedInstanceId);

  // For active instances, get the next available flows from the sequence map.
  const nextElements =
    selectedInstance && selectedInstance.status !== 'finished'
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
        margin: '0 auto'
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
          <ul>
            {activeInstances.map((instance) => (
              <li
                key={instance._id}
                style={{
                  cursor: 'pointer',
                  padding: '5px',
                  backgroundColor: selectedInstanceId === instance._id ? '#e0f0ff' : 'white',
                  borderBottom: '1px solid lightgray'
                }}
                onClick={() => {
                  setSelectedInstanceId(instance._id);
                  setSelectedProcess(null);
                }}
              >
                {instance.processName} (#{instance._id})
                <br />
                <small>{new Date(instance.created).toLocaleTimeString()}</small>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            marginTop: '20px',
            maxHeight: '200px',
            overflowY: 'scroll',
            borderTop: '1px solid gray',
            paddingTop: '10px'
          }}
        >
          <h3>Archived Processes</h3>
          <ul>
            {archivedInstances.map((instance) => (
              <li
                key={instance._id}
                style={{
                  cursor: 'pointer',
                  padding: '5px',
                  borderBottom: '1px solid lightgray'
                }}
                onClick={() => {
                  setSelectedInstanceId(instance._id);
                  setSelectedProcess(null);
                }}
              >
                {instance.processName} (#{instance._id})
                <br />
                <small>{new Date(instance.created).toLocaleTimeString()}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <input
            type="text"
            value={
              selectedProcess
                ? selectedProcess.name
                : ([...activeInstances, ...archivedInstances].find((i) => i._id === selectedInstanceId)?.processName ||
                    'Select a process')
            }
            readOnly
            placeholder="Process Name"
            style={{ flex: 1 }}
          />
          <div>
            {selectedProcess && (
              <button onClick={() => createNewInstance(selectedProcess)} style={{ marginRight: '10px' }}>
                Start New Instance
              </button>
            )}
            <button>Close</button>
          </div>
        </div>

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
              border: '1px solid black'
            }}
          >
            {/* If the selected instance is archived, show its status only */}
            {selectedInstance && selectedInstance.status === 'finished' ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>Process Status: {selectedInstance.status}</h3>
              </div>
            ) : (
              // Otherwise, display active process details and navigation
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
//TODO: include logic for close-button, so it will close the current navigation of a process
//TODO: send messages to User, if the element requieres there work
//TODO: Name of active instance should be set at the top, not just process name, but a individual name (maybe process + ID displayed additionally to the individual name)
//TODO: Button to cancel an active Process => moves the process from the active Process lsit to the archived list and display the status canceledt  


/** Additional Improvments */
//TODO: Change design more like manageProcess => process list and active list should be same size like displaying the process, and archived list should be same size as navigation/status report.
//TODO: sort activeProcesses, so the newest process is on top