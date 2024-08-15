const express = require('express');
const router = express.Router();
const db = require('./database');

// Route handler for login page
router.get('/login', (req, res) => {
    res.render('admin/login');
});

// Route handler for login form submission
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username && password) {
        if (isValidCredentials(username, password)) {
            req.session.user = {
                username: username,
                role: getUserRole(username)
            };
            res.redirect('/admin/dashboard');
        } else {
            res.status(401).send('Invalid username or password');
        }
    } else {
        res.status(400).send('Username and password are required');
    }
});

// Middleware for checking admin role
const isAdmin = (req, res, next) => {
    console.log(req.session)

    if (req.session.user && req.session.user.role === 'admin') {
        next(); // User is an admin
    } else {
        res.redirect('/'); // Redirect non-admin users
    }
};

// Route handler for admin dashboard
router.get('/dashboard', isAdmin,(req, res) => {
    res.render('admin/dashboard');
});

// Route handler for managing users
router.get('/users', isAdmin, (req, res) => {
    db.getAllUsers()
        .then(users => {
            res.render('admin/users', { users });
        })
        .catch(err => {
            console.error('Error fetching users:', err);
            res.status(500).send('Internal Server Error');
        });
});

router.post('/add-user', isAdmin, (req, res) => {
    const { username, role } = req.body;

    db.insertUserData(username, role)
        .then(() => {
            res.redirect('/admin/users');
        })
        .catch(err => {
            console.error('Error adding user:', err);
            res.redirect('/admin/users');
        });
});

router.post('/edit-user', isAdmin, (req, res) => {
    const { username, role } = req.body;

    db.updateUserById(username, { username, role })
        .then(() => {
            res.redirect('/admin/users');
        })
        .catch(err => {
            console.error('Error updating user:', err);
            res.redirect('/admin/users');
        });
});

router.post('/delete-user', isAdmin, (req, res) => {
    const userId = req.body.userId;

    db.deleteUserById(username)
        .then(() => {
            res.redirect('/admin/users');
        })
        .catch(err => {
            console.error('Error deleting user:', err);
            res.redirect('/admin/users');
        });
});

module.exports = router;

// Example functions for validation and role retrieval
function isValidCredentials(username, password) {
    return (username === 'admin' && password === process.env.ADMINPASS);
}

function getUserRole(username) {
    return 'admin';
}
