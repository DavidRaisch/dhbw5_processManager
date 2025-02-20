import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { customExtension } from './customExtension';
import customRules from './customRules'; // our custom rules module
import TopNavBar from './navBar';
import './manageProcess.css';

function ManageProcess() {
  const navigate = useNavigate();
  const [processName, setProcessName] = useState('');
  const [processList, setProcessList] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const bpmnModeler = useRef(null);
  const bpmnEditorRef = useRef(null);

  // Get logged in user from sessionStorage.
  const user = JSON.parse(sessionStorage.getItem('user'));
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

  useEffect(() => {
    if (selectedElement) {
      const modeling = bpmnModeler.current.get('modeling');
      const elementRegistry = bpmnModeler.current.get('elementRegistry');
      const element = elementRegistry.get(selectedElement.id);
      modeling.updateProperties(element, { role, description });
    }
  }, [role, description, selectedElement]);

  const validateDiagram = () => {
    const elementRegistry = bpmnModeler.current.get('elementRegistry');
    const errors = [];
    elementRegistry.getAll().forEach((element) => {
      const bo = element.businessObject;
      if (bo) {
        if (bo.$type === 'bpmn:SequenceFlow' || bo.$type === 'bpmn:Process') return;
        const roleValue = (bo.role || bo['role:role'] || '').trim();
        if (roleValue === '') errors.push(`${bo.name || element.id} is missing a role.`);
        const descValue = (bo.description || '').trim();
        if (descValue === '') errors.push(`${bo.name || element.id} is missing a description.`);
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

  const fetchAvailableProjects = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/projects');
      setAvailableProjects(response.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleSaveToDatabase = () => {
    if (!processName) {
      alert('Please enter a process name.');
      return;
    }
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

  const handleCreateNewProcess = () => {
    bpmnModeler.current
      .createDiagram()
      .then(() => {
        setProcessName('');
        setSelectedElement(null);
        setRole('');
        setDescription('');
        setSelectedProject('');
      })
      .catch((err) => {
        console.error('Error creating new diagram:', err);
      });
  };

  const handleLoadProcess = (process) => {
    bpmnModeler.current
      .importXML(process.xml)
      .then(() => {
        setProcessName(process.name);
        setSelectedElement(null);
        setRole('');
        setDescription('');
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
    <>
    {/* Universal Top Navigation Bar */}
    <TopNavBar currentPage="Manage Process" />
    <div className="container-fluid bg-sidebar-grey" style={{ minHeight: '100vh'}}>
      <div className="row">
        {/* Left Sidebar: Saved Processes */}
        <div className="col-md-3 border-end pe-3 left-sidebar">
          <h5 className="mb-3">Saved Processes</h5>
          <div className="list-group">
            {processList.map((process) => (
              <div key={process._id} className="list-group-item mb-2">
                <div className="fw-bold">{process.name}</div>
                <div>
                  <em>{process.project ? process.project.name : 'No Project'}</em>
                </div>
                <div className="mt-2">
                  <button onClick={() => handleLoadProcess(process)} className="btn btn-sm btn-primary me-2">
                    Load
                  </button>
                  {user?.role === 'Manager' && (
                    <button onClick={() => handleDeleteProcess(process._id)} className="btn btn-sm btn-danger">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-md-9">
          {/* BPMN Editor */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">BPMN Editor</h5>
            </div>
            <div className="card-body p-0">
              <div ref={bpmnEditorRef} className="bpmn-editor-container"></div>
            </div>
          </div>

          {/* Process Information */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Process Information</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Process Name"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <select
                  className="form-select"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Select Project</option>
                  {availableProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <button onClick={handleSaveToDatabase} className="btn btn-primary me-2">
                  Save to Database
                </button>
                <button onClick={handleCreateNewProcess} className="btn btn-secondary">
                  Create New Process
                </button>
              </div>
            </div>
          </div>

          {/* Role & Description Assignment */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Assign Role and Description</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="">Select Role</option>
                  {roleOptions.map((option, index) => (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <strong>Selected Element:</strong>{' '}
                {selectedElement ? (selectedElement.businessObject.name || selectedElement.id) : 'None'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default ManageProcess;











//TODO delete button should ask if user really wants to delete the process

//** Additional */
//TODO: OPTIONAL: employee can only create request to create process => manager becomes notification and has to approve the process => only then the process really gets stored
//TODO: OPTIONAL: load xml file to create new process
//TODO: OPTIONAL: option to make process builder full screen


/** Things to clear */
//TODO: does flows and process need a role and description? Do role and description have to be mandatory in general?
//TODO: should flows after gateways be requiered to be named?

//TODO: should the creating a new process be priveliged to some user?
//TODO: make creating a process procecss dependable on role of the user: Employer: needs permission from supervisior to create new process; Manager: can simply create a new Process


/** for report */
// delete button isnt visible for employees, they can request the cancelation of active instances, but not the process att all