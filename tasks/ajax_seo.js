/*
 * grunt-ajax-seo
 * https://github.com/fullstackio/grunt-ajax-seo
 *
 * Copyright (c) 2014 Nate Murray & Ari Lerner
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  grunt.registerMultiTask('ajaxSeo', 'Grunt plugin that generates static html snapshots of an ajax-based site by crawling', function() {

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });
    grunt.log.writeln('hi mom');

  });

};
