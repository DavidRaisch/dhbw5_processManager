// mongo-init.js
db = db.getSiblingDB("bpmn");

// Check if a user with username "admin" already exists
if (!db.users.findOne({ username: "admin" })) {
  db.users.insert({
    username: "admin",
    // This is an example bcrypt hash for the password "admin" using 10 rounds.
    password: "$2b$10$cg1dd/OKwHkbkasNq9b0M.fIVd1xDw/.qoz2Ujy.nzdYHaMJ/aCja",
    role: "Admin",
    projects: []
  });
}

  