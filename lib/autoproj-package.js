'use babel';
'use strict';

const yaml = require('js-yaml');
const path = require('path');
const glob = require('glob');
const fs   = require('fs');
import voucher from 'voucher';
import { plainBuildMatcher, autoprojBuildMatcher } from './build-matcher.js'

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
        this.functionMatch = (output) => {
            return autoprojBuildMatcher(that.workspaceInfo, output)
        }
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
        this.args = ['test', '--tool', '--progress=f', '-k', '-n'];
        this.selectPackage(packageName, packageType)
        if (!deps) {
            this.nodeps()
        }
    }
}
