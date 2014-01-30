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
    mkdirp  = require('mkdirp'),
    cheerio = require('cheerio'),
    $q 		= require('Q'),
    saveDir = __dirname + '/_snapshots';

module.exports = function(grunt) {
  var phantom     = require("grunt-lib-phantomjs").init(grunt);
  var asset = path.join.bind(null, __dirname, '..');

  grunt.registerMultiTask('ajaxSeo', 'fetch html snapshots', function(){
    grunt.log.writeln('running ajaxSeo');

    var options = this.options({
      urls: [],
      waitTime: 1000,
      sanitizeFilename: function(requestUri) {
        var parsedUri = urlLib.parse(requestUri);
        var filePath = parsedUri.path;
        if (filePath.match(/\/$/)) filePath = filePath + "index.html";
        if (!filePath.match(/\.html$/)) filePath = filePath + ".html";
        return filePath;
      },
      snapshotPath: '',
      removeScripts: false,
      removeLinkTags: false,
      removeMetaTags: false,
      webSecurity: true,
      replaceStrings: []
    });

    // the channel prefix for this async grunt task
    var taskChannelPrefix = "" + new Date().getTime();

    var sanitizeFilename = options.sanitizeFilename;

    var urlsTodo = options.urls;
    var urlsSeen = {};

    phantom.on(taskChannelPrefix + ".error.onError", function (msg, trace) {
      grunt.log.writeln('error: ' + msg);
      grunt.log.writeln(util.inspect(trace));
      phantom.halt();
    });

    phantom.on(taskChannelPrefix + ".console", function (msg, trace) {
      grunt.log.writeln(msg);
    });

    phantom.on(taskChannelPrefix + ".htmlSnapshot.pageReady", function (msg, url) {
      var plainUrl = url;
      var parsedUrl = urlLib.parse(url);

      var fileName =  options.snapshotPath + sanitizeFilename(plainUrl);

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
      console.log("found links", links.length);

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

      mkdirp.sync(path.dirname(fileName));

      grunt.file.write(fileName, msg);
      grunt.log.writeln(fileName, 'written');
      phantom.halt();
    });

    var done = this.async();

    var urls = options.urls;
    
    var idx = 0;

    async.whilst(
      function() { 
        return idx < urlsTodo.length;
      },
      function(next) { 
        var url = urlsTodo[idx];
        console.log('Crawling ', url);
        phantom.spawn(url, {
          // Additional PhantomJS options.
          options: {
            phantomScript: asset('phantomjs/bridge.js'),
            msWaitForPages: options.waitTime,
            bodyAttr: options.bodyAttr,
            cookies: options.cookies,
            "--web-security": options.webSecurity,
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

  });


};


