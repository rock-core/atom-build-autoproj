'use babel';
'use strict';

XRegExp  = require 'xregexp'
autoproj = require '../lib/autoproj-package'
fs       = require 'fs'
path     = require 'path'
{ autoprojBuildMatcher } = require '../lib/build-matcher'

describe "CMake packages", ->
    describe "matches a GCC error", ->
        it "successfully matches a GCC error", ->
            error = "drivers/orogen/iodrivers_base:build: /path/to/File.cpp:21:2: error: ‘syntax_error’ does not name a type"
            workspaceInfo = {
                packages: new Map([["drivers/orogen/iodrivers_base", {name: "drivers/orogen/iodrivers_base", type: "Autobuild::CMake"}]])
            }
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/path/to/File.cpp")
            expect(matches[0].line).toBe("21")
            expect(matches[0].column).toBe("2")
            expect(matches[0].type).toBe("Error")
            expect(matches[0].message).toBe("‘syntax_error’ does not name a type")

    describe "matches a GCC Warning", ->
        it "successfully matches a GCC warning", ->
            error = "drivers/orogen/iodrivers_base:build: /path/to/File.cpp:21:2: warning: ‘syntax_error’ does not name a type"
            workspaceInfo = {
                packages: new Map([["drivers/orogen/iodrivers_base", {name: "drivers/orogen/iodrivers_base", type: "Autobuild::CMake"}]])
            }
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/path/to/File.cpp")
            expect(matches[0].line).toBe("21")
            expect(matches[0].column).toBe("2")
            expect(matches[0].type).toBe("Warning")
            expect(matches[0].message).toBe("‘syntax_error’ does not name a type")

    describe "the oroGen output", ->
        it "matches the Typelib warnings", ->
            workspaceInfo = {
                packages: new Map([["orogen_with_warnings", {name: "orogen_with_warnings", type: "Autobuild::Orogen"}]])
            }
            error = """
orogen_with_warnings:orogen: Typelib[WARN]: /path/to/file.hpp:9: ignoring incomplete type /SISLCurve
            """
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches).toEqual([{
                file: "/path/to/file.hpp",
                line: '9',
                type: 'Warning',
                message: "ignoring incomplete type /SISLCurve"
            }])

        it "matches a mix of Typelib warnings and compilation errors", ->
            workspaceInfo = {
                packages: new Map([["orogen", {name: "orogen", type: "Autobuild::Orogen"}]])
            }
            error = """
orogen:orogen: Typelib[WARN]: /path/to/file.hpp:9: ignoring incomplete type /SISLCurve
orogen:orogen: /path/to/error.hpp:15:10: error: syntax error
            """
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches).toEqual([
                {
                    file: "/path/to/file.hpp",
                    line: '9',
                    type: 'Warning',
                    message: "ignoring incomplete type /SISLCurve"
                },
                {
                    file: "/path/to/error.hpp",
                    line: '15',
                    column: '10'
                    type: 'Error',
                    message: "syntax error"
                }
            ])

describe "Ruby packages", ->
    describe "matches a Rake error", ->
        it "matches an error due to an exception", ->
            workspaceInfo = {
                packages: new Map([["rubylib_fail_install", {name: "rubylib_fail_install", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_fail_install:post-install: rake aborted!
rubylib_fail_install:post-install: cannot install
rubylib_fail_install:post-install: /path/to/Rakefile:10:in `<top (required)>'
rubylib_fail_install:post-install: /the/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
rubylib_fail_install:post-install: (See full trace by running task with --trace)
            """
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/path/to/Rakefile")
            expect(matches[0].line).toBe("10")
            expect(matches[0].message).toBe("cannot install")
            expect(matches[0].trace).toEqual([
                {
                    file: "/path/to/Rakefile",
                    line: '10',
                    message: "in `<top (required)>'"
                },
                {
                    file: "/the/gems/rake-12.0.0/exe/rake",
                    line: '27',
                    message: "in `<top (required)>'"
                }])


        it "matches an error due to the default task missing", ->
            workspaceInfo = {
                packages: new Map([["rubylib_rake_misses_default_task", {name: "rubylib_rake_misses_default_task", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_rake_misses_default_task:post-install: rake aborted!
rubylib_rake_misses_default_task:post-install: Don't know how to build task 'default' (see --tasks)
rubylib_rake_misses_default_task:post-install: /the/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
rubylib_rake_misses_default_task:post-install: (See full trace by running task with --trace)
            """
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/the/gems/rake-12.0.0/exe/rake")
            expect(matches[0].line).toBe("27")
            expect(matches[0].message).toBe("Don't know how to build task 'default' (see --tasks)")
            expect(matches[0].trace).toEqual([{
                file: "/the/gems/rake-12.0.0/exe/rake",
                line: '27',
                message: "in `<top (required)>'"
            }])

        it "matches an error due to a syntax error", ->
            workspaceInfo = {
                packages: new Map([["rubylib_rake_syntax_error", {name: "rubylib_rake_syntax_error", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_rake_syntax_error:post-install: rake aborted!
rubylib_rake_syntax_error:post-install: SyntaxError: /path/to/Rakefile:9: premature end of char-class: /
rubylib_rake_syntax_error:post-install:
rubylib_rake_syntax_error:post-install: Rake::TestTask.new(:test) do |t|
rubylib_rake_syntax_error:post-install:     t.libs << "test"
rubylib_rake_syntax_error:post-install:     t.libs << "lib"
rubylib_rake_syntax_error:post-install:     t.test_files = FileList["test/
rubylib_rake_syntax_error:post-install: /path/to/Rakefile:9: unterminated regexp meets end of file
rubylib_rake_syntax_error:post-install: /the/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
            """
            expectedMessage = """
SyntaxError: /path/to/Rakefile:9: premature end of char-class: /

Rake::TestTask.new(:test) do |t|
    t.libs << "test"
    t.libs << "lib"
    t.test_files = FileList["test/"""
            matches = autoprojBuildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/path/to/Rakefile")
            expect(matches[0].line).toBe("9")
            expect(matches[0].message).toBe(expectedMessage)
            expect(matches[0].trace).toEqual([
                {
                    file: "/path/to/Rakefile",
                    line: "9",
                    message: "unterminated regexp meets end of file"
                },
                {
                    file: "/the/gems/rake-12.0.0/exe/rake",
                    line: '27',
                    message: "in `<top (required)>'"
                }
            ])

    describe "tests", ->
        it "successfully parses minitest-reported errors and failure", ->
            workspaceInfo = {
                packages: new Map([
                    ["rubylib1", {name: "rubylib1", type: "Autobuild::Ruby"}],
                    ["rubylib2", {name: "rubylib2", type: "Autobuild::Ruby"}]
                ])
            }
            minitest_reports = fs.readFileSync(path.join(__dirname, 'minitest-errors.txt'), encoding: 'utf8')
            matches = autoprojBuildMatcher(workspaceInfo, minitest_reports)
            expect(matches.length).toBe(4)
            expect(matches[0].file).toBe("/home/rubylib/test/failing_test.rb")
            expect(matches[0].line).toBe('5')
            expect(matches[0].message).toBe("a test that fails#test_0001_has an error:\nRuntimeError: error")
            expect(matches[0].trace).toEqual(
                [{ file: "/root/minitest/test.rb", line: '108' }]
            )
            expect(matches[1].file).toBe("/home/rubylib/test/failing_test.rb")
            expect(matches[1].line).toBe('8')
            expect(matches[2].file).toBe("/home/rubylib/test/rubylib_test.rb")
            expect(matches[2].line).toBe('9')
            expect(matches[3].file).toBe("/home/rubylib2/test/failing_test.rb")
            expect(matches[3].line).toBe('8')
