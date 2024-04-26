require('dotenv').config()

const express = require('express')
const expressLayouts = require('express-ejs-layouts')

// require spotify-web-api-node package here:
const SpotifyWebApi = require('spotify-web-api-node')

// setting the spotify-api goes here:
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  })
  
  // Retrieve an access token
  spotifyApi
    .clientCredentialsGrant()
    .then(data => spotifyApi.setAccessToken(data.body['access_token']))
    .catch(error => console.log('Something went wrong when retrieving an access token', error))
  
const app = express()

app.use(expressLayouts)
app.set('view engine', 'ejs')
app.set('views', __dirname + '/views')
app.use(express.static(__dirname + '/public'))

// Our routes go here:
app.get('/', (req, res) => {
    res.render('index');
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
  

app.listen(80, () => console.log('0.0.0.0'))
