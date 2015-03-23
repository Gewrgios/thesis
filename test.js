var _ = require('underscore');
var phantom = require('phantom');
var util = require('util');
var request = require('request');
var async = require('async');
var sleep = require('sleep');
var mongoose = require('mongoose');
mongoose.connection.on('error', console.log);
mongoose.connection.on('connect', console.log);

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

async.eachSeries(
  configure.websites,
  function(url, callback){
    var data = [];
    // ============ Recursivly collect the urls =========================
    async.waterfall(
      [
        function(extract_from_each_page){
          console.log('[HARVESTING]', url, '================================');
          var paths = [];
          var pages = _.range(10);
          // Google search for each url
          async.eachSeries(
            pages,
            function(page, page_callback){
              var request_url = util.format(configure.google, url, page+1);
              // Make the google search request
              var fail = true;
              async.whilst(
                function(){ return fail === true},
                function(while_callback){
                  console.log('[PAGE]', page, '=================================');
                  request(request_url, function(http_error, response, body){
                    console.log('[STATUS]', response.statusCode);
                    if(response.statusCode == 200 && !http_error){
                      var clean = JSON.parse(body);
                      // Extract paths
                      async.eachSeries(
                        clean.responseData.results,
                        function(path, extract_next){
                          paths.push(path.url);
                          extract_next(null);
                        },
                        function(extract_error){
                          if(extract_error){
                            console.log('[ERROR]', extract_error);
                          }
                          setTimeout(function(){
                            page_callback(null);
                          }, 10000);
                        }
                      );
                      fail = false;
                      while_callback(null);
                    }else{
                      console.log('[SLEEPING]', http_error);
                      sleep.sleep(10);
                      while_callback(null);
                    }
                  });
                },
                function(while_error){
                  if(while_error){
                    console.log('While error');
                  }
                  console.log('[FINISH] with while loop.');
                }
              );
            },
            // Ok it finished with the links
            function(page_error){
              if(page_error){
                console.log(page_error);
              }
              // For each page wait 5 sec
              console.log('[WAITING]', 'for the next page 10 secs');
              setTimeout(function(){
                extract_from_each_page(null, paths);
              }, 10000);
            }
          );
        },
        function(domain_paths, domain_paths_callback){
          console.log('All urls that I\'ve collected', domain_paths);
          var site = new Site({
            name: url,
            urls: domain_paths
          });
          site.save(function (err) {
            if(err){
              console.log('Error');
            }
            domain_paths_callback(null);
          });
        }
      ],
      function(waterfall_error, waterfall_result){
        if(waterfall_error){
          console.log('Error on parsing urls');
        }
        console.log('[FINISH]', url);
        setTimeout(function(){
          callback(null)
        }, 60000);
      }
    );
    // =================================================================
  },
  function(domain_error){
    if(domain_error){
      console.log('ERROR', domain_error);
    }
    console.log('Everything is ok');
  }
);
