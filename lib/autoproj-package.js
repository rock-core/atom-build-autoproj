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

const buildErrors = {
    'Autobuild::CMake': cmakeGenerateErrorMatch.concat(ccCompileErrorMatch),
    'Autobuild::Orogen': cmakeGenerateErrorMatch.concat(ccCompileErrorMatch)
}
const buildWarnings = {
    'Autobuild::CMake': cmakeGenerateWarningMatch.concat(ccCompileWarningMatch),
    'Autobuild::Orogen': cmakeGenerateWarningMatch.concat(ccCompileWarningMatch)
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

    updateName(packageName) {
        this.name = `${path.basename(this.workspacePath)}:${packageName}:${this.autoprojMode}`;
    }

    selectPackage(packageName, packageType) {
        this.updateName(packageName)
        this.args.push(packageName)
    }
}

export class Build extends Autoproj {
    constructor(workspaceName) {
        super("build", workspaceName)
        this.args = ['build', '--tool'];
    }

    errorMatchersByPackageType(packageType) {
        const matchers = buildErrors[packageType]
        if(matchers) {
            return matchers
        }
        else {
            return []
        }
    }

    warningMatchersByPackageType(packageType) {
        const matchers = buildWarnings[packageType]
        if(matchers) {
            return matchers
        }
        else {
            return []
        }
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
        this.errorMatch = this.errorMatchersByPackageType(packageType)
        this.warningMatch = this.warningMatchersByPackageType(packageType)
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
