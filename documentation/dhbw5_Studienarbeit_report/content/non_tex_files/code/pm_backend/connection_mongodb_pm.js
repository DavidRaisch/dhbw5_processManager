mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bpmn', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.error(err));