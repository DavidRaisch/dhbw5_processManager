import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { customExtension } from './customExtension';
import customRules from './customRules'; // our custom rules module
import TopNavBar from './navBar';
import './manageProcess.css';
import { diffLines } from 'diff';

function ManageProcess() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Component states.
  const [processName, setProcessName] = useState('');
  const [processList, setProcessList] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  // New state to hold user projects.
  const [userProjects, setUserProjects] = useState([]);
  const [initialProcessName, setInitialProcessName] = useState('');
  const [initialSelectedProject, setInitialSelectedProject] = useState('');
  const [hasModelChanged, setHasModelChanged] = useState(false);
  const [hasUiChanged, setHasUiChanged] = useState(false);
  const [notificationId, setNotificationId] = useState(null);
  const [currentProcessId, setCurrentProcessId] = useState(null);
  const [originalXml, setOriginalXml] = useState('');
  const [proposedXml, setProposedXml] = useState('');
  const [diffText, setDiffText] = useState([]);
  const [showXmlDiff, setShowXmlDiff] = useState(false);
  const [changeItems, setChangeItems] = useState([]);
  const [originalProcessName, setOriginalProcessName] = useState('');
  const [originalProject, setOriginalProject] = useState('');
  const [requesterId, setRequesterId] = useState(null);
  const [requesterName, setRequesterName] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewType, setPreviewType] = useState(null);
  const [notifRequestType, setNotifRequestType] = useState(null);
  const [showDeletionApprovalModal, setShowDeletionApprovalModal] = useState(false);
  const [initialProps, setInitialProps] = useState({});
  
  // State for delete confirmation modal.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  
  // State for generic alert modal.
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  const bpmnModeler = useRef(null);
  const bpmnEditorRef = useRef(null);
  const initialXmlRef = useRef('');
  const initialPrettyXmlRef = useRef('');
  
  // Get logged in user from sessionStorage.
  const user = JSON.parse(sessionStorage.getItem('user'));
  const roleOptions = ['Admin', 'Manager', 'Employee'];
  
  // Helper function to trigger an alert modal.
  const triggerAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertModal(true);
  };
  
  // Fetch full user details (including projects) after mount.
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:5001/api/users/${user._id}`);
        // Save full projects objects in userProjects state.
        setUserProjects(response.data.projects || []);
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };
    fetchUserDetails();
  }, [user._id]);
  
  // Load notification request for manager
  useEffect(() => {
    if (location.state?.notificationId) {
      const notifId = location.state.notificationId;
      axios.get(`http://localhost:5001/api/notifications/${notifId}`)
        .then(res => {
          const notif = res.data;
          const type = notif.requestType || 'save';
          setNotifRequestType(type);
          setShowDeletionApprovalModal(type === 'delete');
          setProposedXml(notif.xml);
          setRequesterId(notif.requestedById);
          setRequesterName(notif.requestedBy);
          bpmnModeler.current.importXML(notif.xml)
            .then(async () => {
              const { xml } = await bpmnModeler.current.saveXML({ format: false });
              initialXmlRef.current = xml;
            })
            .then(recordInitialState)
            .then(() => {
              setProcessName(notif.processName || '');
              const proj = notif.project?._id || notif.project;
              setSelectedProject(proj);
              setInitialProcessName(notif.processName || '');
              setInitialSelectedProject(proj);
              setHasModelChanged(false);
              setHasUiChanged(false);
              setNotificationId(notifId);
              setCurrentProcessId(notif.processId);
              // Load original process XML for diff
              if (notif.processId) {
                axios.get(`http://localhost:5001/api/processes/${notif.processId}`)
                  .then(procRes => {
                    const orig = procRes.data.xml;
                    setOriginalXml(orig);
                    setOriginalProcessName(procRes.data.name);
                    const origProjId = typeof procRes.data.project === 'object' && procRes.data.project !== null
                      ? procRes.data.project._id
                      : procRes.data.project;
                    setOriginalProject(origProjId);
                    const diffs = diffLines(orig, notif.xml);
                    setDiffText(diffs);
                    let items = computeSimpleChanges(diffs);
                    // Process name change
                    if (procRes.data.name && processName && procRes.data.name !== processName) {
                      items.unshift(`Process name changed: '${procRes.data.name}' → '${processName}'`);
                    }
                    // Project change
                    if (origProjId && selectedProject && origProjId !== selectedProject) {
                      const oldProjName = availableProjects.find(p => p._id === origProjId)?.name || origProjId;
                      const newProjName = availableProjects.find(p => p._id === selectedProject)?.name || selectedProject;
                      items.unshift(`Project changed: '${oldProjName}' → '${newProjName}'`);
                    }
                    setChangeItems(items);
                    navigate(location.pathname, { replace: true });
                  })
                  .catch(err => console.error('Error fetching original process:', err));
              } else {
                // No original process to diff: clear state
                navigate(location.pathname, { replace: true });
              }
            });
        })
        .catch(err => console.error('Error loading notification:', err));
    }
  }, [location.state, navigate]);
  
  // Automatically compute and show diff when a notification is loaded
  useEffect(() => {
    if (notificationId && proposedXml) {
      const baseXml = originalXml || '';
      const diffs = diffLines(baseXml, proposedXml);
      setDiffText(diffs);
      let items = computeSimpleChanges(diffs);
      // Process name change
      if (originalProcessName && processName && originalProcessName !== processName) {
        items.unshift(`Process name changed: '${originalProcessName}' → '${processName}'`);
      }
      // Project change
      if (originalProject && selectedProject && originalProject !== selectedProject) {
        const oldProjName = availableProjects.find(p => p._id === originalProject)?.name || originalProject;
        const newProjName = availableProjects.find(p => p._id === selectedProject)?.name || selectedProject;
        items.unshift(`Project changed: '${oldProjName}' → '${newProjName}'`);
      }
      setChangeItems(items);
    }
  }, [notificationId, originalXml, proposedXml, processName, selectedProject, originalProcessName, originalProject, availableProjects]);
  
  // Initialize BPMN modeler and fetch processes & available projects.
  useEffect(() => {
    bpmnModeler.current = new BpmnModeler({
      container: bpmnEditorRef.current,
      additionalModules: [customRules],
      moddleExtensions: {
        role: customExtension
      }
    });
  
    bpmnModeler.current.createDiagram()
      .then(async () => {
        const { xml } = await bpmnModeler.current.saveXML({ format: false });
        initialXmlRef.current = xml;
      })
      .then(recordInitialState)
      .then(() => {
        setProcessName('');
        setSelectedElement(null);
        setRole('');
        setDescription('');
        setSelectedProject('');
        setInitialProcessName('');
        setInitialSelectedProject('');
        setCurrentProcessId(null);
        const stack = bpmnModeler.current.get('commandStack');
        stack.clear();
        setHasModelChanged(false);
        setHasUiChanged(false);
      })
      .catch((err) => {
        console.error('Error creating new diagram:', err);
        triggerAlert('Error', 'An error occurred while creating a new process.');
      });
    // Restore element selection and change detection
    bpmnModeler.current.on('element.click', (event) => {
      const element = event.element;
      setSelectedElement(element);
      const businessObject = element.businessObject;
      const loadedRole = businessObject['role:role'] || businessObject.role || '';
      setRole(loadedRole);
      setDescription(businessObject.description || '');
    });
    const eventBus = bpmnModeler.current.get('eventBus');
    eventBus.on('commandStack.changed', async () => {
      const { xml: currentXml } = await bpmnModeler.current.saveXML({ format: false });
      setHasModelChanged(currentXml !== initialXmlRef.current);
    });

    // Only fetch processes after userProjects is loaded.
    // We also fetch available projects.
    fetchAvailableProjects();
    
    return () => {
      bpmnModeler.current.destroy();
    };
  }, []);
  
  // Whenever userProjects or processes are updated, fetch processes so filtering can take place.
  useEffect(() => {
    if (userProjects.length > 0) {
      fetchProcesses();
    }
  }, [userProjects]);
  
  // Update fetchProcesses to filter saved processes by user's projects.
  const fetchProcesses = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/processes');
      
      // Debug: log userProjects for verification.
      console.log("User projects:", userProjects);
      
      const filteredProcesses = response.data.filter(proc => {
        if (!proc.project) return false;
        // Extract the process project id, handling object or string.
        const procProjectId = typeof proc.project === 'object' && proc.project !== null 
          ? proc.project._id 
          : proc.project;
        // Check if this process's project id is in the user's projects.
        const isMatch = userProjects.some(p => p._id === procProjectId);
        console.log(`Process "${proc.name}" with project id: ${procProjectId}. Match: ${isMatch}`);
        return isMatch;
      });
      setProcessList(filteredProcesses);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  // Load latest version of a process before manual load
  const loadProcessLatest = async (id) => {
    try {
      // Optional: refresh process list
      await fetchProcesses();
      // Fetch single process by id
      const response = await axios.get(`http://localhost:5001/api/processes/${id}`);
      handleLoadProcess(response.data);
    } catch (err) {
      console.error('Error loading process:', err);
      triggerAlert('Error', 'Fehler beim Laden des Prozesses.');
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
  
  // Check if a processId was passed via location.state (from a notification)
  useEffect(() => {
    if (location.state && location.state.processId) {
      const processId = location.state.processId;
      axios.get(`http://localhost:5001/api/processes/${processId}`)
        .then(response => {
          const proc = response.data;
          handleLoadProcess(proc);
          // Clear location state so that reloading doesn't re-load the process.
          navigate(location.pathname, { replace: true });
        })
        .catch(err => console.error("Error loading process from notification:", err));
    }
  }, [location.state, navigate]);
  
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
  
  const requestProcess = () => {
    // For employees: request permission to save process
    if (!processName) {
      triggerAlert('Missing Process Name', 'Please enter a process name.');
      return;
    }
    if (!selectedProject) {
      triggerAlert('Missing Project', 'Please select a project.');
      return;
    }
    const errors = validateDiagram();
    if (errors.length > 0) {
      triggerAlert('Validation Error', 'The following errors occurred:\n' + errors.join('\n'));
      return;
    }
    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      // prepare notification payload for manager
      const notificationPayload = {
        message: `Employee ${user.username} requested permission to save process "${processName}".`,
        instanceId: null,
        requestedBy: user.username,
        requestedById: user._id,
        targetRole: 'Manager',
        status: 'pending',
        project: selectedProject,
        processName: processName,
        processId: currentProcessId,
        xml
      };
      console.log('requestProcess payload:', notificationPayload);
      axios.post('http://localhost:5001/api/notifications', notificationPayload)
        .then(() => {
          triggerAlert('Success', 'Request sent to Manager.');
        }).catch(err => {
          // Show detailed error from server if available
          console.error('Error sending request:', err.response?.data || err);
          const errorMsg = err.response?.data?.error || err.message || 'Error sending request.';
          triggerAlert('Error', `Request failed: ${errorMsg}`);
        });
    });
  };

  const requestDeletion = async (processId) => {
    try {
      const res = await axios.get(`http://localhost:5001/api/processes/${processId}`);
      const proc = res.data;
      const payload = {
        message: `Employee ${user.username} requested deletion of process "${proc.name}".`,
        instanceId: null,
        requestedBy: user.username,
        requestedById: user._id,
        targetRole: 'Manager',
        status: 'pending',
        project: proc.project,
        processName: proc.name,
        processId: proc._id,
        xml: proc.xml,
        requestType: 'delete',
      };
      await axios.post('http://localhost:5001/api/notifications', payload);
      triggerAlert('Success', 'Deletion request sent to Manager.');
    } catch (err) {
      console.error('Error sending deletion request:', err.response?.data || err);
      const errorMsg = err.response?.data?.error || err.message || 'Error sending deletion request.';
      triggerAlert('Error', `Request failed: ${errorMsg}`);
    }
  };

  const handleSaveToDatabase = () => {
    if (user.role === 'Employee') {
      requestProcess();
      return;
    }
    if (!processName) {
      triggerAlert('Missing Process Name', 'Please enter a process name.');
      return;
    }
    if (!selectedProject) {
      triggerAlert('Missing Project', 'Please select a project.');
      return;
    }
    const errors = validateDiagram();
    if (errors.length > 0) {
      triggerAlert('Validation Error', 'The following errors occurred:\n' + errors.join('\n'));
      return;
    }
    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios
        .post('http://localhost:5001/api/processes', { name: processName, xml, project: selectedProject })
        .then((response) => {
          triggerAlert('Success', response.data.message);
          fetchProcesses();
          // Reset baseline after save
          bpmnModeler.current.saveXML({ format: false }).then(({ xml: newXml }) => {
            initialXmlRef.current = newXml;
            setHasModelChanged(false);
            setHasUiChanged(false);
          });
          // --- New Notification Logic ---
          // If current user is an employee, send a notification to managers.
          if (user.role === 'Employee') {
            axios.post('http://localhost:5001/api/notifications', {
              message: `Employee ${user.username} created a new process "${processName}".`,
              instanceId: null,
              requestedBy: user.username,
              requestedById: user._id,
              targetRole: 'Manager',
              status: 'pending',
              project: selectedProject
            }).catch(err => {
              console.error('Error sending notification:', err);
            });
          }
          // Manager approving notification: after save, clear notification
          const notify = () => {
            if (notificationId) {
              axios.delete(`http://localhost:5001/api/notifications/${notificationId}`)
                .catch(err => console.error('Error deleting notification:', err));
              setNotificationId(null);
            }
          };
          notify();
        })
        .catch((err) => {
          console.error('Error saving process:', err);
          triggerAlert('Error', 'An error occurred while saving the process.');
        });
    });
  };
  
  const handleCreateNewProcess = () => {
    bpmnModeler.current
      .createDiagram()
      .then(async () => {
        const { xml } = await bpmnModeler.current.saveXML({ format: false });
        initialXmlRef.current = xml;
      })
      .then(recordInitialState)
      .then(() => {
        setProcessName('');
        setSelectedElement(null);
        setRole('');
        setDescription('');
        setSelectedProject('');
        setInitialProcessName('');
        setInitialSelectedProject('');
        setCurrentProcessId(null);
        const stack = bpmnModeler.current.get('commandStack');
        stack.clear();
        setHasModelChanged(false);
        setHasUiChanged(false);
      })
      .catch((err) => {
        console.error('Error creating new diagram:', err);
        triggerAlert('Error', 'An error occurred while creating a new process.');
      });
  };
  
  const handleLoadProcess = (process) => {
    // Clear review/notification UI on manual load
    setNotificationId(null);
    setShowXmlDiff(false);
    setDiffText([]);
    setChangeItems([]);
    setOriginalXml('');
    setProposedXml('');
    bpmnModeler.current
      .importXML(process.xml)
      .then(async () => {
        const { xml } = await bpmnModeler.current.saveXML({ format: false });
        initialXmlRef.current = xml;
      })
      .then(recordInitialState)
      .then(() => {
        setProcessName(process.name);
        setSelectedElement(null);
        setRole('');
        setDescription('');
        const projId = process.project ? (typeof process.project === 'object' ? process.project._id : process.project) : '';
        setSelectedProject(projId);
        setInitialProcessName(process.name);
        setInitialSelectedProject(projId);
        setCurrentProcessId(process._id);
        const stack = bpmnModeler.current.get('commandStack');
        stack.clear();
        setHasModelChanged(false);
        setHasUiChanged(false);
      })
      .catch((err) => {
        console.error('Error loading process:', err);
        triggerAlert('Error', 'An error occurred while loading the process.');
      });
  };
  
  const handleDeleteProcess = (id) => {
    axios
      .delete(`http://localhost:5001/api/processes/${id}`)
      .then(() => {
        triggerAlert('Success', 'Process deleted');
        fetchProcesses();
      })
      .catch((err) => {
        console.error('Error deleting process:', err);
        triggerAlert('Error', 'An error occurred while deleting the process.');
      });
  };
  
  const confirmDelete = () => {
    if (processToDelete) {
      handleDeleteProcess(processToDelete);
      setProcessToDelete(null);
    }
    setShowDeleteModal(false);
  };
  
  // Custom function to get the label for the project dropdown.
  const getSelectedProjectLabel = () => {
    if (!selectedProject) return 'Select Project';
    const found = availableProjects.find(proj => proj._id === selectedProject);
    return found ? found.name : 'Select Project';
  };
  
  // Helper to summarize diffs into friendly change descriptions
  const computeSimpleChanges = (diffs) => {
    const items = [];
    for (let i = 0; i < diffs.length;) {
      const part = diffs[i];
      // Changed element attributes
      if (part.removed && i + 1 < diffs.length && diffs[i+1].added) {
        const oldVal = part.value.trim();
        const newVal = diffs[i+1].value.trim();
        const tagMatch = oldVal.match(/^<\s*([^\s>]+)/);
        const tagName = tagMatch ? tagMatch[1] : 'Element';
        const oldAttrs = {};
        oldVal.replace(/([a-zA-Z0-9_:]+)="([^"]*)"/g, (_, k, v) => { oldAttrs[k] = v; });
        const newAttrs = {};
        newVal.replace(/([a-zA-Z0-9_:]+)="([^"]*)"/g, (_, k, v) => { newAttrs[k] = v; });
        const id = oldAttrs.id || oldAttrs.name || '';
        Object.keys({ ...oldAttrs, ...newAttrs }).forEach(attr => {
          const o = oldAttrs[attr], n = newAttrs[attr];
          if (o !== undefined && n !== undefined && o !== n) {
            items.push(`${tagName} ${id}: attribute ${attr} changed: '${o}' → '${n}'`);
          } else if (o !== undefined && n === undefined) {
            items.push(`${tagName} ${id}: attribute ${attr} removed`);
          } else if (o === undefined && n !== undefined) {
            items.push(`${tagName} ${id}: attribute ${attr} added: '${n}'`);
          }
        });
        i += 2;
      // New element added
      } else if (part.added) {
        const newVal = part.value.trim();
        const tagMatch = newVal.match(/^<\s*([^\s>]+)/);
        const tagName = tagMatch ? tagMatch[1] : 'Element';
        const attrs = {};
        newVal.replace(/([a-zA-Z0-9_:]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
        const id = attrs.id || attrs.name || '';
        items.push(`${tagName} ${id} added`);
        i++;
      // Element removed entirely
      } else if (part.removed) {
        const oldVal = part.value.trim();
        const tagMatch = oldVal.match(/^<\s*([^\s>]+)/);
        const tagName = tagMatch ? tagMatch[1] : 'Element';
        const attrs = {};
        oldVal.replace(/([a-zA-Z0-9_:]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
        const id = attrs.id || attrs.name || '';
        items.push(`${tagName} ${id} removed`);
        i++;
      } else {
        i++;
      }
    }
    return items;
  };

  // Record initial role and description of elements
  const recordInitialProps = () => {
    const registry = bpmnModeler.current.get('elementRegistry');
    const propsMap = {};
    registry.getAll().forEach(el => {
      const bo = el.businessObject;
      propsMap[el.id] = {
        role: bo['role:role'] || bo.role || '',
        description: bo.description || ''
      };
    });
    setInitialProps(propsMap);
  };

  // Record initial formatted XML and role/description props
  const recordInitialState = async () => {
    const { xml } = await bpmnModeler.current.saveXML({ format: true });
    initialPrettyXmlRef.current = xml;
    recordInitialProps();
  };

  // Preview changes before save or request
  const handlePreviewChanges = async (type) => {
    if (!processName) {
      triggerAlert('Missing Process Name', 'Please enter a process name.');
      return;
    }
    if (!selectedProject) {
      triggerAlert('Missing Project', 'Please select a project.');
      return;
    }
    const errors = validateDiagram();
    if (errors.length > 0) {
      triggerAlert('Validation Error', 'The following errors occurred:\n' + errors.join('\n'));
      return;
    }
    const { xml } = await bpmnModeler.current.saveXML({ format: true });
    const baseXml = initialPrettyXmlRef.current || '';
    const diffs = diffLines(baseXml, xml);
    setDiffText(diffs);
    let items = computeSimpleChanges(diffs);
    // Process name change
    if (initialProcessName && processName && initialProcessName !== processName) {
      items.unshift(`Process name changed: '${initialProcessName}' → '${processName}'`);
    }
    // Project change
    if (initialSelectedProject && selectedProject && initialSelectedProject !== selectedProject) {
      const oldProjName = availableProjects.find(p => p._id === initialSelectedProject)?.name || initialSelectedProject;
      const newProjName = availableProjects.find(p => p._id === selectedProject)?.name || selectedProject;
      items.unshift(`Project changed: '${oldProjName}' → '${newProjName}'`);
    }
    setChangeItems(items);
    setPreviewType(type);
    setShowPreviewModal(true);
  };
  
  // Manager approves request
  const handleApproveRequest = () => {
    bpmnModeler.current.saveXML({ format: true }).then(({ xml }) => {
      axios.post('http://localhost:5001/api/processes', { name: processName, xml, project: selectedProject })
        .then(() => {
          // notify employee
          axios.post('http://localhost:5001/api/notifications', {
            message: `Manager ${user.username} has approved your request to save process "${processName}".`,
            instanceId: null,
            requestedBy: user.username,
            requestedById: user._id,
            targetRole: 'Employee',
            status: 'approved',
            project: selectedProject,
            processName,
            processId: currentProcessId,
            xml
          });
          // delete original notification
          if (requesterId) axios.delete(`http://localhost:5001/api/notifications/${notificationId}`);
          triggerAlert('Success', 'Request approved and process saved');
          setNotificationId(null);
        })
        .catch(err => { console.error(err); triggerAlert('Error', 'Error approving request.'); });
    });
  };
  // Manager denies request
  const handleDenyRequest = () => {
    // delete original notification
    axios.delete(`http://localhost:5001/api/notifications/${notificationId}`)
      .then(() => {
        // notify employee with original XML for proper loading
        axios.post('http://localhost:5001/api/notifications', {
          message: `Manager ${user.username} has denied your request to save process "${processName}".`,
          instanceId: null,
          requestedBy: user.username,
          requestedById: user._id,
          targetRole: 'Employee',
          status: 'dismissed',
          project: selectedProject,
          processName,
          processId: currentProcessId,
          xml: originalXml
        });
        triggerAlert('Denied', 'Request denied');
        setNotificationId(null);
      })
      .catch(err => { console.error(err); triggerAlert('Error', 'Error denying request.'); });
  };

  const handleApproveDeletion = () => {
    axios.delete(`http://localhost:5001/api/processes/${currentProcessId}`)
      .then(() => {
        // notify employee
        axios.post('http://localhost:5001/api/notifications', {
          message: `Manager ${user.username} approved your deletion request for process "${processName}".`,
          instanceId: null,
          requestedBy: user.username,
          requestedById: user._id,
          targetRole: 'Employee',
          status: 'approved',
          project: selectedProject,
          processName,
          processId: currentProcessId,
        });
        if (notificationId) axios.delete(`http://localhost:5001/api/notifications/${notificationId}`);
        triggerAlert('Success', 'Request approved and process deleted');
        setNotificationId(null);
        setCurrentProcessId(null);
      })
      .catch(err => {
        console.error(err);
        triggerAlert('Error', 'Error deleting process.');
      });
  };

  const handleDenyDeletion = () => {
    // notify employee
    axios.post('http://localhost:5001/api/notifications', {
      message: `Manager ${user.username} denied your deletion request for process "${processName}".`,
      instanceId: null,
      requestedBy: user.username,
      requestedById: user._id,
      targetRole: 'Employee',
      status: 'denied',
      project: selectedProject,
      processName,
      processId: currentProcessId,
    });
    if (notificationId) axios.delete(`http://localhost:5001/api/notifications/${notificationId}`);
    triggerAlert('Denied', 'Request denied');
    setNotificationId(null);
    setCurrentProcessId(null);
  };

  return (
    <>
      {/* Universal Top Navigation Bar */}
      <TopNavBar currentPage="Manage Process" />
      <div className="container-fluid bg-sidebar-grey" style={{ minHeight: '100vh' }}>
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
                    <button onClick={() => loadProcessLatest(process._id)} className="btn btn-sm btn-primary me-2">
                      Load
                    </button>
                    {user?.role === 'Employee' && (
                      <button
                        onClick={() => requestDeletion(process._id)}
                        className="btn btn-sm btn-danger me-2"
                      >
                        Request Deletion
                      </button>
                    )}
                    {user?.role === 'Manager' && (
                      <button
                        onClick={() => { setProcessToDelete(process._id); setShowDeleteModal(true); }}
                        className="btn btn-sm btn-danger"
                      >
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setProcessName(val);
                      setHasUiChanged(val !== initialProcessName || selectedProject !== initialSelectedProject);
                    }}
                  />
                </div>
                <div className="mb-3">
                  {/* Custom Bootstrap Dropdown for Project Selection */}
                  <div className="dropdown">
                    <button 
                      className="form-control dropdown-toggle custom-dropdown" 
                      type="button" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false"
                    >
                      {getSelectedProjectLabel()}
                    </button>
                    <ul className="dropdown-menu w-100">
                      {availableProjects.map((project) => (
                        <li key={project._id}>
                          <button className="dropdown-item" onClick={() => {
                            setSelectedProject(project._id);
                            setHasUiChanged(processName !== initialProcessName || project._id !== initialSelectedProject);
                          }}>
                            {project.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-3">
                  {notificationId && user.role === 'Manager' && notifRequestType === 'save' && (
                    <>
                      <button onClick={handleApproveRequest} className="btn btn-success me-2">Approve Request</button>
                      <button onClick={handleDenyRequest} className="btn btn-danger">Deny Request</button>
                    </>
                  )}
                  {notificationId && user.role === 'Manager' && notifRequestType === 'delete' && !showDeletionApprovalModal && (
                    <>
                      <button onClick={() => handleApproveDeletion()} className="btn btn-success me-2">Approve Deletion</button>
                      <button onClick={() => handleDenyDeletion()} className="btn btn-danger">Deny Deletion</button>
                    </>
                  )}
                  {!notificationId && (
                    <button
                      onClick={() => handlePreviewChanges(user.role === 'Employee' ? 'request' : 'save')}
                      disabled={!(hasModelChanged || hasUiChanged)}
                      className="btn btn-primary me-2"
                    >
                      {user.role === 'Employee' ? 'Request Save' : 'Save to Database'}
                    </button>
                  )}
                  <button onClick={handleCreateNewProcess} className="btn btn-secondary">
                    Create New Process
                  </button>
                  {notificationId && diffText.length > 0 && (
                    <button onClick={() => setShowXmlDiff(!showXmlDiff)} className="btn btn-outline-secondary ms-2">
                      {showXmlDiff ? 'Hide XML' : 'Show XML'}
                    </button>
                  )}
                </div>
                {notificationId && (
                  <div className="change-list-panel mt-3" style={{ maxHeight: '300px', overflow: 'auto', background: '#e9ecef', padding: '10px' }}>
                    {changeItems.length > 0 ? (
                      <ul>
                        {changeItems.map((item, idx) => (<li key={idx}>{item}</li>))}
                      </ul>
                    ) : (
                      <p>No changes detected.</p>
                    )}
                  </div>
                )}
                {showXmlDiff && (
                  <div className="xml-diff-panel mt-2" style={{ maxHeight: '200px', overflow: 'auto', background: '#f8f9fa', padding: '10px' }}>
                    {diffText.map((part, i) => (
                      <span key={i} style={{ color: part.added ? 'green' : part.removed ? 'red' : 'black' }}>
                        {part.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Role & Description Assignment */}
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Assign Role and Description</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  {/* Custom Bootstrap Dropdown for Role Selection */}
                  <div className="dropdown">
                    <button 
                      className="form-control dropdown-toggle custom-dropdown" 
                      type="button" 
                      data-bs-toggle="dropdown" 
                      aria-expanded="false"
                    >
                      {role || 'Select Role'}
                    </button>
                    <ul className="dropdown-menu w-100">
                      {roleOptions.map((option, index) => (
                        <li key={index}>
                          <button className="dropdown-item" onClick={() => {
                            setRole(option);
                            const modeling = bpmnModeler.current.get('modeling');
                            const elementRegistry = bpmnModeler.current.get('elementRegistry');
                            const element = elementRegistry.get(selectedElement.id);
                            modeling.updateProperties(element, { role: option });
                          }}>
                            {option}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Description"
                    value={description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDescription(val);
                      const modeling = bpmnModeler.current.get('modeling');
                      const elementRegistry = bpmnModeler.current.get('elementRegistry');
                      const element = elementRegistry.get(selectedElement.id);
                      modeling.updateProperties(element, { description: val });
                    }}
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

      {/* Delete Confirmation Modal */}
      <div className={`modal fade ${showDeleteModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Delete</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this process?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && <div className="modal-backdrop fade show"></div>}
  
      {/* Generic Alert Modal */}
      <div className={`modal fade ${showAlertModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{alertTitle}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowAlertModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{alertMessage}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowAlertModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAlertModal && <div className="modal-backdrop fade show"></div>}
  
      {/* Deletion Approval Modal */}
      <div className={`modal fade ${showDeletionApprovalModal ? "show d-block" : ""}`} tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Deletion Request</h5>
              <button type="button" className="btn-close" onClick={() => setShowDeletionApprovalModal(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p>Do you want to approve deletion of process "{processName}"?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary me-2" onClick={() => setShowDeletionApprovalModal(false)}>Show Process</button>
              <button type="button" className="btn btn-success" onClick={() => { handleApproveDeletion(); setShowDeletionApprovalModal(false); }}>Approve</button>
              <button type="button" className="btn btn-danger" onClick={() => { handleDenyDeletion(); setShowDeletionApprovalModal(false); }}>Deny</button>
            </div>
          </div>
        </div>
      </div>
      {showDeletionApprovalModal && <div className="modal-backdrop fade show"></div>}
  
      {/* Preview Changes Modal */}
      {showPreviewModal && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Preview Changes</h5>
                <button type="button" className="btn-close" onClick={() => setShowPreviewModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="change-list-panel mb-3" style={{ maxHeight: '200px', overflow: 'auto', background: '#e9ecef', padding: '10px' }}>
                  {changeItems.length > 0 ? (
                    <ul>{changeItems.map((item, idx) => (<li key={idx}>{item}</li>))}</ul>
                  ) : (
                    <p>No changes detected.</p>
                  )}
                </div>
                <div className="xml-diff-panel" style={{ maxHeight: '300px', overflow: 'auto', background: '#f8f9fa', padding: '10px' }}>
                  {diffText.map((part, i) => (
                    <span key={i} style={{ color: part.added ? 'green' : part.removed ? 'red' : 'black' }}>
                      {part.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={() => {
                  setShowPreviewModal(false);
                  if (previewType === 'request') {
                    requestProcess();
                  } else {
                    handleSaveToDatabase();
                  }
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPreviewModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
}

export default ManageProcess;

//TODO: Employee cant create processes => only required processes to create and also cant modify processes => only request modifications => DONE
//TODO: Manager gets Info on modifications


//** Additional */
//TODO: OPTIONAL: load xml file to create new process
//TODO: OPTIONAL: option to make process builder full screen
//TODO: OPTIONAL: make description of flows after Gateway requiered


/** Things to clear */
//does flows and process need a role and description? Do role and description have to be mandatory in general?
//should flows after gateways be requiered to be named?

//should the creating a new process be priveliged to some user?
//make creating a process dependable on role of the user: Employer: needs permission from supervisior to create new process; Manager: can simply create a new Process