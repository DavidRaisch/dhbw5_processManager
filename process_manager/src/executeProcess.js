import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

function ExecuteProcess() {
  const [processList, setProcessList] = useState([]);
  const [activeInstances, setActiveInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);

  // Initialize BPMN viewer and load available processes/active instances on mount
  useEffect(() => {
    viewerRef.current = new NavigatedViewer({ 
      container: bpmnContainerRef.current, 
      zoomScroll: false, 
      moveCanvas: false 
    });
    fetchProcesses();
    fetchActiveInstances();
    return () => viewerRef.current.destroy();
  }, []);

  // Whenever the selected process or instance changes, load its BPMN XML
  useEffect(() => {
    const loadDiagram = async () => {
      try {
        if (selectedProcess) {
          await viewerRef.current.importXML(selectedProcess.xml);
          viewerRef.current.get('canvas').zoom('fit-viewport');
        } else if (selectedInstanceId) {
          const instance = activeInstances.find(i => i._id === selectedInstanceId);
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
  }, [selectedProcess, selectedInstanceId, activeInstances]);

  // When an active instance is selected, ensure that (if applicable) the available next flows are loaded.
  useEffect(() => {
    if (selectedInstanceId) {
      const instance = activeInstances.find(i => i._id === selectedInstanceId);
      if (instance) {
        // Look up the flows for the current position.
        const flows = instance.sequenceMap ? (instance.sequenceMap[instance.position] || []) : [];
        // If there are multiple next flows and none are set as gateway choices, update the instance.
        if (flows.length > 1 && (!instance.gatewayChoices || instance.gatewayChoices.length === 0)) {
          updateInstance(instance._id, { gatewayChoices: flows });
        }
      }
    }
  }, [selectedInstanceId, activeInstances]);

  // Fetch all available processes from the backend
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Fetch all active instances from the backend
  const fetchActiveInstances = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/instances');
      setActiveInstances(response.data);
    } catch (err) {
      console.error('Error fetching active instances:', err);
    }
  };

  // Helper function: update an instance in the backend and update local state
  const updateInstance = async (instanceId, updatedData) => {
    try {
      const response = await axios.put(`http://localhost:5001/api/instances/${instanceId}`, updatedData);
      const updatedInstance = response.data.instance;
      setActiveInstances(prev =>
        prev.map(instance => instance._id === instanceId ? updatedInstance : instance)
      );
    } catch (err) {
      console.error("Error updating instance:", err);
    }
  };

  // Create a new instance and persist it in the database
  const createNewInstance = async (process) => {
    const parser = new XMLParser({ 
      ignoreAttributes: false, 
      attributeNamePrefix: "@_", 
      removeNSPrefix: true 
    });
    
    const parsedXML = parser.parse(process.xml);
    const flowMap = {};

    // Ensure that sequenceFlow is always treated as an array
    const sequenceFlows = Array.isArray(parsedXML.definitions.process.sequenceFlow)
      ? parsedXML.definitions.process.sequenceFlow
      : [parsedXML.definitions.process.sequenceFlow];

    sequenceFlows.forEach(flow => {
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
      // Save new instance to the backend
      const response = await axios.post('http://localhost:5001/api/instances', newInstanceData);
      const savedInstance = response.data.instance;
      setActiveInstances(prev => [...prev, savedInstance]);
      // Select the new instance (clearing any selected process)
      setSelectedInstanceId(savedInstance._id);
      setSelectedProcess(null);

      // Import the BPMN XML into the viewer
      await viewerRef.current.importXML(process.xml);
      viewerRef.current.get('canvas').zoom('fit-viewport');

      // Get the initial element’s state (assumed to be 'StartEvent_1') and update the instance
      const currentElement = getElementState('StartEvent_1');
      updateInstance(savedInstance._id, { currentElement });
    } catch (err) {
      console.error("Error creating new instance:", err);
    }
  };

  // Get information about a BPMN element by its ID
  const getElementState = (elementId) => {
    const element = viewerRef.current.get('elementRegistry').find(el => el.id === elementId);
    return element ? {
      id: element.id,
      name: element.businessObject.name || 'Unnamed',
      role: element.businessObject.get('role:role') || 'No role assigned',
      description: element.businessObject.get('role:description') || 'No description'
    } : null;
  };

  // When clicking Next, use the stored sequenceMap to move forward
  const handleNextStep = (instanceId) => {
    const instance = activeInstances.find(i => i._id === instanceId);
    if (!instance) return;

    const nextElements = instance.sequenceMap[instance.position] || [];
    
    if (nextElements.length > 1) {
      // More than one possible next step: update the instance with available gateway choices.
      updateInstance(instanceId, { gatewayChoices: nextElements });
    } else if (nextElements.length === 1) {
      // Single next step: advance automatically.
      const newPosition = nextElements[0]?.target;
      const newElement = getElementState(newPosition);
      updateInstance(instanceId, { position: newPosition, currentElement: newElement, gatewayChoices: [] });
    }
  };

  // When the user chooses a path at a gateway, update the active instance
  const handleGatewayChoice = (instanceId, target) => {
    const newElement = getElementState(target);
    updateInstance(instanceId, { position: target, currentElement: newElement, gatewayChoices: [] });
  };

  return (
    <div style={{ padding: '20px', border: '1px solid green', display: 'flex', flexDirection: 'row', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Left Sidebar */}
      <div style={{ width: '250px', borderRight: '1px solid gray', paddingRight: '10px' }}>
        <div>
          <h3>Available Processes</h3>
          <ul>
            {processList.map((process) => (
              <li key={process._id || process.id} 
                  style={{ cursor: 'pointer', padding: '5px', borderBottom: '1px solid lightgray' }}
                  onClick={() => {
                    // When clicking an available process, clear any selected instance.
                    setSelectedProcess(process);
                    setSelectedInstanceId(null);
                  }}>
                {process.name}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Active Instances</h3>
          <ul>
            {activeInstances.map(instance => (
              <li key={instance._id}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '5px',
                    backgroundColor: selectedInstanceId === instance._id ? '#e0f0ff' : 'white',
                    borderBottom: '1px solid lightgray'
                  }}
                  onClick={() => {
                    // When clicking an active instance, clear any selected process.
                    setSelectedInstanceId(instance._id);
                    setSelectedProcess(null);
                  }}>
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
          <input type="text" 
                 value={
                   selectedProcess
                     ? selectedProcess.name
                     : (activeInstances.find(i => i._id === selectedInstanceId)?.processName || 'Select a process')
                 }
                 readOnly 
                 placeholder="Process Name" 
                 style={{ flex: 1 }} />
          <div>
            {selectedProcess && (
              <button onClick={() => createNewInstance(selectedProcess)} 
                      style={{ marginRight: '10px' }}>
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
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', 
                        alignItems: 'center', justifyContent: 'center', 
                        height: '400px', border: '1px solid black' }}>
            {activeInstances.find(i => i._id === selectedInstanceId)?.currentElement ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>{activeInstances.find(i => i._id === selectedInstanceId).currentElement.name}</h3>
                <p>Role: {activeInstances.find(i => i._id === selectedInstanceId).currentElement.role}</p>
                <p>Description: {activeInstances.find(i => i._id === selectedInstanceId).currentElement.description}</p>
              </div>
            ) : (
              <p>No active element</p>
            )}
            
            {activeInstances.find(i => i._id === selectedInstanceId)?.gatewayChoices?.length > 0 ? (
              <div>
                <h4>Choose Path:</h4>
                {activeInstances.find(i => i._id === selectedInstanceId).gatewayChoices.map(choice => (
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
              <button 
                onClick={() => handleNextStep(selectedInstanceId)}
                style={{ marginTop: '10px' }}
                disabled={!activeInstances.find(i => i._id === selectedInstanceId)?.position}
              >
                Next →
              </button>
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
//TODO: aktueller Stand bei der Ausführung des Prozess soll zwischengespeichert werden, sodass dieser wieder geladen und an gleicher stelle fortgesetzt werden kann.
//TODO: mehere Instanzen eines Prozesses sollten gleichzeitig gestartet und durchgeführt werden => dafür eine Liste für angelgte/gespeicherte Prozesse und eine Liste für aktive Prozessees
//TODO: if it is the last element remove the next button and add a button with Finish Process/or process finished without an button
//TODO: completed processes should be removed from the activeProcesses list and the database
//TODO: Name of active instance should be set at the top, not just process name, but a individual name (maybe process + ID displayed additionally to the individual name)


/** Additional Improvments */
//TODO: Change design more like manageProcess
//TODO: after last element of the sequnceFlow a process is completed and should be moved into archived Processes
//TODO: completed processes should be listed under archived Processes and not under active => should be a list to expand and scrollable, to not take in too much space
//TODO: sort activeProcesses, so the newest process is on top