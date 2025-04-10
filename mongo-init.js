// mongo-init.js
db = db.getSiblingDB("bpmn");

// Check if a user with username "admin" already exists
if (!db.users.findOne({ username: "admin" })) {
  db.users.insert({
    username: "admin",
    // This is an example bcrypt hash for the password "admin" using 10 rounds.
    password: "$2a$10$DXnxxZ1ev1U1JfVgoeWlWeS71/4Gf/5Kci6JLfHfN5t9l4tKQq6PG",
    role: "Admin",
    projects: []
  });
}

  