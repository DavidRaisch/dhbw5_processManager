import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api'; // Backend-URL

// Prozesse abrufen
export const fetchProcesses = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/processes`);
    return response.data;
  } catch (error) {
    console.error('Fehler beim Abrufen der Prozesse:', error);
    throw error;
  }
};

// Neuen Prozess speichern
export const saveProcess = async (process) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/processes`, process);
    return response.data;
  } catch (error) {
    console.error('Fehler beim Speichern des Prozesses:', error);
    throw error;
  }
};
