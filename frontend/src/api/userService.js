// frontend/src/api/userService.js
const AWS = require("aws-sdk");
const bcrypt = require("bcrypt");

AWS.config.update({ region: "ap-east-1" }); // Set your AWS region
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USER_PASSWORDS_TABLE = "user_passwords";
const SALT_ROUNDS = 10;

// Check if a user exists by username
async function checkUserExists(username) {
  const params = {
    TableName: USER_PASSWORDS_TABLE,
    Key: {
      username, // Only the Partition Key
    },
  };

  console.log("DynamoDB GetItem Params:", params); // Log parameters

  try {
    const result = await dynamoDB.get(params).promise();
    console.log("DynamoDB GetItem Result:", result); // Log result
    return !!result.Item; // Returns true if the user exists
  } catch (error) {
    console.error("Error in checkUserExists:", error); // Log error details
    throw new Error("Failed to check user existence");
  }
}

// Register a new user
async function registerUser(username, email, password) {
  const userExists = await checkUserExists(username);
  if (userExists) {
    throw new Error("Username already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const params = {
    TableName: USER_PASSWORDS_TABLE,
    Item: {
      username,                // Partition Key
      email,                   // Additional attribute
      password: passwordHash,  // Hashed password
    },
  };

  await dynamoDB.put(params).promise();
  return { success: true, message: "User registered successfully" };
}

// Verify user login
async function verifyUser(username, password) {
  const params = {
    TableName: USER_PASSWORDS_TABLE,
    Key: {
      username, // Only the Partition Key
    },
  };

  const result = await dynamoDB.get(params).promise();

  if (!result.Item) {
    throw new Error("Invalid username or password");
  }

  const passwordMatch = await bcrypt.compare(password, result.Item.password);

  if (!passwordMatch) {
    throw new Error("Invalid password");
  }

  return { success: true, message: "Login successful" };
}

module.exports = {
  registerUser,
  verifyUser,
};
