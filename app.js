var util = require('util');
var request = require('request');
var _ = require('lodash');
var async = require('async');
var configure = require('./configure');

// For each webpage run the tests
_(configure.websites).forEach(function(url){
    async.waterfall([
      function(callback){
        var request_url = configure.google.format('url', 1);
        request(request_url, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            console.log(body) // Show the HTML for the Google homepage.
          }
        })
      },
      function(urls, callback){
      }
    ]);
    //console.log('Get websites', url, '================================');
    //var page = require('webpage').create();
    //page.open(url, function(){
    //});
    //var data = {};
    //var keys = [];
    //var values = [];
    //page.onResourceReceived = function(response){
      //var headers = response.headers;
      //_(headers).forEach(function(item){
        //data[item['name']] = item['value'];
      //});
    //};
    //page.onLoadFinished = function(status) {
      //console.log('Data', JSON.stringify(data), '\n\n');
      //console.log('HSTS', check_hsts(data));
      //console.log('Secure Cookies', check_secure_cookies(data));
      //console.log('CSP', check_csp(data));
      //console.log('HTTP Only Cookies', check_httponly_cookies(data));
      //console.log('XFO', check_xfo(data));
      //console.log('X Content', check_x_content(data));
      //phantom.exit();
    //}
});

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
