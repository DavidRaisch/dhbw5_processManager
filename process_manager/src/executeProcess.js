import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

function ExecuteProcess() {
  const [processList, setProcessList] = useState([]);
  const [currentElementIndex, setCurrentElementIndex] = useState(0);
  const [elements, setElements] = useState([]);
  const [sequenceOrder, setSequenceOrder] = useState([]);
  const [activeElement, setActiveElement] = useState(null);
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
      const { xml } = selectedProcess;
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true });
      const parsedXML = parser.parse(xml);

      const processElements = viewerRef.current.get('elementRegistry').filter(el => el.type);
      const sequenceFlows = parsedXML.definitions.process.sequenceFlow || [];

      const flowMap = {};
      sequenceFlows.forEach(flow => {
        flowMap[flow["@_sourceRef"]] = flow["@_targetRef"];
      });

      let currentElement = 'StartEvent_1';
      const orderedElements = [];
      const visitedElements = new Set();

      while (currentElement) {
        const element = processElements.find(el => el.id === currentElement);
        if (element && !visitedElements.has(element.id)) {
          orderedElements.push(element);
          visitedElements.add(element.id);
        }
        currentElement = flowMap[currentElement];
      }

      setElements(processElements);
      setSequenceOrder(orderedElements);
      setCurrentElementIndex(0);
      setActiveElement(orderedElements[0]);
    } catch (err) {
      console.error('Error starting process:', err);
    }
  };

  const handleNextStep = () => {
    if (currentElementIndex + 1 < sequenceOrder.length) {
      const nextIndex = currentElementIndex + 1;
      setCurrentElementIndex(nextIndex);
      setActiveElement(sequenceOrder[nextIndex]);
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
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', border: '1px solid black' }}>
            {activeElement ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>{activeElement.id}</h3>
                <p>Type: {activeElement.type}</p>
              </div>
            ) : (
              <p>No active element</p>
            )}
          </div>
        )}

        {selectedProcess && !isNavigationMode && (
          <button onClick={handleStartProcess} style={{ marginTop: '10px' }}>Start</button>
        )}

        {isNavigationMode && sequenceOrder.length > 0 && (
          <button onClick={handleNextStep} style={{ alignSelf: 'flex-end', marginTop: '10px' }}>Next →</button>
        )}
      </div>
    </div>
  );
}

export default ExecuteProcess;







//TODO: Make process window bigger, in best case even responsive.
//TODO: fix execution of gateways, it should be chooseable which way to go, and not automatically choose for the user
//TODO: display more helpful details for navigation, like name, role and description
//TODO: include logic for close-button, so it will close the current navigation of a process
//TODO: send messages to User, if the element requieres there work
//TODO: aktueller Stand bei der Ausführung des Prozess soll zwischengespeichert werden, sodass dieser wieder geladen und an gleicher stelle fortgesetzt werden kann.
//TODO: mehere Instanzen eines Prozesses sollten gleichzeitig gestartet und durchgeführt werden => dafür eine Liste für angelgte/gespeicherte Prozesse und eine Liste für aktive Prozesse