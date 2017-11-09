'use babel';
'use strict';

const path = require('path');
const glob = require('glob');
const fs   = require('fs');

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

const cxxTestErrors = function (output) {
    const test_copy_rx = /copied test results for.*from (.*) to (.*)/
    var copy_line = output.split(/\r?\n/).find((line) => test_copy_rx.test(line))
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
const rubyTestErrors = function (output) {
    var modes = new Map;
    var result = []
    var current = new Map
    const errorLineMatcher = /^\s+(.+):(\d+):/
    const failureLineMatcher = /\[([^\[]+):(\d+)\]:$/
    const updateCurrent = function (packageName, newCurrent) {
        if (newCurrent) {
            result.push(newCurrent)
            current.set(packageName, newCurrent)
        }
        else {
            current.delete(packageName)
        }
    }
    output.split(/\r?\n/).forEach(line => {
        var packageMatch = /^([^:]+):test: (.*)$/.exec(line)
        if (!packageMatch) {
            return;
        }
        var entryIndex = 0
        var packageName = packageMatch[1]
        var line = packageMatch[2]

        var currentMode = modes.get(packageName);
        var modeMatch = /\d+\) (Failure|Error)/.exec(line)
        if (modeMatch) {
            updateCurrent(packageName)
            modes.set(packageName, modeMatch[1])
        }
        else if (currentMode == 'Failure') {
            if (!current.has(packageName)) {
                const m = failureLineMatcher.exec(line)
                if (m) {
                    updateCurrent(packageName, { file: m[1], line: m[2], message: '', trace: [] })
                }
            }
            else {
                current.get(packageName).message += `\n${line}`
            }
        }
        else if (currentMode == 'Error') {
            if (!current.has(packageName)) {
                updateCurrent(packageName, { file: null, line: null, message: '', trace: [] })
            }

            var m = errorLineMatcher.exec(line)
            if (m) {
                var c = current.get(packageName)
                if (c.file) {
                    c.trace.push({ file: m[1], line: m[2] })
                }
                else {
                    c.file = m[1]
                    c.line = m[2]
                }
            }
            else {
                current.get(packageName).message += `\n${line}`
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
    ])],
    ['Autobuild::CMake', new Map([
        ['functionMatch', cxxTestErrors]
    ])],
    ['Autobuild::Orogen', new Map([
        ['functionMatch', rubyTestErrors]
    ])]
])

exports.findWorkspaceRoot = (rootPath) => {
    var lastPath = ''
    while (rootPath !== lastPath) {
        if (fs.existsSync(path.join(rootPath, '.autoproj', 'installation-manifest'))) {
            return rootPath
        }
        lastPath = rootPath
        rootPath = path.dirname(rootPath);
    }
    return null
}

exports.packageTargets = (pkg, workspacePath) => {
    return [
        new BuildPackage(pkg.name, pkg.type, workspacePath, { deps: true }),
        new BuildPackage(pkg.name, pkg.type, workspacePath, { deps: false }),
        new ForceBuildPackage(pkg.name, pkg.type, workspacePath, { deps: true }),
        new ForceBuildPackage(pkg.name, pkg.type, workspacePath, { deps: false }),
        new UpdatePackage(pkg.name, pkg.type, workspacePath, { deps: true }),
        new UpdatePackage(pkg.name, pkg.type, workspacePath, { deps: false }),
        new CheckoutPackage(pkg.name, pkg.type, workspacePath),
        new TestPackage(pkg.name, pkg.type, workspacePath)
    ]
}

exports.rootTargets = (workspacePath) => {
    return [
        new Build(workspacePath),
        new ForceBuild(workspacePath),
        new Update(workspacePath),
        new Checkout(workspacePath),
        new UpdateConfig(workspacePath)
    ]
}

class Autoproj {
    constructor(autoprojMode, workspacePath) {
        this.workspacePath = workspacePath;
        this.sh = false;
        this.cwd = workspacePath;
        this.exec = path.join(workspacePath, '.autoproj', 'bin', 'autoproj');
        this.autoprojMode = autoprojMode
        this.updateName("all")
    }

    updateName(packageName, deps) {
        this.name = `Autoproj ${this.autoprojMode}: ${packageName}`;
    }

    selectPackage(packageName, packageType) {
        this.updateName(packageName)
        this.args.push(packageName)
    }

    nodeps() {
        this.name += ' (nodeps)'
        this.args.push('--deps=f')
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
        super("Build", workspaceName)
        this.args = ['build', '--tool'];
    }

}

export class ForceBuild extends Autoproj {
    constructor(workspacePath) {
        super("Force Build", workspacePath)
        this.args = ['update', '--tool', '--force', '--deps=f']
    }
}

export class Update extends Autoproj {
    constructor(workspacePath) {
        super("Update", workspacePath)
        this.args = ['update', '--progress=f'];
    }
}
export class Checkout extends Autoproj {
    constructor(workspacePath) {
        super("Checkout", workspacePath)
        this.args = ['update', '--checkout-only', '--progress=f'];
    }
}

export class UpdateConfig extends Autoproj {
    constructor(workspacePath) {
        super("Update Config", workspacePath)
        this.args = ['update', '--config', '--progress=f'];
    }
}

export class BuildPackage extends Build {
    constructor(packageName, packageType, workspacePath, { deps = false } = {}) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }

    selectPackage(packageName, packageType) {
        super.selectPackage(packageName, packageType)
        this.applyMatchers(buildMatchers.get(packageType))
    }

}

export class ForceBuildPackage extends ForceBuild {
    constructor(packageName, packageType, workspacePath, { deps = false } = {}) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}

export class UpdatePackage extends Update {
    constructor(packageName, packageType, workspacePath, { deps = true } = {}) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}

export class CheckoutPackage extends Checkout {
    constructor(packageName, packageType, workspacePath) {
        super(workspacePath)
        this.selectPackage(packageName, packageType)
    }
}

export class TestPackage extends Autoproj {
    constructor(packageName, packageType, workspacePath, { deps = false } = {}) {
        super("Test", workspacePath)
        this.args = ['test', '--tool'];
        this.selectPackage(packageName, packageType)
        this.applyMatchers(testMatchers.get(packageType))
        if (!deps) {
            this.nodeps()
        }
    }
}
