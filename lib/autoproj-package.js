'use babel';
'use strict';

const path = require('path');

const cmakeGenerateErrorMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'];
const cmakeGenerateWarningMatch =
    ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'];
const ccCompileErrorMatch = [
    '[a-zA-Z\\\\/]+:build: (.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?error:\\s+(?<message>.+)',  // GCC/Clang Error,
    '[a-zA-Z\\\\/]+:build: (?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*error\\s*(C\\d+)?\\s*:(?<message>.*)',  // Visual Studio Error
];
const ccCompileWarningMatch = [
    '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?warning:\\s+(?<message>.+)',  // GCC/Clang warning
    '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*warning\\s*(C\\d+)?\\s*:(?<message>.*)',  // Visual Studio Error
];

const rubyTestErrors = function (output) {
    var modes = new Map;
    var result = []
    const failure_match = /\[([^\[]+):(\d+)\]:$/
    const error_backtrace_match = /^\s+(.+):(\d+):/
    output.split(/\r?\n/).forEach(line => {
        var packageMatch = /^([^:]+):test: (.*)$/.exec(line)
        if (!packageMatch) {
            return;
        }
        var packageName  = packageMatch[1]
        var line = packageMatch[2]

        if (/\d+\) Failure/.test(line)) {
            modes.set(packageName, 'failure')
        }
        else if (modes.get(packageName) == 'failure') {
            const m = failure_match.exec(line)
            if (m) {
                result.push({ file: m[1], line: m[2] })
            }
            modes.delete(packageName)
        }
        else if (/\d+\) Error/.test(line)) {
            modes.set(packageName, 'error')
        }
        else if (modes.get(packageName) == 'error') {
            const m = error_backtrace_match.exec(line)
            if (m) {
                result.push({ file: m[1], line: m[2] })
            }
        }
    })
    return result
}

const buildMatchers = new Map([
    ['Autobuild::CMake', new Map([
        ['errorMatch', cmakeGenerateErrorMatch.concat(ccCompileErrorMatch)],
        ['warningMatch', cmakeGenerateWarningMatch.concat(ccCompileWarningMatch)]
    ])],
    ['Autobuild::Orogen', new Map([
        ['errorMatch', cmakeGenerateErrorMatch.concat(ccCompileErrorMatch)],
        ['warningMatch', cmakeGenerateWarningMatch.concat(ccCompileWarningMatch)]
    ])]
])
const testMatchers = new Map([
    ['Autobuild::Ruby', new Map([
        ['functionMatch', rubyTestErrors]
    ])]
])

class Autoproj {
    constructor(autoprojMode, workspacePath) {
        this.workspacePath = workspacePath;
        this.sh = false;
        this.cwd = workspacePath;
        this.exec = path.join(workspacePath, '.autoproj', 'bin', 'autoproj');
        this.autoprojMode = autoprojMode
        this.updateName("all")
    }

    updateName(packageName) {
        this.name = `${path.basename(this.workspacePath)}:${packageName}:${this.autoprojMode}`;
    }

    selectPackage(packageName, packageType) {
        this.updateName(packageName)
        this.args.push(packageName)
    }

    applyMatchers(matchers) {
        if (matchers) {
            matchers.forEach((value, key) => {
                this[key] = value
            })
            return matchers
        }
    }
}

export class Build extends Autoproj {
    constructor(workspaceName) {
        super("build", workspaceName)
        this.args = ['build', '--tool'];
    }

}

export class ForceBuild extends Autoproj {
    constructor(workspacePath) {
        super("force-build", workspacePath)
        this.args = ['update', '--tool', '--force', '--deps=f']
    }
}

export class Update extends Autoproj {
    constructor(workspacePath) {
        super("update", workspacePath)
        this.args = ['update', '--progress=f'];
    }
}

export class UpdateConfig extends Autoproj {
    constructor(workspacePath) {
        super("update-config", workspacePath)
        this.args = ['update', '--config', '--progress=f'];
    }
}

export class BuildPackage extends Build {
    constructor(packageName, packageType, workspacePath) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
    }

    selectPackage(packageName, packageType) {
        super.selectPackage(packageName, packageType)
        this.applyMatchers(buildMatchers.get(packageType))
    }

}

export class ForceBuildPackage extends ForceBuild {
    constructor(packageName, packageType, workspacePath) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
    }
}

export class UpdatePackage extends Update {
    constructor(packageName, packageType, workspacePath) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
    }
}

export class TestPackage extends Autoproj {
    constructor(packageName, packageType, workspacePath) {
        super("test", workspacePath)
        this.args = ['test', '--tool'];
        this.selectPackage(packageName, packageType)
        this.applyMatchers(testMatchers.get(packageType))
    }
}
