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
    fs      = require('fs'),
    $q 		= require('Q'),
    saveDir = __dirname + '/_snapshots';

module.exports = function(grunt) {

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
