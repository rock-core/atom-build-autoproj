'use babel';
'use strict';

XRegExp  = require 'xregexp'
autoproj = require '../lib/autoproj-package'
fs       = require 'fs'
path     = require 'path'
{ buildMatcher } = require '../lib/build-matcher'

describe "CMake packages", ->
    describe "matches a GCC error", ->
        it "successfully matches a GCC error", ->
            error = "drivers/orogen/iodrivers_base:build: /home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp:21:2: error: ‘syntax_error’ does not name a type"
            workspaceInfo = {
                packages: new Map([["drivers/orogen/iodrivers_base", {name: "drivers/orogen/iodrivers_base", type: "Autobuild::CMake"}]])
            }
            matches = buildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp")
            expect(matches[0].line).toBe("21")
            expect(matches[0].column).toBe("2")
            expect(matches[0].message).toBe("Error: ‘syntax_error’ does not name a type")

    describe "matches a GCC Warning", ->
        it "successfully matches a GCC warning", ->
            error = "drivers/orogen/iodrivers_base:build: /home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp:21:2: warning: ‘syntax_error’ does not name a type"
            workspaceInfo = {
                packages: new Map([["drivers/orogen/iodrivers_base", {name: "drivers/orogen/iodrivers_base", type: "Autobuild::CMake"}]])
            }
            matches = buildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/home/doudou/dev/rock-ucs/drivers/orogen/iodrivers_base/tasks/Proxy.cpp")
            expect(matches[0].line).toBe("21")
            expect(matches[0].column).toBe("2")
            expect(matches[0].message).toBe("Warning: ‘syntax_error’ does not name a type")

    describe "matches a Rake error", ->
        it "matches an error due to an exception", ->
            workspaceInfo = {
                packages: new Map([["rubylib_fail_install", {name: "rubylib_fail_install", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_fail_install:post-install: rake aborted!
rubylib_fail_install:post-install: cannot install
rubylib_fail_install:post-install: /home/doudou/dev/atom-workspace-test/rubylib_fail_install/Rakefile:10:in `<top (required)>'
rubylib_fail_install:post-install: /home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
rubylib_fail_install:post-install: (See full trace by running task with --trace)
            """
            matches = buildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib_fail_install/Rakefile")
            expect(matches[0].line).toBe("10")
            expect(matches[0].message).toBe("cannot install")
            expect(matches[0].trace[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib_fail_install/Rakefile")
            expect(matches[0].trace[0].line).toBe("10")
            expect(matches[0].trace[0].message).toBe("in `<top (required)>'")
            expect(matches[0].trace[1].file).toBe("/home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake")
            expect(matches[0].trace[1].line).toBe("27")
            expect(matches[0].trace[1].message).toBe("in `<top (required)>'")

        it "matches an error due to the default task missing", ->
            workspaceInfo = {
                packages: new Map([["rubylib_rake_misses_default_task", {name: "rubylib_rake_misses_default_task", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_rake_misses_default_task:post-install: rake aborted!
rubylib_rake_misses_default_task:post-install: Don't know how to build task 'default' (see --tasks)
rubylib_rake_misses_default_task:post-install: /home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
rubylib_rake_misses_default_task:post-install: (See full trace by running task with --trace)
            """
            matches = buildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake")
            expect(matches[0].line).toBe("27")
            expect(matches[0].message).toBe("Don't know how to build task 'default' (see --tasks)")
            expect(matches[0].trace[0].file).toBe("/home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake")
            expect(matches[0].trace[0].line).toBe("27")
            expect(matches[0].trace[0].message).toBe("in `<top (required)>'")

        it "matches an error due to a syntax error", ->
            workspaceInfo = {
                packages: new Map([["rubylib_rake_syntax_error", {name: "rubylib_rake_syntax_error", type: "Autobuild::Ruby"}]])
            }
            error = """
rubylib_rake_syntax_error:post-install: rake aborted!
rubylib_rake_syntax_error:post-install: SyntaxError: /home/doudou/dev/atom-workspace-test/rubylib_rake_syntax_error/Rakefile:9: premature end of char-class: /
rubylib_rake_syntax_error:post-install:
rubylib_rake_syntax_error:post-install: Rake::TestTask.new(:test) do |t|
rubylib_rake_syntax_error:post-install:     t.libs << "test"
rubylib_rake_syntax_error:post-install:     t.libs << "lib"
rubylib_rake_syntax_error:post-install:     t.test_files = FileList["test/
rubylib_rake_syntax_error:post-install: /home/doudou/dev/atom-workspace-test/rubylib_rake_syntax_error/Rakefile:9: unterminated regexp meets end of file
rubylib_rake_syntax_error:post-install: /home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake:27:in `<top (required)>'
            """
            expectedMessage = """
SyntaxError: /home/doudou/dev/atom-workspace-test/rubylib_rake_syntax_error/Rakefile:9: premature end of char-class: /

Rake::TestTask.new(:test) do |t|
    t.libs << "test"
    t.libs << "lib"
    t.test_files = FileList["test/"""
            matches = buildMatcher(workspaceInfo, error)
            expect(matches.length).toBe(1)
            expect(matches[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib_rake_syntax_error/Rakefile")
            expect(matches[0].line).toBe("9")
            expect(matches[0].message).toBe(expectedMessage)
            expect(matches[0].trace[0].file).toBe("/home/doudou/dev/atom-workspace-test/rubylib_rake_syntax_error/Rakefile")
            expect(matches[0].trace[0].line).toBe("9")
            expect(matches[0].trace[0].message).toBe(" unterminated regexp meets end of file")
            expect(matches[0].trace[1].file).toBe("/home/doudou/.autoproj/gems/ruby/2.3.0/gems/rake-12.0.0/exe/rake")
            expect(matches[0].trace[1].line).toBe("27")
            expect(matches[0].trace[1].message).toBe("in `<top (required)>'")
