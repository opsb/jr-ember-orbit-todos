/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp();

// Required Orbit imports
app.import('bower_components/orbit.js/orbit.amd.js', {
  exports: {'orbit': ['default']}
});
app.import('bower_components/orbit.js/orbit-common.amd.js', {
  exports: {'orbit-common': ['default']}
});

// Optional import of local storage source
app.import('bower_components/orbit.js/orbit-common-local-storage.amd.js', {
  exports: {'orbit-common/local-storage-source': ['default']}
});

// Optional import of JSON API source and serializer
app.import('bower_components/orbit.js/orbit-common-jsonapi.amd.js', {
  exports: {'orbit-common/jsonapi-source': ['default'],
            'orbit-common/jsonapi-serializer': ['default']}
});

// Required Ember-Orbit import
app.import('bower_components/ember-orbit/ember-orbit.amd.js', {
  exports: {'ember-orbit': ['default']}
});

app.import('bower_components/normalize-css/normalize.css');

// Use `app.import` to add additional libraries to the generated
// output files.
//
// If you need to use different assets in different
// environments, specify an object as the first parameter. That
// object's keys should be the environment name and the values
// should be the asset to use in that environment.
//
// If the library that you are including contains AMD or ES6
// modules that you would like to import into your application
// please specify an object with the list of modules as keys
// along with the exports of each module as its value.

module.exports = app.toTree();
