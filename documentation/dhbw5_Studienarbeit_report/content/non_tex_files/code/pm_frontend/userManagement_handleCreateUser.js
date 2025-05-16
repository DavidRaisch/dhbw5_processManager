  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || newUser.projects.length === 0) {
      triggerAlert(
        'Missing Fields',
        'Username, Password and at least one project must be assigned'
      );
      return;
    }
    const uniqueProjects = [...new Set(newUser.projects)];
    try {
      await axios.post('http://localhost:5001/api/users', { ...newUser, projects: uniqueProjects });
      fetchUsers();
      setNewUser({ username: '', role: 'Employee', password: '', projects: [] });
      triggerAlert('Success', 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      triggerAlert('Error', 'Error creating user');
    }
  };