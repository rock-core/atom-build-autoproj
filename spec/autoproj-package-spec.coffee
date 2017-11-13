'use babel';
'use strict';

XRegExp  = require 'xregexp'
autoproj = require '../lib/autoproj-package'
fs       = require 'fs'
path     = require 'path'
{errorMatchersByPackageType} = require '../lib/autoproj-package'

describe "test matchers", ->
    describe "Ruby", ->
        it "successfully parses minitest-reported errors and failure", ->
            minitest_reports = fs.readFileSync(path.join(__dirname, 'minitest-errors.txt'), encoding: 'utf8')
            pkg = new autoproj.TestPackage('rubylib', 'Autobuild::Ruby', {path: '/path/to/workspace'})
            matches = pkg.functionMatch(minitest_reports)
            expect(matches.length).toBe(4)
            expect(matches[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/failing_test.rb")
            expect(matches[0].line).toBe('5')
            expect(matches[0].message).toBe("\na test that fails#test_0001_has an error:\nRuntimeError: error")
            expect(matches[0].trace).toEqual(
                [{ file: "/usr/lib/ruby/vendor_ruby/minitest/test.rb", line: '108' }]
            )
            expect(matches[1].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib2/test/failing_test.rb")
            expect(matches[1].line).toBe('8')
            expect(matches[2].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/failing_test.rb")
            expect(matches[2].line).toBe('8')
            expect(matches[3].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib/test/rubylib_test.rb")
            expect(matches[3].line).toBe('9')
