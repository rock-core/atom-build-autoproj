'use babel';
'use strict';

const yaml = require('js-yaml');
const path = require('path');
const glob = require('glob');
const fs   = require('fs');
import voucher from 'voucher';
import { buildMatcher } from './build-matcher.js'

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

exports.loadWorkspaceInfo = (workspacePath) => {
    var installationManifestPath = path.join(workspacePath, '.autoproj', 'installation-manifest')
    return voucher(fs.readFile, installationManifestPath).
        then((data) => {
            const manifest = yaml.safeLoad(data);
            var packageSets = new Map()
            var packages = new Map()
            manifest.forEach((entry) => {
                if (entry.name) {
                    packages.set(entry.name, entry)
                }
                else {
                    packageSets.set(entry.package_set, entry)
                }
            })
            return { path: workspacePath, packageSets: packageSets, packages: packages };
        })
}

exports.packageTargets = (pkg, workspaceInfo) => {
    return [
        new BuildPackage(pkg.name, pkg.type, workspaceInfo, { deps: true }),
        new BuildPackage(pkg.name, pkg.type, workspaceInfo, { deps: false }),
        new ForceBuildPackage(pkg.name, pkg.type, workspaceInfo, { deps: true }),
        new ForceBuildPackage(pkg.name, pkg.type, workspaceInfo, { deps: false }),
        new UpdatePackage(pkg.name, pkg.type, workspaceInfo, { deps: true }),
        new UpdatePackage(pkg.name, pkg.type, workspaceInfo, { deps: false }),
        new CheckoutPackage(pkg.name, pkg.type, workspaceInfo),
        new TestPackage(pkg.name, pkg.type, workspaceInfo)
    ]
}

exports.rootTargets = (workspaceInfo) => {
    return [
        new Build(workspaceInfo),
        new ForceBuild(workspaceInfo),
        new Update(workspaceInfo),
        new Checkout(workspaceInfo),
        new UpdateConfig(workspaceInfo),
        new Test(workspaceInfo)
    ]
}

class Autoproj {
    constructor(autoprojMode, workspaceInfo) {
        this.workspaceInfo = workspaceInfo;
        this.sh = false;
        this.cwd = workspaceInfo.path;
        this.exec = path.join(this.cwd, '.autoproj', 'bin', 'autoproj');
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

class Build extends Autoproj {
    constructor(workspaceInfo) {
        super("Build", workspaceInfo)
        this.args = ['build', '--tool'];
        var that = this
        this.functionMatch = (output) => {
            return buildMatcher(that.workspaceInfo, output)
        }
    }
}

class ForceBuild extends Autoproj {
    constructor(workspaceInfo) {
        super("Force Build", workspaceInfo)
        this.args = ['build', '--tool', '--force', '--deps=f']
    }
}

class Update extends Autoproj {
    constructor(workspaceInfo) {
        super("Update", workspaceInfo)
        this.args = ['update', '--progress=f', '-k'];
    }
}
class Checkout extends Autoproj {
    constructor(workspaceInfo) {
        super("Checkout", workspaceInfo)
        this.args = ['update', '--checkout-only', '--progress=f', '-k'];
    }
}

class UpdateConfig extends Autoproj {
    constructor(workspaceInfo) {
        super("Update Config", workspaceInfo)
        this.args = ['update', '--config', '--progress=f'];
    }
}

class Test extends Autoproj {
    constructor(workspaceInfo) {
        super("Test", workspaceInfo)
        this.args = ['test', '--tool', '--progress=f', '-k'];
    }
}

class BuildPackage extends Build {
    constructor(packageName, packageType, workspaceInfo, { deps = false } = {}) {
        super(workspaceInfo)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}

class ForceBuildPackage extends ForceBuild {
    constructor(packageName, packageType, workspaceInfo, { deps = false } = {}) {
        super(workspaceInfo)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}

class UpdatePackage extends Update {
    constructor(packageName, packageType, workspaceInfo, { deps = true } = {}) {
        super(workspaceInfo)
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}

class CheckoutPackage extends Checkout {
    constructor(packageName, packageType, workspaceInfo) {
        super(workspaceInfo)
        this.selectPackage(packageName, packageType)
    }
}

class TestPackage extends Autoproj {
    constructor(packageName, packageType, workspaceInfo, { deps = false } = {}) {
        super("Test", workspaceInfo)
        this.args = ['test', '--tool'];
        this.selectPackage(packageName, packageType)
        this.applyMatchers(testMatchers.get(packageType))
        if (!deps) {
            this.nodeps()
        }
    }
}
