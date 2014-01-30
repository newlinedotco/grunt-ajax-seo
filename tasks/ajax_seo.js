/*
 * grunt-ajax-seo
 * https://github.com/fullstackio/grunt-ajax-seo
 *
 * Copyright (c) 2014 Nate Murray & Ari Lerner
 * Licensed under the MIT license.
 */

'use strict';

var Browser = require('zombie'),
    url     = require('url'),
    path    = require('path'),
    async   = require('async'),
    _       = require('underscore'),
    util    = require('util'),
    fs      = require('fs'),
    urlLib  = require('url'),
    cheerio = require('cheerio'),
    $q 		= require('Q'),
    saveDir = __dirname + '/_snapshots';

module.exports = function(grunt) {
  var phantom     = require("grunt-lib-phantomjs").init(grunt);
  var asset = path.join.bind(null, __dirname, '..');

  grunt.registerMultiTask('htmlSnapshot', 'fetch html snapshots', function(){

    var options = this.options({
      urls: [],
      msWaitForPages: 500,
      fileNamePrefix: '',
      sanitize: function(requestUri) {
        return requestUri.replace(/#|\/|\!/g, '_');
      },
      snapshotPath: '',
      sitePath: '',
      removeScripts: false,
      removeLinkTags: false,
      removeMetaTags: false,
      replaceStrings: []
    });

    console.log(util.inspect(options));

    // the channel prefix for this async grunt task
    var taskChannelPrefix = "" + new Date().getTime();

    var sanitizeFilename = options.sanitize;

    var urlsTodo = options.urls;
    var urlsSeen = {};

    phantom.on(taskChannelPrefix + ".error.onError", function (msg, trace) {
      grunt.log.writeln('error: ' + msg);
      phantom.halt();
    });

    phantom.on(taskChannelPrefix + ".console", function (msg, trace) {
      grunt.log.writeln(msg);
    });

    phantom.on(taskChannelPrefix + ".htmlSnapshot.pageReady", function (msg, url) {
      var plainUrl = url.replace(sitePath, '');
      var parsedUrl = urlLib.parse(url);

      var fileName =  options.snapshotPath +
            options.fileNamePrefix +
            sanitizeFilename(plainUrl) +
            '.html';

      if (options.removeScripts){
        msg = msg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }

      if (options.removeLinkTags){
        msg = msg.replace(/<link\s.*?(\/)?>/gi, '');
      }

      if (options.removeMetaTags) {
        msg = msg.replace(/<meta\s.*?(\/)?>/gi, '');
      }

      options.replaceStrings.forEach(function(obj) {
        var key = Object.keys(obj);
        var value = obj[key];
        var regex = new RegExp(key, 'g');
        msg = msg.replace(regex, value);
      });

      var $ = cheerio.load(msg);
      var links = $('body').find('a');

      _.each(
        links,
        function(link) { 
          var href = $(link).attr('href');
          if(href) {
            // ignore anchors
            if(href.match(/^#/)) {
              return;
            }
            // fix relative urls
            if(!href.match(/^http/)) {
              href = parsedUrl.protocol + "//" + parsedUrl.host + href;
            }
            var parsedLinkUrl = urlLib.parse(href);

            // don't cross domains
            if(parsedLinkUrl.host != parsedUrl.host) {
              return;
            }

            if(!_.has(urlsSeen, href)) {
              console.log('  Found ' + href);
              urlsTodo.push(href);
              urlsSeen[href] = true;
            }
          }
        });

      grunt.file.write(fileName, msg);
      grunt.log.writeln(fileName, 'written');
      phantom.halt();
    });

    var done = this.async();

    var urls = options.urls;
    var sitePath = options.sitePath;
    
    var idx = 0;

    async.whilst(
      function() { 
        return idx < urlsTodo.length;
      },
      function(next) { 
        var url = urlsTodo[idx];
        console.log('Crawling ', url);
        phantom.spawn(sitePath + url, {
          // Additional PhantomJS options.
          options: {
            phantomScript: asset('phantomjs/bridge.js'),
            msWaitForPages: options.msWaitForPages,
            bodyAttr: options.bodyAttr,
            cookies: options.cookies,
            taskChannelPrefix: taskChannelPrefix
          },
          // Complete the task when done.
          done: function (err) {
            if (err) {
              console.log(err);
              // If there was an error, abort the series.
              done();
            }
            else {
              // Otherwise, process next url.
              next();
            }
          }
        });
        idx++;      
      },
      function(err) { 
        console.log(err);
        done();
        // 
      });

    grunt.log.writeln('running ajaxSeo');
  });



  grunt.registerMultiTask('ajaxSeo', 'Grunt plugin that generates static html snapshots of an ajax-based site by crawling', function() {
    var done = this.async();

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    var scriptTagRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

    var stripScriptTags = function(html) {
      return html.replace(scriptTagRegex, '');
    };

    var mkdirParent = function(dirPath, mode, callback) {
      // Call the standard fs.mkdir
      fs.mkdir(dirPath, mode, function(error) {
        // When it fail in this way, do the custom steps
        if (error && error.errno === 34) {
          fs.mkdirParent(path.dirname(dirPath), mode, callback); // Create all the parents recursively
          fs.mkdirParent(dirPath, mode, callback); // And then the directory
        }
        //Manually run the callback since we used our own callback to do all these
        callback && callback(error);
      });
    };

    var saveSnapshot = function(uri, body) {
      var lastIdx = uri.lastIndexOf('#!/');

      if (lastIdx < 0) {
        // If we're using html5mode
        path = url.parse(uri).pathname;
      } else {
        // If we're using hashbang mode
        path = 
          uri.substring(lastIdx + 2, uri.length);
      }

      if (path === '/') path = "/index.html";

      if (path.indexOf('.html') == -1)
        path += ".html";

      var filename = saveDir + path;
      grunt.log.writeln("Saving ", uri, " to ", filename);
      var dirname = require("path").dirname(filename);
      mkdirParent(dirname);
	    fs.open(filename, 'w', function(e, fd) {
		    if (e) return;
		    fs.write(fd, body);
	    });
    };

    var browserOpts = {
      waitFor: "2000ms",
      loadCSS: false,
      waitDuration: "2000ms"
    };

    var browser = new Browser(browserOpts);

    // normalize links
    // check for them in an an object
    // crawl the next link
    // use a library function for making the intermediate directories
    // wire up all of the options

    var crawlPage = function(idx, arr) {
      console.log("crawling a page", arr)
      if (idx < arr.length) {
        var uri = arr[idx];
        console.log("visiting ", uri);
        var promise = browser.visit(uri)
              .then(function() {
                var d = $q.defer();
                console.log("im visiting");

                // Turn links into absolute links
                // and save them, if we need to
                // and we haven't already crawled them
                // var links = browser.queryAll('a');
                // links.forEach(function(link) {
                //   var href = link.getAttribute('href');
                //   var absUrl = url.resolve(uri, href);
                //   link.setAttribute('href', absUrl);
                //   if (arr.indexOf(absUrl) < 0) {
                //     arr.push(absUrl);
                //   }
                // });

                // Save
                saveSnapshot(uri, browser.html());
                // Call again on the next iteration
                d.resolve();

                return d.promise;
              });
        console.log("here?");
        promise.then(function() { 
          console.log("we're done");
          console.log("hello there");
          // crawlPage(idx+1, arr);			
          done();
        },
        function(err) { 
          console.log(err);
          done(err);
        }

        );

      }
    };

    grunt.log.writeln('running grunt-ajax-seo');
    crawlPage(0, ["http://localhost:3000/"]);

  });

};


