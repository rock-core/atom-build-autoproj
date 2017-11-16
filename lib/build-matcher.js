'use babel';
'use strict';

const XRegExp  = require('xregexp')

const cmakeGenerateErrorMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'].
    map((rx) => XRegExp(rx))
const cmakeGenerateWarningMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'].
    map((rx) => XRegExp(rx))
const ccCompileErrorMatch = [
    '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?error:\\s+(?<message>.+)',  // GCC/Clang Error,
    '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*error\\s*(C\\d+)?\\s*:(?<message>.*)'  // Visual Studio Error
].
    map((rx) => XRegExp(rx))
const ccCompileWarningMatch = [
    '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?warning:\\s+(?<message>.+)',  // GCC/Clang warning
    '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*warning\\s*(C\\d+)?\\s*:(?<message>.*)'  // Visual Studio Error
].
    map((rx) => XRegExp(rx))

const cmakeConfigureErrorMatch = cmakeGenerateErrorMatch
const cmakeConfigureWarningMatch = cmakeGenerateWarningMatch
const cmakeBuildErrorMatch = cmakeGenerateErrorMatch.concat(ccCompileErrorMatch)
const cmakeBuildWarningMatch = cmakeGenerateWarningMatch.concat(ccCompileWarningMatch)

const cxxTestErrors = function (lines) {
    const test_copy_rx = /copied test results for.*from (.*) to (.*)/
    var copy_line = lines.find((line) => test_copy_rx.test(line))
    if (!copy_line) {
        return [];
    }
    var matches = test_copy_rx.exec(copy_line)
    if (!matches) {
        return [];
    }

    const files = glob.sync(path.join(matches[2], '*.xml'))
    var result = []
    files.forEach((file) => {
        var xml_string = fs.readFileSync(file);
        var xml = (new DOMParser()).parseFromString(xml_string, "text/xml");
        var errors = xml.getElementsByTagName("FatalError")
        for (var i = 0; i < errors.length; ++i) {
            result.push({
                file: errors[i].getAttribute('file'),
                line: errors[i].getAttribute('line'),
                message: errors[i].textContent
            })
        }
    })
    return result
}
const rubyTestErrors = (lines) => {
    var currentMode = null
    var current = null
    var result = []
    const modeMatcher = /\d+\) (Failure|Error)/
    const errorLineMatcher   = /^\s+(.+):(\d+):/
    const failureLineMatcher = /\[([^\[]+):(\d+)\]:$/
    const endLineMatcher = /^(\d+) runs, (\d+) assertions/

    lines.forEach((line) => {
        var entryIndex = 0

        if (endLineMatcher.exec(line)) {
            currentMode = null
            return;
        }

        var modeMatch = modeMatcher.exec(line)
        if (modeMatch) {
            current = { file: null, line: null, message: '', trace: [] }
            result.push(current)
            currentMode = modeMatch[1]
        }
        else if (currentMode == 'Failure') {
            if (!current.file) {
                const m = failureLineMatcher.exec(line)
                if (m) {
                    current.file = m[1]
                    current.line = m[2]
                }
            }
            else {
                current.message += `\n${line}`
            }
        }
        else if (currentMode == 'Error') {
            var m = errorLineMatcher.exec(line)
            if (m) {
                if (current.file) {
                    current.trace.push({ file: m[1], line: m[2] })
                }
                else {
                    current.file = m[1]
                    current.line = m[2]
                }
            }
            else {
                current.message += `\n${line}`
            }
        }
    })
    result.forEach((entry) => {
        entry.message = entry.message.trim()
    });
    return result
}

const errorAndWarningMatchLine = (errorMatchers, warningMatchers, line) => {
    var match = null
    errorMatchers.some((matcher) => {
        match = XRegExp.exec(line, matcher)
        return match
    })
    if (match) {
        return { file: match.file, line: match.line, column: match.column, type: 'Error', message: match.message }
    }

    warningMatchers.some((matcher) => {
        match = XRegExp.exec(line, matcher)
        return match
    })
    if (match) {
        return { file: match.file, line: match.line, column: match.column, type: 'Warning', message: match.message }
    }
}
const errorAndWarningMatch = (errorMatchers, warningMatchers, lines) => {
    var result = []
    lines.forEach((line) => {
        var match = errorAndWarningMatchLine(errorMatchers, warningMatchers, line)
        if (match) {
            result.push(match)
        }
    })
    return result
}

const orogenTypelibWarningRX = /^Typelib\[WARN\]: (.+):(\d+): (.*)/

const orogenErrorMatch = (lines) => {
    var result = []
    lines.forEach((line) => {
        var match = orogenTypelibWarningRX.exec(line)
        if (match) {
            result.push({ file: match[1], line: match[2], type: 'Warning', message: match[3] })
            return;
        }
        match = errorAndWarningMatchLine(ccCompileErrorMatch, ccCompileWarningMatch, line)
        if (match) {
            result.push(match)
            return
        }
    })
    return result;
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
            if (error.file) {
                result.push(error)
            }
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
        entry.message = entry.message.join("\n").trim()
    })
    return result
}

const matcherByPackageType = new Map([
    ['Autobuild::CMake', {
        configure: (output) => errorAndWarningMatch(cmakeConfigureErrorMatch, cmakeConfigureWarningMatch, output),
        build: (output) => errorAndWarningMatch(cmakeBuildErrorMatch, cmakeBuildWarningMatch, output),
        test: (output) => cxxTestErrors
    }],
    ['Autobuild::Orogen', {
        orogen: orogenErrorMatch,
        configure: (output) => errorAndWarningMatch(cmakeConfigureErrorMatch, cmakeConfigureWarningMatch, output),
        build: (output) => errorAndWarningMatch(cmakeBuildErrorMatch, cmakeBuildWarningMatch, output),
        test: (output) => rubyTestErrors
    }],
    ['Autobuild::Ruby', {
        "post-install": rakeErrorMatch,
        test: rubyTestErrors
    }]
])

const findLineMatcher = (packageType, buildPhase) => {
    var matchers = matcherByPackageType.get(packageType);
    if (!matchers) {
        return;
    }

    var lineMatcher = matchers[buildPhase];
    if (!lineMatcher) {
        return matchers['*'];
    }
    else {
        return lineMatcher;
    }
}

exports.plainBuildMatcher = (packageType, mode, output) => {
    var matcher = findLineMatcher(packageType, mode)
    if (matcher) {
        return matcher(output.split(/\r?\n/))
    }
}

const packageNameBuildPhaseAndLineMatch = /^([^:]+):([^:]+):(?: (.*))?$/;

exports.autoprojBuildMatcher = (workspaceInfo, output) => {
    var perPackageAndMatcher = new Map()
    output.split(/\r?\n/).forEach((line) => {
        var extractNameAndPhase = packageNameBuildPhaseAndLineMatch.exec(line);
        if (!extractNameAndPhase) {
            return;
        }

        var packageName = extractNameAndPhase[1]
        var buildPhase  = extractNameAndPhase[2]
        var actualLine  = extractNameAndPhase[3]
        if (actualLine === undefined) {
            actualLine = ''
        }

        var packageInfo = workspaceInfo.packages.get(packageName)
        if (!packageInfo) {
            console.log(`cannot find package info for ${packageName}`)
            return;
        }

        var lineMatcher = findLineMatcher(packageInfo.type, buildPhase)
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
