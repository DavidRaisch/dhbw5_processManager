import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { customExtension } from './customExtension';
import customRules from './customRules';  // our custom rules module

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
      additionalModules: [
        customRules  // Include our custom rules module.
      ],
      moddleExtensions: {
        role: customExtension
      }
    });

    bpmnModeler.current.createDiagram().catch(console.error);

    // When an element is clicked, update the selected element and load its role/description.
    bpmnModeler.current.on('element.click', (event) => {
      const element = event.element;
      setSelectedElement(element);
      const businessObject = element.businessObject;
      const loadedRole = businessObject['role:role'] || businessObject.role || '';
      setRole(loadedRole);
      setDescription(businessObject.description || '');
    });

    fetchProcesses();

    return () => {
      bpmnModeler.current.destroy();
    };
  }, []);

  // Automatically update the BPMN element whenever role or description changes.
  useEffect(() => {
    if (selectedElement) {
      const modeling = bpmnModeler.current.get('modeling');
      const elementRegistry = bpmnModeler.current.get('elementRegistry');
      const element = elementRegistry.get(selectedElement.id);
      modeling.updateProperties(element, { role, description });
    }
  }, [role, description, selectedElement]);

  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Save the entire diagram (including any role/description changes) along with the process name.
  const handleSaveToDatabase = () => {
    if (!processName) {
      alert('Please enter a process name.');
      return;
    }

    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios
        .post('http://localhost:5001/api/processes', { name: processName, xml })
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

  // Create a new blank process.
  const handleCreateNewProcess = () => {
    bpmnModeler.current.createDiagram().then(() => {
      // Clear out the current process information and selected element.
      setProcessName('');
      setSelectedElement(null);
      setRole('');
      setDescription('');
    }).catch((err) => {
      console.error('Error creating new diagram:', err);
    });
  };

  // When loading a process, update the process name and reset role/description.
  const handleLoadProcess = (process) => {
    bpmnModeler.current
      .importXML(process.xml)
      .then(() => {
        setProcessName(process.name);
        // Reset selected element and clear role and description
        setSelectedElement(null);
        setRole('');
        setDescription('');
      })
      .catch((err) => console.error('Error loading process:', err));
  };

  const handleDeleteProcess = (id) => {
    axios
      .delete(`http://localhost:5001/api/processes/${id}`)
      .then(() => {
        alert('Process deleted');
        fetchProcesses();
      })
      .catch((err) => console.error('Error deleting process:', err));
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Editor and saved processes */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <div
          style={{
            flex: 1,
            border: '1px solid black',
            height: '400px',
            position: 'relative'
          }}
        >
          <div ref={bpmnEditorRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        <div style={{ width: '300px', border: '1px solid black', padding: '10px' }}>
          <h3>Saved Processes</h3>
          {processList.map((process) => (
            <div key={process._id} style={{ marginBottom: '10px' }}>
              <div>{process.name}</div>
              <button
                onClick={() => handleLoadProcess(process)}
                style={{ marginRight: '5px' }}
              >
                Load
              </button>
              <button onClick={() => handleDeleteProcess(process._id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom container with Process Information and Role/Description */}
      <div style={{ marginTop: '20px', border: '1px solid black', padding: '10px' }}>
        {/* Process Information Section */}
        <h3>Process Information</h3>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Process Name"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
          <button onClick={handleSaveToDatabase} style={{ padding: '5px 10px', marginRight: '10px' }}>
            Save to Database
          </button>
          {/* New "Create New Process" button */}
          <button onClick={handleCreateNewProcess} style={{ padding: '5px 10px' }}>
            Create New Process
          </button>
        </div>

        {/* Role and Description Section */}
        <h3>Assign Role and Description to Element</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
        </div>
        <div>
          <strong>Selected Element:</strong>{' '}
          {selectedElement
            ? selectedElement.businessObject.name || selectedElement.id
            : 'None'}
        </div>
      </div>
    </div>
  );
}

export default CreateProcess;







//TODO: Instead of giving the opportunity to fill the blanks, implement pre-defined roles the user can choose
//TODO: make role and description requiered for each element to save the process
//TODO: change delete process => only user with permission should be able to delete processes