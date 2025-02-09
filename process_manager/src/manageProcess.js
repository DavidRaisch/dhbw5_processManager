import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { customExtension } from './customExtension';

function CreateProcess() {
  const [processName, setProcessName] = useState('');
  const [processList, setProcessList] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const bpmnModeler = useRef(null);
  const bpmnEditorRef = useRef(null);

  useEffect(() => {
    bpmnModeler.current = new BpmnModeler({
      container: bpmnEditorRef.current,
      additionalModules: [],
      moddleExtensions: {
        role: customExtension
      }
    });

    bpmnModeler.current.createDiagram().catch(console.error);

    bpmnModeler.current.on('element.click', (event) => {
      const element = event.element;
      setSelectedElement(element);
      const businessObject = element.businessObject;
      setRole(businessObject.role || '');
      setDescription(businessObject.description || ''); // Fetch description
    });

    fetchProcesses();

    return () => {
      bpmnModeler.current.destroy();
    };
  }, []);

  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  const handleSaveRole = () => {
    if (!selectedElement) return;
    const modeling = bpmnModeler.current.get('modeling');
    const elementRegistry = bpmnModeler.current.get('elementRegistry');
    const element = elementRegistry.get(selectedElement.id);
    modeling.updateProperties(element, { 'role:role': role });
  };

  const handleSaveDescription = () => {
    if (!selectedElement) return;
    const modeling = bpmnModeler.current.get('modeling');
    const elementRegistry = bpmnModeler.current.get('elementRegistry');
    const element = elementRegistry.get(selectedElement.id);
    modeling.updateProperties(element, { description }); // Save description
  };

  const handleSaveToDatabase = () => {
    if (!processName) {
      alert('Please enter a process name.');
      return;
    }

    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios.post('http://localhost:5001/api/processes', { name: processName, xml })
        .then((response) => {
          alert(response.data.message);
          fetchProcesses();
        })
        .catch((err) => {
          console.error('Error saving process:', err);
          alert('An error occurred while saving the process.');
        });
    });
  };

  const handleLoadProcess = (process) => {
    bpmnModeler.current.importXML(process.xml).catch((err) => console.error('Error loading process:', err));
  };

  const handleDeleteProcess = (id) => {
    axios.delete(`http://localhost:5001/api/processes/${id}`)
      .then(() => {
        alert('Process deleted');
        fetchProcesses();
      })
      .catch((err) => console.error('Error deleting process:', err));
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Process Name"
          value={processName}
          onChange={(e) => setProcessName(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={handleSaveToDatabase} style={{ padding: '5px 10px' }}>Save to Database</button>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid black', height: '400px', position: 'relative' }}>
          <div ref={bpmnEditorRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        <div style={{ width: '300px', border: '1px solid black', padding: '10px' }}>
          <h3>Saved Processes</h3>
          {processList.map((process) => (
            <div key={process._id} style={{ marginBottom: '10px' }}>
              <div>{process.name}</div>
              <button onClick={() => handleLoadProcess(process)} style={{ marginRight: '5px' }}>Load</button>
              <button onClick={() => handleDeleteProcess(process._id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '20px', border: '1px solid black', padding: '10px' }}>
        <h3>Assign Role and Description to Element</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
          <button onClick={handleSaveRole} style={{ padding: '5px 10px' }}>Save Role</button>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
          <button onClick={handleSaveDescription} style={{ padding: '5px 10px' }}>Save Description</button>
        </div>
        <div>
          <strong>Selected Element:</strong> {selectedElement ? selectedElement.id : 'None'}
        </div>
      </div>
    </div>
  );
}

export default CreateProcess;

//TODO: fill ProcessName in, during process loading
//TODO: Instead of giving the opportunity to fill the blanks, implement pre-defined roles the user can choose
//TODO: Add a description for each element, that will be displayed in executingProcess
//TODO: change delete process => only user with permission should be able to delete processes
//TODO: put process name and save button into box below. remove single save button for name and description, only one save button for everthing
//TODO: sleceted element should display the name of the element
//TODO: Role and description should be loaded out of database with process