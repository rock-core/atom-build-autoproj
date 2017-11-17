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
        this.autoprojExePath = autoproj.installationManifestPath(this.workspacePath)
    }
    destructor() {
        return 'void';
    }

    getNiceName() {
        return "Autoproj Package";
    }

    isEligible() {
        return (this.workspacePath != null) && (this.workspacePath != this.packagePath)
    }

    settings() {
        return autoproj.loadWorkspaceInfo(this.workspacePath).
            then((workspaceInfo) => {
                let currentPackage = this.findCurrentPackage(workspaceInfo)

                let packages = []
                if (currentPackage && currentPackage.name) {
                    packages = packages.concat(autoproj.packageTargets(currentPackage, workspaceInfo));
                }
                packages = packages.concat(autoproj.rootTargets(workspaceInfo))
                return packages;
            })
    }

    findCurrentPackage(wsInfo) {
        let packagePath = this.packagePath;
        for (let pkg of wsInfo.packages.values()) {
            if (packagePath === pkg.srcdir || packagePath.startsWith(pkg.srcdir + path.sep)) {
                return pkg
            }
        }
        return null;
    }
}
