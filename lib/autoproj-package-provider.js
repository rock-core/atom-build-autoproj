'use babel';
'use strict';
const fs   = require('fs');
const path = require('path');
const autoproj = require('./autoproj-package')

exports.AutoprojPackageProvider = class AutoprojPackageProvider {
    constructor(packagePath) {
        this.packagePath = packagePath;
        this.workspacePath = autoproj.findWorkspaceRoot(packagePath)
        if (!this.workspacePath) {
            return;
        }

        this.workspaceName = path.basename(this.workspacePath)
        this.autoprojExePath = path.join(this.workspacePath, '.autoproj', 'bin', 'autoproj');
    }
    destructor() {
        return 'void';
    }

    getNiceName() {
        return "Autoproj Package";
    }

    isEligible() {
        return this.workspacePath && (this.workspacePath != this.packagePath)
    }

    settings() {
        const that = this;

        return autoproj.loadWorkspaceInfo(this.workspacePath).
            then((workspaceInfo) => {
                let currentPackage = that.findCurrentPackage(workspaceInfo)

                let packages = []
                if (currentPackage && currentPackage.name) {
                    packages = packages.concat(autoproj.packageTargets(currentPackage, workspaceInfo));
                }
                packages = packages.concat(autoproj.rootTargets(workspaceInfo))
                return packages;
            })
    }

    findCurrentPackage(wsInfo) {
        let packagePath = this.packagePath
        if (!this.packagePath) {
            return;
        }

        for (var pkg of wsInfo.packages.values()) {
            if (packagePath === pkg.srcdir || packagePath.startsWith(pkg.srcdir + path.sep)) {
                return pkg
            }
        }
    }
}
