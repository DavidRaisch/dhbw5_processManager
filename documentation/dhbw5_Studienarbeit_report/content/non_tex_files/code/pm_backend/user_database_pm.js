const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['Admin', 'Manager', 'Employee'] },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
});
const User = mongoose.model('User', userSchema);