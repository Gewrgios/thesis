var _ = require('underscore');
var phantom = require('phantom');
var util = require('util');
var request = require('request');
var async = require('async');
var sleep = require('sleep');
var mongoose = require('mongoose');
var app = require('./app');
mongoose.connection.on('error', console.log);
mongoose.connection.on('connect', console.log);
var HARVEST = false;
var SAVE = true;
// require models
require('./models');

// Connect to mongodb
var connect = function () {
  var options = { server: { socketOptions: { keepAlive: 1 } } };
  mongoose.connect('mongodb://localhost/sites', options);
};
connect();
mongoose.connection.on('error', console.log);
mongoose.connection.on('disconnected', connect);

// Models
var configure = require('./configure');
var Site = mongoose.model('Sites');


function _check_level_1(parent_callback){
  console.log('_check_level_1');
  var promise = Site.find({}).exec();
  promise.then(function(sites){
    async.eachSeries(sites, function(site, callback_level_1){
      console.log('Site', site.name);
      _check(site.name, site.meta, callback_level_1);
    }, function(err){
      if(err){
        console.log('Error in level 1');
      }
      parent_callback(null);
    });
  });
}

function _harvest(parent_callback){
  async.eachSeries(configure.websites, function(url, callback){
    var data = [];
    request(url, function(http_error, response, body){
      console.log('[Parsing]', url);
      console.log('[STATUS]', response.statusCode);
      if(response.statusCode == 200 && !http_error){
        console.log('[RESPONSE]', response.headers);
        var data = response.headers;
        var site = new Site({
          name: url,
          urls: url,
          meta: data
        })
        site.save(function (err) {
          if(err){
            console.log('Error');
          }
          callback();
        });
      }
    });
  }, function(err){
    if (err){
      console.log('Error', err);
    }
    console.log('DONE Harvesting');
    parent_callback(null);
  });
}

async.waterfall([
    function(callback) {
      if(HARVEST){
        Site.remove({});
        _harvest(callback);
      }else{
        callback(null);
      }
    },
    function(callback) {
      if(SAVE){
        _check_level_1(callback);
      }else{
        callback(null);
      }
    },
    function(callback) {
      callback(null);
    }
], function (err, result) {
  process.exit();
});


function _check(name, data, callback_parent){
  var results = {
    hsts: check_hsts(data),
    secure_cookies: check_secure_cookies(data),
    csp: check_csp(data),
    httponly_cookies: check_httponly_cookies(data),
    xfo: check_xfo(data),
    x_content: check_x_content(data)
  }
  var site = Site.findOne({name:name}, function(error, site){
    site.results = results;
    site.save(function (err) {
      if(err){
        console.log('Error');
      }
      callback_parent();
    });
  })
}

// HSTS
function check_hsts(object){
  // Check `Strict-Transport-Security`
  return _.has(object, 'Strict-Transport-Security');
}
// Secure Cookies
function check_secure_cookies(object){
  if (_.has(object, 'Set-Cookie')){
    return _.contains(object['Set-Cookie'], 'Secure');
  }
  return false;
}
// CSP
function check_csp(object){
  // Check `X-XSS-Protection`
  return _.has(object, 'X-XSS-Protection');
}
// HTTP Only Cookies
function check_httponly_cookies(object){
  // Check if contains `HttpOnly`
  if (_.has(object, 'Set-Cookie')){
    return _.contains(object['Set-Cookie'], 'HttpOnly');
  }
  return false;
}
// XFO
function check_xfo(object){
  // Check `X-Frame-Options`
  if(_.has(object, 'X-Frame-Options')){
    return object['X-Frame-Options'] === 'SAMEORIGIN';
  }
  return false;
}
// Iframe sandboxing
function check_iframe_sandboxing(text){
  // Check sanbox attribute
  return true;
}
// CSRF
function check_csrf(text){
  // Check forms for csrf
  return true;
}
// Content options
function check_x_content(object){
  // Check `X-Content-Type-Options`
  if(_.has(object, 'X-Content-Type-Options')){
    return object['X-Content-Type-Options'] === 'nosniff';
  }
  return false;
}
