
const functions = require('firebase-functions');
require('dotenv').config()

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const session = require('express-session');
const adminRouter = require('./admin');
const SpotifyWebApi = require('spotify-web-api-node');
const db = require('./database'); // Import SQLite database module
const app = express();

// Setting up Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: 'http://localhost:5000/callback'
});

spotifyApi.clientCredentialsGrant()
    .then(data => spotifyApi.setAccessToken(data.body['access_token']))
    .catch(error => console.log('Something went wrong when retrieving an access token', error));

app.use(expressLayouts);
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Set your desired expiration time
}));

app.use('/admin', adminRouter);

// Middleware for checking authentication
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next(); // User is authenticated
    } else {
        res.redirect('/login'); // Redirect to login page if not authenticated
    }
};

// Route handler for home page
app.get('/', isAuthenticated, (req, res) => {
    res.render('index', { user: req.session.user });
});

// Route handler for login page
app.get('/login', (req, res) => {
    res.render('login');
});


// Route handler for login page
app.get('/auth/spotify', (req, res) => {
    const scopes = ['user-read-recently-played', 'playlist-read-private']; // Scopes required for your app
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);

    res.redirect(authorizeURL);
});


// Route handler for login form submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username && password) {
        if (isValidCredentials(username, password)) {
            req.session.user = {
                username: username,
                role: getUserRole(username)
            };
            res.redirect('/');
        } else {
            res.status(401).send('Invalid username or password');
        }
    } else {
        res.status(400).send('Username and password are required');
    }
});



// Route handler for logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error logging out:', err);
        }
        res.redirect('/');
    });
});


app.get('/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token } = data.body;

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        const userData = await spotifyApi.getMe();
        const userId = userData.body.id;

        // Check if the user exists in your database
        // If not, add the user to the database
        const existingUser = await db.getUserByEmail(userId);

        if (!existingUser) {
            await db.addUser(userId, "user", "tmp@email", 'your_default_password');
        }

        // Get user data from your database after adding/updating the user
        const userFromDB = await db.getUserByEmail(userId);

        // Fetch user's public playlists
        const playlistsData = await spotifyApi.getUserPlaylists(userId, { limit: 10, offset: 0 });
        const playlists = playlistsData.body.items; // Extract the playlists from the response

        // Redirect or render a page with user data and playlists
        res.render('index', { user: userFromDB, displayName: userData.body.display_name, userEmail: userData.body.email, publicPlaylists: playlists });
   
    } catch (err) {
        console.error('Error retrieving user data:', err);
        res.status(500).send('Error retrieving user data');
    }
});




//////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////v/////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/admin/playlists', isAuthenticated, (req, res) => {
    // Display playlists and options for admins
    res.render('admin/playlists');
});

app.post('/admin/playlists/create', isAuthenticated, (req, res) => {
    // Create a new playlist based on form data
    const { playlistName } = req.body;
    // Use Spotify API to create the playlist
    spotifyApi.createPlaylist(req.session.userId, playlistName)
        .then(data => {
            // Handle successful playlist creation
            res.redirect('/admin/playlists');
        })
        .catch(err => {
            console.log('Error creating playlist:', err);
            res.redirect('/admin/playlists');
        });
});

app.post('/admin/playlists/:playlistId/add', isAuthenticated, (req, res) => {
    // Add a song to a playlist based on form data
    const { playlistId, songLink } = req.body;
    // Use Spotify API to add the song to the playlist
    spotifyApi.addTracksToPlaylist(playlistId, [songLink])
        .then(data => {
            // Handle successful song addition
            res.redirect('/admin/playlists');
        })
        .catch(err => {
            console.log('Error adding song to playlist:', err);
            res.redirect('/admin/playlists');
        });
});


app.get('/artist/requests', isAuthenticated, (req, res) => {
    // Display form for artists to request song additions
    res.render('artist/requests');
});

app.post('/artist/requests/add', isAuthenticated, (req, res) => {
    // Process artist's song addition request
    const { playlistId, songLink } = req.body;
    // Check if artist already has a song in the playlist
    // If not, use Spotify API to add the song to the playlist
    // Handle success and error cases
    res.redirect('/artist/requests');
});

app.get('/user/playlists', isAuthenticated, (req, res) => {
    // Display playlists for users to choose from
    res.render('user/playlists');
});

app.get('/user/playlists/:playlistId', isAuthenticated, (req, res) => {
    // Display songs in the selected playlist for users to play
    const { playlistId } = req.params;
    // Use Spotify API to get playlist details and songs
    // Render playlist details and songs in the view
    res.render('user/playlist', { playlistId });
});


app.listen(5000, () => console.log('http://localhost:5000'))

// Example functions for validation and role retrieval
function isValidCredentials(username, password) {
    return (username === 'admin' && password === process.env.ADMINPASS);
}

function getUserRole(username) {
    return 'user';
}


function getPlaylistIdFromUrl(url) {
    const regex = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/;
    const match = url.match(regex);

    if (match && match.length > 1) {
        return match[1];
    } else {
        return null;
    }
}

