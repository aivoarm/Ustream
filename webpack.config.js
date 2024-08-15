const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './app.js',  // Your server entry point
  target: 'node',  // Ensures Webpack is aware it's bundling for Node.js
  externals: [nodeExternals()],  // Exclude node_modules from the bundle
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  mode: 'production',
};
