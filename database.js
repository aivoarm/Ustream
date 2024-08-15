// database.js

const sqlite3 = require('sqlite3').verbose();
const md5 = require('md5');

// Create a new SQLite database instance
let db = new sqlite3.Database('./data/db.sqlite', (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            email TEXT UNIQUE, 
            password TEXT, 
            spotify TEXT,
            CONSTRAINT email_unique UNIQUE (email)
        )`, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
                throw err;
            } else {
                console.log('Users table created successfully.');
                // Insert initial admin user data if the table was just created and no admin user exists
                checkAdminExists();
            }
        });
    }
});

// Function to check if an admin user already exists in the database
function checkAdminExists() {
    db.get('SELECT * FROM users WHERE role = "admin"', (err, row) => {
        if (err) {
            console.error('Error checking admin existence:', err.message);
        } else if (!row) {
            // Insert initial admin user if no admin exists
            addUser("admin", "admin", "aayvazy@gmail.com", process.env.ADMINPASS, "no");
        }
    });
}

// Function to add a new user to the database
function addUser(username, role, email, password) {
    return new Promise((resolve, reject) => {
        var insert = 'INSERT INTO users (username, role, email, password, spotify) VALUES (?, ?, ?, ?,?)';
        db.run(insert, [username, role, email, md5(password)], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Function to get a user by ID from the database
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Function to get a user by email from the database
function getUserByEmail(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Function to get all users from the database
function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM users', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Function to update user by ID
async function updateUserById(username, newData) {
    try {
        // Fetch existing user by ID
        const existingUser = await getUserById(username);

        if (existingUser) {
            // Update the user data with the new information
            const updatedUser = { ...existingUser, ...newData };

            // Update user data in the database
            await updateUserInDatabase(username, updatedUser);

            return updatedUser; // Return the updated user object
        } else {
            throw new Error('User not found'); // User with the provided ID does not exist
        }
    } catch (error) {
        throw new Error('Error updating user data: ' + error.message);
    }
}

// Function to update user data in the database
function updateUserInDatabase(userusernameId, updatedUserData) {
    return new Promise((resolve, reject) => {
        const { username, role, email, password, spotify } = updatedUserData;
        const updateQuery = 'UPDATE users SET username = ?, role = ?, email = ?, password = ?, spotify = ? WHERE username = ?';
        db.run(updateQuery, [username, role, email, md5(password), spotify], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

module.exports = { db, addUser, getUserById, getUserByEmail, getAllUsers, updateUserById, updateUserInDatabase };
