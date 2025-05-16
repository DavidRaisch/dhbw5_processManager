const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instance'},
  requestType: { type: String, enum: ['save','delete'], default: 'save' },
  requestedBy: { type: String, required: true },
  requestedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetRole: { type: String, enum: ['Admin', 'Manager', 'Employee'], default: 'Manager' },
  status: { type: String, enum: ['pending', 'approved', 'dismissed'], default: 'pending' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  processName: { type: String },
  xml: { type: String },
  processId: { type: mongoose.Schema.Types.ObjectId, ref: 'Process' }
});
const Notification = mongoose.model('Notification', notificationSchema);