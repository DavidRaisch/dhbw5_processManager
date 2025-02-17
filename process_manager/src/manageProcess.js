// CreateProcess.js
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
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(''); // state for project assignment
  const bpmnModeler = useRef(null);
  const bpmnEditorRef = useRef(null);

  // Get logged in user from sessionStorage.
  const user = JSON.parse(sessionStorage.getItem('user'));
  
  // Define the role options the user can choose from.
  const roleOptions = ['Admin', 'Manager', 'Employee'];

  useEffect(() => {
    bpmnModeler.current = new BpmnModeler({
      container: bpmnEditorRef.current,
      additionalModules: [ customRules ],
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
    fetchAvailableProjects();

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

  // Helper function to validate that every element (except flows and process) has both a role and a description.
  const validateDiagram = () => {
    const elementRegistry = bpmnModeler.current.get('elementRegistry');
    const errors = [];

    elementRegistry.getAll().forEach((element) => {
      const bo = element.businessObject;
      if (bo) {
        // Exclude flows (SequenceFlow) and process elements from validation.
        if (bo.$type === 'bpmn:SequenceFlow' || bo.$type === 'bpmn:Process') {
          return;
        }
        const roleValue = (bo.role || bo['role:role'] || '').trim();
        if (roleValue === '') {
          errors.push(`${bo.name || element.id} is missing a role.`);
        }
        const descValue = (bo.description || '').trim();
        if (descValue === '') {
          errors.push(`${bo.name || element.id} is missing a description.`);
        }
      }
    });

    return errors;
  };

  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      setProcessList(response.data);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Fetch available projects for assignment.
  const fetchAvailableProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/projects');
      setAvailableProjects(response.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  // Save the entire diagram (including any role/description changes) along with the process name and selected project.
  const handleSaveToDatabase = () => {
    if (!processName) {
      alert('Please enter a process name.');
      return;
    }
    // Check if a project is selected
    if (!selectedProject) {
      alert('Please select a project.');
      return;
    }

    const errors = validateDiagram();
    if (errors.length > 0) {
      alert('Error: Not every element has a role and a description:\n' + errors.join('\n'));
      return;
    }

    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios
        .post('http://localhost:5001/api/processes', { name: processName, xml, project: selectedProject })
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
      setProcessName('');
      setSelectedElement(null);
      setRole('');
      setDescription('');
      setSelectedProject(''); // Reset project selection
    }).catch((err) => {
      console.error('Error creating new diagram:', err);
    });
  };

  // When loading a process, update the process name, reset role/description, and load its assigned project.
  const handleLoadProcess = (process) => {
    bpmnModeler.current
      .importXML(process.xml)
      .then(() => {
        setProcessName(process.name);
        setSelectedElement(null);
        setRole('');
        setDescription('');
        // If process.project exists, set selectedProject to its _id (if populated) or use it directly.
        setSelectedProject(process.project ? process.project._id || process.project : '');
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
      {/* Editor and Saved Processes */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid black', height: '400px', position: 'relative' }}>
          <div ref={bpmnEditorRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        <div style={{ width: '300px', border: '1px solid black', padding: '10px' }}>
          <h3>Saved Processes</h3>
          {processList.map((process) => (
            <div key={process._id} style={{ marginBottom: '10px' }}>
              <div>{process.name}</div>
              <div>
                <em>{process.project ? process.project.name : 'No Project'}</em>
              </div>
              <button onClick={() => handleLoadProcess(process)} style={{ marginRight: '5px' }}>
                Load
              </button>
              {/* Delete button visible only for Manager */}
              {user?.role === 'Manager' && (
                <button onClick={() => handleDeleteProcess(process._id)}>Delete</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Container with Process Information and Role/Description */}
      <div style={{ marginTop: '20px', border: '1px solid black', padding: '10px' }}>
        <h3>Process Information</h3>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Process Name"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          >
            <option value="">Select Project</option>
            {availableProjects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <button onClick={handleSaveToDatabase} style={{ padding: '5px 10px', marginRight: '10px' }}>
            Save to Database
          </button>
          <button onClick={handleCreateNewProcess} style={{ padding: '5px 10px' }}>
            Create New Process
          </button>
        </div>

        <h3>Assign Role and Description to Element</h3>
        <div style={{ marginBottom: '10px' }}>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          >
            <option value="">Select Role</option>
            {roleOptions.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
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
          {selectedElement ? (selectedElement.businessObject.name || selectedElement.id) : 'None'}
        </div>
      </div>
    </div>
  );
}

export default CreateProcess;









//TODO: change error message if no project is assigned
//TODO: change delete process => check if it shouldnt even be displayed for employees or if the should be able to request a deletion
//TODO: include a css file, to make the site more appealing

//** Additional */
//TODO: employee can only create request to create process => manager becomes notification and has to approve the process => only then the process really gets stored


/** Things to clear */
//TODO: does flows and process need a role and description? Do role and description have to be mandatory in general?
//TODO: should flows after gateways be requiered to be named?

//TODO: should the creating a new process be priveliged to some user?
//TODO: make creating a process procecss dependable on role of the user: Employer: needs permission from supervisior to create new process; Manager: can simply create a new Process