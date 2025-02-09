import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

function ExecuteProcess() {
  const [processList, setProcessList] = useState([]);
  const [currentElement, setCurrentElement] = useState(null);
  const [sequenceMap, setSequenceMap] = useState({});
  const [gatewayChoices, setGatewayChoices] = useState([]);
  const [processName, setProcessName] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const viewerRef = useRef(null);
  const bpmnContainerRef = useRef(null);

  useEffect(() => {
    viewerRef.current = new NavigatedViewer({ container: bpmnContainerRef.current, zoomScroll: false, moveCanvas: false });
    fetchProcesses();
    return () => viewerRef.current.destroy();
  }, []);

  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  const handleDisplayProcess = async (process) => {
    try {
      setProcessName(process.name);
      setSelectedProcess(process);
      setIsNavigationMode(false);
      await viewerRef.current.importXML(process.xml);
      viewerRef.current.get('canvas').zoom('fit-viewport');
    } catch (err) {
      console.error('Error displaying process:', err);
    }
  };

  const handleStartProcess = async () => {
    if (!selectedProcess) return;
    setIsNavigationMode(true);
    try {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true });
      const parsedXML = parser.parse(selectedProcess.xml);
      
      const flowMap = {};
      parsedXML.definitions.process.sequenceFlow.forEach(flow => {
        if (!flowMap[flow["@_sourceRef"]]) {
          flowMap[flow["@_sourceRef"]] = [];
        }
        flowMap[flow["@_sourceRef"]].push({
          target: flow["@_targetRef"],
          name: flow["@_name"] || 'Unnamed Flow'
        });
      });
      setSequenceMap(flowMap);
      handleNextStep('StartEvent_1');
    } catch (err) {
      console.error('Error starting process:', err);
    }
  };

  const handleNextStep = (nextId) => {
    if (!nextId) return;
    const nextElements = sequenceMap[nextId] || [];
    
    if (nextElements.length > 1) {
      setGatewayChoices(nextElements);
    } else {
      setGatewayChoices([]);
      const element = viewerRef.current.get('elementRegistry').find(el => el.id === nextId);
      setCurrentElement({
        ...element,
        name: element.businessObject.name || 'Unnamed',
        role: element.businessObject.get('role:role') || 'No role assigned',
        description: element.businessObject.get('role:description') || 'No description'
      });
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid green', display: 'flex', flexDirection: 'row', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ width: '200px', borderRight: '1px solid gray', paddingRight: '10px' }}>
        <h3>Process List</h3>
        <ul>
          {processList.map((process) => (
            <li key={process.id} style={{ cursor: 'pointer', padding: '5px', borderBottom: '1px solid lightgray' }} onClick={() => handleDisplayProcess(process)}>
              {process.name}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <input type="text" value={processName} readOnly placeholder="Process Name" style={{ flex: 1 }} />
          <button>Close</button>
        </div>

        <div style={{ flex: 1, height: '500px', border: '1px solid black', overflow: 'hidden' }}>
          <div ref={bpmnContainerRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        {isNavigationMode && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', border: '1px solid black' }}>
            {currentElement ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>{currentElement.name}</h3>
                <p>Role: {currentElement.role}</p>
                <p>Description: {currentElement.description}</p>
              </div>
            ) : (
              <p>No active element</p>
            )}
            {gatewayChoices.length > 0 ? (
              <div>
                <h4>Choose Path:</h4>
                {gatewayChoices.map(choice => (
                  <button 
                    key={choice.target} 
                    onClick={() => handleNextStep(choice.target)}
                    style={{ margin: '5px' }}
                  >
                    {choice.name}
                  </button>
                ))}
              </div>
            ) : (
              <button 
                onClick={() => handleNextStep(sequenceMap[currentElement?.id]?.[0]?.target)} 
                style={{ marginTop: '10px' }}
              >
                Next →
              </button>
            )}
          </div>
        )}

        {selectedProcess && !isNavigationMode && (
          <button onClick={handleStartProcess} style={{ marginTop: '10px' }}>Start</button>
        )}
      </div>
    </div>
  );
}

export default ExecuteProcess;







//TODO: Change design more like manageProcess
//TODO: display more helpful details for navigation, like name, role and description
//TODO: include logic for close-button, so it will close the current navigation of a process
//TODO: send messages to User, if the element requieres there work
//TODO: aktueller Stand bei der Ausführung des Prozess soll zwischengespeichert werden, sodass dieser wieder geladen und an gleicher stelle fortgesetzt werden kann.
//TODO: mehere Instanzen eines Prozesses sollten gleichzeitig gestartet und durchgeführt werden => dafür eine Liste für angelgte/gespeicherte Prozesse und eine Liste für aktive Prozessees
//TODO: Gateway desicion should display flow names and not actities
//TODO: if it is the last element remove the next button and add a button with Finish Process