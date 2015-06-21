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
var CLEAR = false;
var HARVEST = false;
var SAVE = false;
var SENSITIVE = true;
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
      if(response.statusCode == 200 && !http_error){
        console.log('[RESPONSE]', response.headers);
        var data = response.headers;
        var site = new Site({
          name: url,
          urls: url,
          meta: data,
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
    function(callback){
      if(SENSITIVE){
        _check_for_sensitive_files(callback);
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
    x_content: check_x_content(data),
    x_xss_protection: check_x_xss_protection(data),
    check_outdated_server: check_outdated_server(data)
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
  return _.has(object, 'strict-transport-security');
}
// Secure Cookies
function check_secure_cookies(object){
  if (_.has(object, 'set-cookie')){
    var result = _.some(['https', 'secure'], function(word) {
        return  object['set-cookie'][0].toLowerCase().search(word) > 0
    });
    return result;
  }
}
// CSP
function check_csp(object){
  // Check `X-XSS-Protection`
  return _.has(object, 'x-xss-protection');
}
// HTTP Only Cookies
function check_httponly_cookies(object){
  // Check if contains `HttpOnly`
  if (_.has(object, 'set-cookie')){
    return object['set-cookie'][0].toLowerCase().search('httponly') > 0;
  }
}
// XFO
function check_xfo(object){
  // Check `X-Frame-Options`
  if(_.has(object, 'x-frame-options')){
    var result = _.some(['sameorigin', 'deny'], function(word) {
        return object['x-frame-options'].toLowerCase() === word;
    });
    return result;
  }
  return false;
}
// Iframe sandboxing
function check_iframe_sandboxing(text){
  // Check sanbox attribute
  return _.has(text, 'sandbox');
}
// CSRF
function check_csrf(text){
  // Check forms for csrf
  return _.has(text, 'csrf');
}
// Content options
function check_x_content(object){
  // Check `X-Content-Type-Options`
  if(_.has(object, 'x-content-type-options')){
    return object['x-content-type-options'].toLowerCase() === 'nosniff';
  }
  return false;
}

function check_x_xss_protection(object){
  // Check `x-xss-protection`
  return _.has(object, 'x-xss-protection');
}

function check_outdated_server(object){
  if(_.has(object, 'server')){
    var result = _.some(configure.softwareVersions, function(word) {
        return object['server'].toLowerCase() === word;
    });
    return result;
  }
  // For microsoft
  if(_.has(object, 'Server')){
    var result = _.some(configure.softwareVersions, function(word) {
        return object['Server'].toLowerCase() === word;
    });
    return result;
  }
  return true;
}

// Put it as async tasks
function _check_for_sensitive_files(parent_callback) {
  // Check for sensitive files
  var data = {};
  async.eachSeries(configure.websites, function(url, callback){
    data[url] = {};
    async.eachSeries(configure.sensitiveFiles, function(file, callbackSensitive){
      var check_url = util.format('%s/%s', url, file);
      request(check_url, function(http_error, response, body){
        console.log('Error', check_url, file.replace('.', '_'), http_error);
        data[url][file.replace('.', '_')] = (response.responseCode == 200) ? true : false;
        data[url]['csrf'] = check_csrf(response);
        data[url]['iframe_sandboxing'] = check_iframe_sandboxing(response);
        callbackSensitive();
      });
    }, function(err){
      // HERE
      var site = Site.findOne({name:url}, function(error, site){
        site.results = _.extend(data[url], site.results);
        site.save(function (err) {
          if(err){
            console.log('Error', err);
          }
          callback();
        });
      })
      // HERE
    });
  }, function(err){
    parent_callback(null);
  });
}
