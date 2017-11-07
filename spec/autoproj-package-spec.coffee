'use babel';
'use strict';

XRegExp = require 'xregexp'
autoproj  = require '../lib/autoproj-package'
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
