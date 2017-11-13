'use babel';
'use strict';

const XRegExp  = require('xregexp')

const cmakeGenerateErrorMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)']
const cmakeGenerateWarningMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)']
const ccCompileErrorMatch = [
    '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?error:\\s+(?<message>.+)',  // GCC/Clang Error,
    '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*error\\s*(C\\d+)?\\s*:(?<message>.*)'  // Visual Studio Error
]
const ccCompileWarningMatch = [
    '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?warning:\\s+(?<message>.+)',  // GCC/Clang warning
    '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*warning\\s*(C\\d+)?\\s*:(?<message>.*)'  // Visual Studio Error
]

const cmakeConfigureErrorMatch = cmakeGenerateErrorMatch.
    map((rx) => XRegExp(rx))
const cmakeConfigureWarningMatch = cmakeGenerateWarningMatch.
    map((rx) => XRegExp(rx))
const cmakeBuildErrorMatch = cmakeGenerateErrorMatch.concat(ccCompileErrorMatch).
    map((rx) => XRegExp(rx))
const cmakeBuildWarningMatch = cmakeGenerateWarningMatch.concat(ccCompileWarningMatch).
    map((rx) => XRegExp(rx))
const orogenErrorMatch = ['^(?<file>).+:(?<line>\\d+):(?<message>.+)$'].
    map((rx) => XRegExp(rx))

const packageNameBuildPhaseAndLineMatch = /^([^:]+):([^:]+):(?: (.*))?$/;

const errorAndWarningMatch = (errorMatchers, warningMatchers, lines) => {
    var result = []
    lines.forEach((line) => {
        var match = null
        errorMatchers.some((matcher) => {
            match = XRegExp.exec(line, matcher)
            return match
        })
        if (match) {
            result.push({ file: match.file, line: match.line, column: match.column, message: "Error: " + match.message })
            return
        }

        warningMatchers.some((matcher) => {
            match = XRegExp.exec(line, matcher)
            return match
        })
        if (match) {
            result.push({ file: match.file, line: match.line, column: match.column, message: "Warning: " + match.message })
            return
        }
    })
    return result
}

const rakeErrorMatch = (lines) => {
    var mode    = null
    var error   = { file: null, line: null, message: [], trace: [] }
    var result  = []
    lines.forEach((line) => {
        if (/rake aborted!/.test(line)) {
            mode = 'message'
            return;
        }
        else if (!mode) {
            return;
        }

        var match = /^(\/.*):(\d+):(.*)/.exec(line)
        if (match) {
            var file = match[1]
            var line = match[2]
            if (mode != 'backtrace') {
                mode = 'backtrace'
                error.file = file
                error.line = line
            }
            error.trace.push({file: file, line: line, message: match[3]})
            return;
        }

        if (mode == 'backtrace') {
            result.push(error)
            error = { file: null, line: null, message: [], trace: [] }
        }
        else if (mode == 'message') {
            error.message.push(line)
        }
    })
    if (error.file) {
        result.push(error)
    }
    result.forEach((entry) => {
        entry.message = entry.message.join("\n")
    })
    return result
}

const matcherByPackageType = new Map([
    ['Autobuild::CMake', {
        configure: (output) => errorAndWarningMatch(cmakeConfigureErrorMatch, cmakeConfigureWarningMatch, output),
        build: (output) => errorAndWarningMatch(cmakeBuildErrorMatch, cmakeBuildWarningMatch, output)
    }],
    ['Autobuild::Orogen', {
        orogen: (output) => errorAndWarningMatch(orogenErrorMatch, [], output),
        configure: (output) => errorAndWarningMatch(cmakeConfigureErrorMatch, cmakeConfigureWarningMatch, output),
        build: (output) => errorAndWarningMatch(cmakeBuildErrorMatch, cmakeBuildWarningMatch, output)
    }],
    ['Autobuild::Ruby', {
        "post-install": rakeErrorMatch
    }]
])

exports.buildMatcher = (workspaceInfo, output) => {
    var perPackageAndMatcher = new Map()
    output.split(/\r?\n/).forEach((line) => {
        var extractNameAndPhase = packageNameBuildPhaseAndLineMatch.exec(line);
        if (!extractNameAndPhase) {
            return;
        }

        var packageName = extractNameAndPhase[1]
        var buildPhase  = extractNameAndPhase[2]
        var actualLine  = extractNameAndPhase[3]

        var packageInfo = workspaceInfo.packages.get(packageName)
        if (!packageInfo) {
            console.log(`cannot find package info for ${packageName}`)
            return;
        }

        var matchers = matcherByPackageType.get(packageInfo.type)
        if (!matchers) {
            return;
        }

        var lineMatcher = matchers[buildPhase]
        if (!lineMatcher) {
            lineMatcher = matchers['*']
        }
        if (!lineMatcher) {
            return;
        }

        var perMatcher = perPackageAndMatcher.get(packageName)
        if (!perMatcher) {
            perMatcher = new Map()
            perPackageAndMatcher.set(packageName, perMatcher)
        }

        var matcherContent = perMatcher.get(lineMatcher)
        if (!matcherContent) {
            matcherContent = []
            perMatcher.set(lineMatcher, matcherContent)
        }

        matcherContent.push(actualLine)
    })

    var result = []
    perPackageAndMatcher.forEach((perMatcher, packageName) => {
        perMatcher.forEach((output, matcher) => {
            result = result.concat(matcher(output))
        })
    })
    return result
}
