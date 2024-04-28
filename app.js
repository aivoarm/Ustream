
const functions = require('firebase-functions');
require('dotenv').config()

const express = require('express')
const expressLayouts = require('express-ejs-layouts')
const bodyParser = require('body-parser');
const session = require('express-session'); // Add session management

// require spotify-web-api-node package here:
const SpotifyWebApi = require('spotify-web-api-node')

// setting the spotify-api goes here:
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: 'http://localhost:5000/callback'
})

// Use session middleware
const app = express()
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Check if user is authenticated middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.accessToken) {
        spotifyApi.setAccessToken(req.session.accessToken);
        next();
    } else {
        res.redirect('/login');
    }
};

// Retrieve an access token
spotifyApi.clientCredentialsGrant()
    .then(data => spotifyApi.setAccessToken(data.body['access_token']))
    .catch(error => console.log('Something went wrong when retrieving an access token', error))

app.use(expressLayouts)
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')
app.set('views', __dirname + '/views')
app.use(express.static(__dirname + '/public'))


// Define routes for authentication
app.get('/login', (req, res) => {
    const scopes = ['user-read-recently-played', 'playlist-read-private']; // Scopes required for your app
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    res.redirect(authorizeURL);
});

app.get('/callback', (req, res) => {
    const { code } = req.query;
    spotifyApi.authorizationCodeGrant(code)
        .then(data => {
            const { access_token, refresh_token } = data.body;
            req.session.accessToken = access_token; // Store access token in session
            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);
            res.redirect('/'); // Redirect to home page after successful authentication
        })
        .catch(err => {
            console.log('Error authorizing user:', err);
            res.redirect('/login'); // Redirect back to login if authentication fails
        });
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/getDistinctArtists', isAuthenticated, (req, res) => {
    const playlistUrl = req.query.playlistUrl;
    const playlistId = getPlaylistIdFromUrl(playlistUrl); // Assuming you have a function to extract playlist ID

    if (!playlistId) {
        res.status(400).send('Invalid playlist URL');
        return;
    }

    spotifyApi.getPlaylistTracks(playlistId, { limit: 100 }) // Adjust limit as needed
        .then(data => {
            const tracks = data.body.items;
            const artistsMap = new Map(); // Use a Map to store detailed artist information

            tracks.forEach(track => {
                track.track.artists.forEach(artist => {
                    const artistId = artist.id;
                    const artistName = artist.name;

                    if (!artistsMap.has(artistId) && artistId) {
                        artistsMap.set(artistId, {
                            id: artistId, // Store artist ID for later use
                            name: artistName,
                            profileUrl: artist.external_urls.spotify,
                            imageUrl: '', // Placeholder for profile image URL
                            streamCount: 0 // Initialize stream count
                        });
                    }

                    if (artistId) {
                        artistsMap.get(artistId).streamCount++; // Increment stream count for the artist
                    }
                });
            });

            // Fetch detailed artist information including profile images
            const artistPromises = Array.from(artistsMap.values()).map(artistInfo => {
                if (artistInfo.id) {
                    return spotifyApi.getArtist(artistInfo.id)
                        .then(data => {
                            const imageUrl = data.body.images.length > 0 ? data.body.images[0].url : '';
                            artistInfo.imageUrl = imageUrl; // Update profile image URL
                        })
                        .catch(err => console.log('Error fetching artist details:', err));
                } else {
                    return Promise.resolve(); // Resolve with no action if artist ID is missing
                }
            });

            // Wait for all artist details to be fetched before rendering the view
            Promise.all(artistPromises)
                .then(() => {
                    const distinctArtists = Array.from(artistsMap.values());
                    res.render('distinctArtists', { distinctArtists: distinctArtists });
                })
                .catch(err => {
                    console.log('Error fetching artist details:', err);
                    res.status(500).send('Error fetching data');
                });
        })
        .catch(err => {
            console.log('Error getting playlist tracks:', err);
            res.status(500).send('Error fetching data');
        });
});


// Routes that require authentication
app.get('/step1', isAuthenticated, (req, res) => {
    // Fetch the user's liked playlists from Spotify API
    const likedPlaylists = []; // Extract the liked playlists from the response
   
        // Fetch the user's playlists from Spotify API
        spotifyApi.getUserPlaylists({ limit: 10 }) // Example limit of 10 playlists
            .then(data => {
                const playlists = data.body.items; // Extract the playlists from the response
               // console.log(playlists);
                res.render('step1', { likedPlaylists: playlists });
            })
            .catch(err => {
                console.log('Error getting playlists:', err);
                res.status(500).send('Error fetching data');
            });
    });
    

    function getPlaylistIdFromUrl(url) {
        const regex = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/;
        const match = url.match(regex);
    
        if (match && match.length > 1) {
            return match[1];
        } else {
            return null;
        }
    }
    

const moment = require('moment');

app.post('/myplaylist', (req, res) => {
    const today = moment().startOf('day'); // Get the start of the current day

    const playlistUrl = req.body.playlistUrl; // Assuming you're using body-parser middleware to parse form data
    const playlistId = getPlaylistIdFromUrl(playlistUrl); // Implement this function to extract the playlist ID from the URL

    spotifyApi.getMyRecentlyPlayedTracks({ limit: 50 })
        .then(recentlyPlayed => {
            const todayTracks = recentlyPlayed.body.items.filter(track => {
                const playedAtDate = moment(track.played_at);
                return playedAtDate.isSame(today, 'day');
            });

            const playlistPromise = spotifyApi.getPlaylist(playlistId, { market: 'US' });
            
            return Promise.all([todayTracks, playlistPromise]);
        })
        .then(([todayTracks, playlistData]) => {
            const playlist = playlistData.body;
            const playlistTrackIds = playlist.tracks.items.map(item => item.track.id);
            
            // Filter today's tracks to get only the ones that match tracks in the playlist
            const matchingTracks = todayTracks.filter(track => playlistTrackIds.includes(track.track.id));
            
            res.render('myplaylist', { recentTracks: todayTracks, playlist: playlist, matchingTracks: matchingTracks });
        })
        .catch(err => console.log('Error getting data:', err));
});


app.get('/artists', (req, res) => {
    if (req.query.artistName) {
        spotifyApi
        .searchArtists(req.query.artistName) 
        .then(data => {
            res.render('artist', {artists: data.body.artists.items});
        })
        .catch(err => console.log('The error while searching artists occurred: ', err));
    } else {
        spotifyApi
        .searchTracks(req.query.trackName) 
        .then(data => {
            console.log(data.body.tracks.items.map(track => track.artists));
            res.render('tracks', {tracks: data.body.tracks.items});
        })
        .catch(err => console.log('The error while searching artists occurred: ', err));
    }
});

app.get('/artists/:id', (req, res) => {
    spotifyApi
    .getArtist(req.params.id)
    .then(data => {
        res.render('artist', {artists: data.body.items});
    })
    .catch(err => console.log('The error while searching artists occurred: ', err));
});

app.get('/albums/:id', (req, res) => {
    spotifyApi
    .getArtistAlbums(req.params.id) 
    .then(data => {
        res.render('album', {albums: data.body.items});
    })
    .catch(err => console.log('The error while searching albums occurred: ', err));
  });

app.get('/tracks/:id', (req, res) => {
    spotifyApi
    .getAlbumTracks(req.params.id)
    .then(data => {
        console.log(data.body.items)
        res.render('tracks', {tracks: data.body.items});
    })
    .catch(err => console.log('The error while searching artists occurred: ', err));
});
  
app.get('/playlist/:id', (req, res) => {
    spotifyApi
    .getAlbumTracks(req.params.id)
    .then(data => {
        console.log(data.body.items)
        res.render('playlists', {tracks: data.body.items});
    })
    .catch(err => console.log('The error while searching artists occurred: ', err));
});

app.listen(5000, () => console.log('localhost:5000'))
