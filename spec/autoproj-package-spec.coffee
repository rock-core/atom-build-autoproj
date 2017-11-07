'use babel';
'use strict';

XRegExp  = require 'xregexp'
autoproj = require '../lib/autoproj-package'
fs       = require 'fs'
path     = require 'path'
{errorMatchersByPackageType} = require '../lib/autoproj-package'

describe "error matchers", ->
    describe "CMake", ->
        it "successfully matches a GCC error", ->
            pkg = new autoproj.BuildPackage('drivers/orogen/iodrivers_base', 'Autobuild::CMake', '/path/to/workspace')
            errors = pkg.errorMatch
            matches = errors.map (regex) ->
                regex = XRegExp(regex)
                XRegExp.exec("drivers/orogen/iodrivers_base:build: /home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp:21:2: error: ‘syntax_error’ does not name a type", regex)
            match = matches.find (match) -> match
            expect(match.file).toBe("/home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp")
            expect(match.line).toBe("21")
            expect(match.column).toBe("2")

describe "test matchers", ->
    describe "Ruby", ->
        it "successfully parses minitest-reported errors and failure", ->
            minitest_reports = fs.readFileSync(path.join(__dirname, 'minitest-errors.txt'), encoding: 'utf8')
            pkg = new autoproj.TestPackage('rubylib', 'Autobuild::Ruby', '/path/to/workspace')
            matches = pkg.functionMatch(minitest_reports)
            expect(matches.length).toBe(5)
            expect(matches[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/failing_test.rb")
            expect(matches[0].line).toBe('5')
            expect(matches[1].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib2/test/failing_test.rb")
            expect(matches[1].line).toBe('8')
            expect(matches[2].file).toBe("/usr/lib/ruby/vendor_ruby/minitest/test.rb")
            expect(matches[2].line).toBe('108')
            expect(matches[3].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/failing_test.rb")
            expect(matches[3].line).toBe('8')
            expect(matches[4].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/rubylib_test.rb")
            expect(matches[4].line).toBe('9')
